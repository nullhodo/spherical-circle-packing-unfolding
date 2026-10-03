import * as Mp4Muxer from "mp4-muxer";
import { getFormattedDate } from "../utils/date";

export class VideoRecorderManager {
  private isRecording = false;
  private canvasElement: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;

  // mp4-muxer / WebCodecs properties
  private muxer: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget> | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private recordingStartTimestamp = 0;
  private lastCapturedTimestamp = 0;
  private lastEncodedMicroseconds = -1;
  private frameCounter = 0;

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

    const width = this.canvasElement.width || 800;
    const height = this.canvasElement.height || 600;

    // Even dimensions requirement for H.264
    const roundedWidth = width % 2 === 0 ? width : width - 1;
    const roundedHeight = height % 2 === 0 ? height : height - 1;

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
          error: (e) => console.error("[mp4-muxer Encoder Error]", e),
        });

        // Use H.264 High Profile Level 5.1 (avc1.640033) or Baseline Level 5.1 (avc1.420033)
        const codecString = "avc1.640033";
        const encoderConfig: VideoEncoderConfig = {
          codec: codecString,
          width: roundedWidth,
          height: roundedHeight,
          bitrate: 15_000_000,
          framerate: 60,
        };

        const support =
          await VideoEncoder.isConfigSupported(encoderConfig);
        if (support.supported && support.config) {
          await this.videoEncoder.configure(support.config);
        } else {
          await this.videoEncoder.configure({
            codec: "avc1.420033",
            width: roundedWidth,
            height: roundedHeight,
            bitrate: 15_000_000,
            framerate: 60,
          });
        }

        this.isRecording = true;
        this.recordingStartTimestamp = performance.now();
        this.lastCapturedTimestamp = performance.now();
        this.lastEncodedMicroseconds = -1;
        this.frameCounter = 0;

        this.startTimer();
        this.captureFrameLoop();
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
      this.recordingStartTimestamp = Date.now();

      this.startTimer();
      return true;
    } catch (e) {
      console.error("[VideoRecorder] Failed to start recording:", e);
      return false;
    }
  }

  private captureFrameLoop = () => {
    if (!this.isRecording || !this.canvasElement || !this.videoEncoder)
      return;

    const now = performance.now();
    const elapsedSinceLastFrame = now - this.lastCapturedTimestamp;
    const targetInterval = 1000 / 60; // 16.666ms (60fps)

    if (
      this.frameCounter === 0 ||
      elapsedSinceLastFrame >= targetInterval - 1
    ) {
      try {
        let frameTimestampMicroseconds = 0;
        if (this.frameCounter === 0) {
          this.recordingStartTimestamp = now;
          frameTimestampMicroseconds = 0;
          this.lastEncodedMicroseconds = 0;
        } else {
          const rawMicroseconds = Math.round(
            (now - this.recordingStartTimestamp) * 1000,
          );
          frameTimestampMicroseconds = Math.max(
            rawMicroseconds,
            this.lastEncodedMicroseconds + 1000,
          );
          this.lastEncodedMicroseconds = frameTimestampMicroseconds;
        }
        this.lastCapturedTimestamp = now;

        const keyFrame = this.frameCounter % 60 === 0;

        const videoFrame = new VideoFrame(this.canvasElement, {
          timestamp: frameTimestampMicroseconds,
        });

        this.videoEncoder.encode(videoFrame, { keyFrame });
        videoFrame.close();

        this.frameCounter++;
      } catch (e) {
        console.error("[mp4-muxer] Error encoding frame:", e);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.captureFrameLoop);
  };

  public async stopRecording(
    customFilename?: string,
  ): Promise<string | null> {
    if (!this.isRecording) return null;

    this.isRecording = false;
    this.stopTimer();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.videoEncoder && this.muxer) {
      try {
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
        URL.revokeObjectURL(downloadLink.href);

        console.log(`[mp4-muxer] Saved MP4 file: ${filename}`);
        return filename;
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
      this.mediaRecorder.stop();
    }
    return null;
  }

  private saveMediaRecorderOutput() {
    const timestampString = getFormattedDate();
    const filename = `spherical-packing_${timestampString}.webm`;

    const videoBlob = new Blob(this.recordedChunks, {
      type: "video/webm",
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(videoBlob);
    downloadLink.download = filename;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);

    console.log(`[MediaRecorder] Saved WebM file: ${filename}`);
  }

  private startTimer() {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    const updateTimer = () => {
      const elapsedSec = Math.floor(
        (Date.now() - this.recordingStartTimestamp) / 1000,
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
