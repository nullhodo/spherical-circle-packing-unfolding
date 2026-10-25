import * as Mp4Muxer from "mp4-muxer";
import { getFormattedDate } from "../utils/date";

export class VideoRecorderManager {
  private isRecording = false;
  private canvasElement: HTMLCanvasElement | null = null;

  // mp4-muxer / WebCodecs properties
  private muxer: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget> | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private recordingStartTimestamp = 0;
  private frameCounter = 0;
  private encoderWidth = 800;
  private encoderHeight = 600;
  private isEncoderErrored = false;

  // Fallback MediaRecorder properties
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private onStateChangeCallback?: (
    recording: boolean,
    elapsedSec: number,
  ) => void;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    onStateChange?: (recording: boolean, elapsedSec: number) => void,
  ) {
    this.canvasElement = canvas;
    this.onStateChangeCallback = onStateChange;
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvasElement = canvas;
  }

  public async startRecording(): Promise<boolean> {
    if (this.isRecording || !this.canvasElement) return false;

    this.isEncoderErrored = false;
    const width = this.canvasElement.width || 800;
    const height = this.canvasElement.height || 600;

    // Even dimensions requirement for H.264
    const roundedWidth = width % 2 === 0 ? width : width - 1;
    const roundedHeight = height % 2 === 0 ? height : height - 1;
    this.encoderWidth = roundedWidth;
    this.encoderHeight = roundedHeight;

    // Check WebCodecs VideoEncoder support
    if (typeof VideoEncoder !== "undefined") {
      try {
        console.log("[mp4-muxer] Initializing WebCodecs MP4 Recording...");

        this.muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: {
            codec: "avc",
            width: roundedWidth,
            height: roundedHeight,
          },
          fastStart: "in-memory",
          firstTimestampBehavior: "offset",
        });

        this.videoEncoder = new VideoEncoder({
          output: (chunk, meta) => {
            try {
              this.muxer?.addVideoChunk(chunk, meta);
            } catch (err) {
              console.error("[mp4-muxer addVideoChunk error]", err);
            }
          },
          error: (e) => {
            console.error("[mp4-muxer Encoder Error]", e);
            this.isEncoderErrored = true;
          },
        });

        // 互換性の高い順にコーデック候補を検証 (Baseline 5.1 -> Main 5.1 -> High 5.1)
        const candidateConfigs: VideoEncoderConfig[] = [
          {
            codec: "avc1.420033", // Baseline Profile Level 5.1 (最も安全・高互換)
            width: roundedWidth,
            height: roundedHeight,
            bitrate: 15_000_000,
            framerate: 60,
            hardwareAcceleration: "no-preference",
          },
          {
            codec: "avc1.4d0033", // Main Profile Level 5.1
            width: roundedWidth,
            height: roundedHeight,
            bitrate: 15_000_000,
            framerate: 60,
            hardwareAcceleration: "no-preference",
          },
          {
            codec: "avc1.640033", // High Profile Level 5.1
            width: roundedWidth,
            height: roundedHeight,
            bitrate: 15_000_000,
            framerate: 60,
            hardwareAcceleration: "no-preference",
          },
        ];

        let chosenConfig: VideoEncoderConfig | null = null;
        for (const cfg of candidateConfigs) {
          try {
            const support = await VideoEncoder.isConfigSupported(cfg);
            if (support.supported && support.config) {
              chosenConfig = support.config;
              break;
            }
          } catch {
            // 次の候補を試す
          }
        }

        if (!chosenConfig) {
          chosenConfig = candidateConfigs[0];
        }

        await this.videoEncoder.configure(chosenConfig);

        this.isRecording = true;
        this.recordingStartTimestamp = performance.now();
        this.frameCounter = 0;

        this.startTimer();
        return true;
      } catch (err) {
        console.warn(
          "[mp4-muxer] WebCodecs MP4 initialization failed, falling back to MediaRecorder WebM:",
          err,
        );
      }
    }

    // Fallback: MediaRecorder WebM
    try {
      console.log("[MediaRecorder] Initializing 60fps WebM recording...");
      const stream = this.canvasElement.captureStream(60);
      this.recordedChunks = [];

      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9",
      )
        ? "video/webm;codecs=vp9"
        : "video/webm";

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 20_000_000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveMediaRecorderOutput();
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.recordingStartTimestamp = performance.now();

      this.startTimer();
      return true;
    } catch (e) {
      console.error("[VideoRecorder] Failed to start recording:", e);
      return false;
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * p5.js のレンダリングループ (p.draw) の直後に同期的に呼び出されるフレーム記録処理。
   * 独立したタイマーや RAF の遅延・フレーム間引きを排除し、完全な固定 60fps タイムステップでエンコードする。
   */
  public recordCurrentFrame(): void {
    if (
      !this.isRecording ||
      !this.canvasElement ||
      !this.videoEncoder ||
      this.isEncoderErrored
    ) {
      return;
    }

    if (this.videoEncoder.state !== "configured") {
      return;
    }

    // エンコードキュー滞留ガード (メインスレッドの詰まり防止)
    if (this.videoEncoder.encodeQueueSize > 12) {
      return;
    }

    const frameTimestampMicroseconds = Math.round(
      (this.frameCounter * 1_000_000) / 60,
    );
    const keyFrame = this.frameCounter % 60 === 0;

    let videoFrame: VideoFrame | null = null;
    try {
      videoFrame = new VideoFrame(this.canvasElement, {
        timestamp: frameTimestampMicroseconds,
        visibleRect: {
          x: 0,
          y: 0,
          width: this.encoderWidth,
          height: this.encoderHeight,
        },
        displayWidth: this.encoderWidth,
        displayHeight: this.encoderHeight,
      });

      this.videoEncoder.encode(videoFrame, { keyFrame });
      this.frameCounter++;
    } catch (e) {
      console.error("[mp4-muxer] Error encoding frame:", e);
    } finally {
      if (videoFrame) {
        try {
          videoFrame.close();
        } catch {
          // ignore
        }
      }
    }
  }

  public async stopRecording(
    customFilename?: string,
  ): Promise<string | null> {
    if (!this.isRecording) return null;

    this.isRecording = false;
    this.stopTimer();

    if (this.videoEncoder && this.muxer && !this.isEncoderErrored) {
      try {
        if (this.videoEncoder.state === "configured") {
          console.log(
            "[mp4-muxer] Flushing VideoEncoder and finalizing MP4...",
          );
          await this.videoEncoder.flush();
          this.muxer.finalize();

          const { buffer } = this.muxer.target;
          const blob = new Blob([buffer], { type: "video/mp4" });
          const timestampString = getFormattedDate();
          const filename =
            customFilename ||
            `spherical-packing_${timestampString}_video.mp4`;

          const downloadLink = document.createElement("a");
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.download = filename;
          downloadLink.click();
          setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);

          console.log(`[mp4-muxer] Saved MP4 file: ${filename}`);
          return filename;
        }
      } catch (err) {
        console.error("[mp4-muxer finalize error]", err);
      } finally {
        try {
          this.videoEncoder?.close();
        } catch {
          // ignore
        }
        this.videoEncoder = null;
        this.muxer = null;
      }
      return null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      return new Promise<string | null>((resolve) => {
        if (!this.mediaRecorder) {
          resolve(null);
          return;
        }
        this.mediaRecorder.onstop = () => {
          const filename = this.saveMediaRecorderOutput();
          resolve(filename);
        };
        this.mediaRecorder.stop();
      });
    }
    return null;
  }

  private saveMediaRecorderOutput(): string {
    const timestampString = getFormattedDate();
    const filename = `spherical-packing_${timestampString}.webm`;

    const videoBlob = new Blob(this.recordedChunks, {
      type: "video/webm",
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(videoBlob);
    downloadLink.download = filename;
    downloadLink.click();
    setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);

    console.log(`[MediaRecorder] Saved WebM file: ${filename}`);
    return filename;
  }

  private startTimer() {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    const updateTimer = () => {
      const elapsedSec = Math.floor(
        (performance.now() - this.recordingStartTimestamp) / 1000,
      );
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(this.isRecording, elapsedSec);
      }
    };

    updateTimer();
    this.timerIntervalId = setInterval(updateTimer, 1000);
  }

  private stopTimer() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false, 0);
    }
  }
}
