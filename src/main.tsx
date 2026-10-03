import { useAtom } from "jotai";
import p5 from "p5";
import p5Svg from "p5.js-svg";
import type React from "react";
import { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { ControlPanel } from "./components/ControlPanel";
import { RecordingOverlay } from "./components/RecordingOverlay";
import { ToastNotification } from "./components/ToastNotification";
import {
  exportHighResolutionImage,
  exportJsonSettings,
  exportSvgGraphics,
} from "./core/exporter";
import { VideoRecorderManager } from "./core/recorder";
import { renderPackedCirclesGeometry } from "./core/renderers/circleRenderer";
import { renderDebugInformationOverlay } from "./core/renderers/debugOverlay";
import { createFilmGrainTextureBuffer } from "./core/renderers/grainBuffer";
import { renderGraticuleGridLines } from "./core/renderers/gridRenderer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSketchHandlers } from "./hooks/useSketchHandlers";
import "./index.css";
import {
  activePaletteAtom,
  circlesAtom,
  cycleIntervalMsAtom,
  isAutoCycleActiveAtom,
  isPanelOpenAtom,
  recordingStateAtom,
  sketchParamsAtom,
  targetLoopsCountAtom,
} from "./state/sketchStore";

// Initialize p5 SVG plugin
p5Svg(p5);

// Set [DEV] title prefix in local development mode
if (import.meta.env.DEV && !document.title.startsWith("[DEV]")) {
  document.title = `[DEV] ${document.title}`;
}

const App: React.FC = () => {
  const [params] = useAtom(sketchParamsAtom);
  const [activePalette] = useAtom(activePaletteAtom);
  const [circles] = useAtom(circlesAtom);
  const [, setRecordingState] = useAtom(recordingStateAtom);
  const [isPanelOpen, setIsPanelOpen] = useAtom(isPanelOpenAtom);
  const [isAutoCycle, setIsAutoCycle] = useAtom(isAutoCycleActiveAtom);
  const [cycleIntervalMs] = useAtom(cycleIntervalMsAtom);
  const [targetLoops] = useAtom(targetLoopsCountAtom);

  const p5ContainerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const recorderRef = useRef<VideoRecorderManager | null>(null);

  const paramsRef = useRef(params);
  const activePaletteRef = useRef(activePalette);
  const circlesRef = useRef(circles);
  const isAutoCycleRef = useRef(isAutoCycle);
  const cycleIntervalMsRef = useRef(cycleIntervalMs);
  const targetLoopsRef = useRef(targetLoops);
  const isPanelOpenRef = useRef(isPanelOpen);

  // Rotation & Animation state refs
  const rotationXRef = useRef(0.2);
  const rotationYRef = useRef(0.0);
  const morphPhaseAngleRef = useRef(0.0);
  const isDraggingCanvasRef = useRef(false);
  const prevMouseXRef = useRef(0);
  const prevMouseYRef = useRef(0);

  const loopTimerRef = useRef<{
    timeouts: ReturnType<typeof setTimeout>[];
    intervalId?: ReturnType<typeof setInterval>;
  }>({ timeouts: [] });

  const clearLoopTimers = () => {
    for (const t of loopTimerRef.current.timeouts) clearTimeout(t);
    loopTimerRef.current.timeouts = [];
    if (loopTimerRef.current.intervalId) {
      clearInterval(loopTimerRef.current.intervalId);
      loopTimerRef.current.intervalId = undefined;
    }
  };

  useEffect(() => {
    paramsRef.current = params;
    if (!params.isAutoMorph) {
      morphPhaseAngleRef.current = Math.acos(
        Math.max(-1, Math.min(1, 1 - 2 * params.morphProgress)),
      );
    }
  }, [params]);

  useEffect(() => {
    activePaletteRef.current = activePalette;
  }, [activePalette]);

  useEffect(() => {
    circlesRef.current = circles;
  }, [circles]);

  useEffect(() => {
    isAutoCycleRef.current = isAutoCycle;
  }, [isAutoCycle]);

  useEffect(() => {
    cycleIntervalMsRef.current = cycleIntervalMs;
  }, [cycleIntervalMs]);

  useEffect(() => {
    targetLoopsRef.current = targetLoops;
  }, [targetLoops]);

  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  const {
    handleParamChange,
    recomputePacking,
    handleApplyPalette,
    handlePickRandomPalette,
    handleGenerateGradientTheme,
    randomizeSelectedParameters,
    handleUndo,
    handleRedo,
    handleImportJson,
    showToast,
  } = useSketchHandlers();

  // Initial packing generation on mount only
  useEffect(() => {
    recomputePacking();
  }, []);

  // Video recording handlers
  const handleStartRecord = async () => {
    if (recorderRef.current) {
      clearLoopTimers();
      const success = await recorderRef.current.startRecording();
      if (success) {
        setRecordingState({
          isRecording: true,
          elapsedSeconds: 0,
        });
        showToast("MP4 録画を開始しました", "info");
      }
    }
  };

  const handleStopRecord = async () => {
    clearLoopTimers();
    if (recorderRef.current) {
      const savedFile = await recorderRef.current.stopRecording();
      setRecordingState({
        isRecording: false,
        elapsedSeconds: 0,
      });
      if (savedFile) {
        showToast(`録画動画を保存しました: ${savedFile}`, "success");
      }
    }
  };

  const handleStartNLoopRecord = async () => {
    if (!recorderRef.current) return;
    clearLoopTimers();
    setIsAutoCycle(false);

    const N = targetLoopsRef.current;
    const T = cycleIntervalMsRef.current;

    setRecordingState({
      isRecording: true,
      elapsedSeconds: 0,
      currentLoop: 1,
      totalLoops: N,
    });

    const success = await recorderRef.current.startRecording();
    if (!success) return;

    randomizeSelectedParameters();
    const startTime = performance.now();

    const timerId = setInterval(() => {
      const elapsedMs = performance.now() - startTime;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const currLoop = Math.min(N, Math.floor(elapsedMs / T) + 1);
      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        elapsedSeconds: elapsedSec,
        currentLoop: currLoop,
        totalLoops: N,
      }));
    }, 100);
    loopTimerRef.current.intervalId = timerId;

    for (let k = 1; k < N; k++) {
      const timeout = setTimeout(() => {
        randomizeSelectedParameters();
      }, k * T);
      loopTimerRef.current.timeouts.push(timeout);
    }

    const finalTimeout = setTimeout(async () => {
      clearLoopTimers();
      if (recorderRef.current) {
        const savedFile = await recorderRef.current.stopRecording();
        setRecordingState({
          isRecording: false,
          elapsedSeconds: 0,
        });
        if (savedFile) {
          showToast(`Nループ録画を完了しました: ${savedFile}`, "success");
        }
        exportJsonSettings(
          paramsRef.current,
          undefined,
          activePaletteRef.current,
          circlesRef.current.length,
        );
      }
    }, N * T);
    loopTimerRef.current.timeouts.push(finalTimeout);
  };

  const handleExportHighRes = () => {
    exportHighResolutionImage(
      paramsRef.current,
      circlesRef.current,
      activePaletteRef.current,
      rotationXRef.current,
      rotationYRef.current,
    );
    showToast("高解像度 PNG と JSON を出力しました", "success");
  };

  const handleExportSvg = () => {
    exportSvgGraphics(
      paramsRef.current,
      circlesRef.current,
      activePaletteRef.current,
      rotationXRef.current,
      rotationYRef.current,
    );
    showToast("ベクター SVG を出力しました", "success");
  };

  const handleExportJson = () => {
    exportJsonSettings(
      paramsRef.current,
      undefined,
      activePaletteRef.current,
      circlesRef.current.length,
    );
    showToast("設定 JSON を保存しました", "success");
  };

  useKeyboardShortcuts({
    onStartRecord: handleStartRecord,
    onStopRecord: handleStopRecord,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onTogglePanel: () => setIsPanelOpen((prev) => !prev),
    onToggleDebug: () =>
      handleParamChange("isDebugMode", !paramsRef.current.isDebugMode),
    onToggleAutoMorph: () =>
      handleParamChange("isAutoMorph", !paramsRef.current.isAutoMorph),
  });

  // p5 Sketch Lifecycle
  useEffect(() => {
    if (!p5ContainerRef.current) return;

    let grainBuffer: p5.Graphics | null = null;
    let lastCycleTimestamp = performance.now();

    const sketch = (p: p5) => {
      p.setup = () => {
        const container = p5ContainerRef.current;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;

        const canvas = p.createCanvas(width, height);
        if (container) {
          canvas.parent(container);
        }
        p.frameRate(60);
        p.smooth();

        grainBuffer = createFilmGrainTextureBuffer(p, width, height);

        // Initialize VideoRecorderManager
        const htmlCanvas = canvas.elt as HTMLCanvasElement;
        recorderRef.current = new VideoRecorderManager(
          htmlCanvas,
          (recording, elapsedSec) => {
            setRecordingState((prev) => ({
              ...prev,
              isRecording: recording,
              elapsedSeconds: elapsedSec,
            }));
          },
        );
      };

      p.windowResized = () => {
        const container = p5ContainerRef.current;
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        p.resizeCanvas(width, height);
        grainBuffer = createFilmGrainTextureBuffer(p, width, height);
      };

      p.draw = () => {
        const currentParams = paramsRef.current;
        const currentPalette = activePaletteRef.current;
        const currentCircles = circlesRef.current;

        // Background color
        let bgRgb = [15, 23, 42];
        if (
          currentParams.isExclusiveBackground &&
          currentPalette.colors.length > 0
        ) {
          bgRgb = currentPalette.colors[0].rgb;
        }
        p.background(bgRgb[0], bgRgb[1], bgRgb[2]);

        // Auto morphing sine animation
        if (currentParams.isAutoMorph) {
          morphPhaseAngleRef.current += 0.01 * currentParams.rotationSpeed;
          const nextMorph =
            0.5 - 0.5 * Math.cos(morphPhaseAngleRef.current);
          currentParams.morphProgress = nextMorph;
        }

        // Auto rotation
        if (!isDraggingCanvasRef.current) {
          rotationYRef.current +=
            0.008 *
            currentParams.rotationSpeed *
            (1.0 - currentParams.morphProgress * 0.85);
        }

        // Auto cycle timer
        if (isAutoCycleRef.current) {
          const now = performance.now();
          if (now - lastCycleTimestamp > cycleIntervalMsRef.current) {
            lastCycleTimestamp = now;
            randomizeSelectedParameters();
          }
        }

        const sphereRadius = Math.min(p.width, p.height) * 0.28;

        p.push();
        p.translate(p.width / 2, p.height / 2);

        // Background layer graticule grid lines
        if (currentParams.showGrid) {
          renderGraticuleGridLines(p, {
            baseRadius: sphereRadius,
            currentMorphProgress: currentParams.morphProgress,
            projectionMethod: currentParams.projectionMethod,
            projectionScaleMultiplier: currentParams.projectionScale,
            rotationAngleX: rotationXRef.current,
            rotationAngleY: rotationYRef.current,
            activePalette: currentPalette,
            isExclusiveBackground: currentParams.isExclusiveBackground,
            isFrontLayer: false,
          });
        }

        // Circle packing geometry
        renderPackedCirclesGeometry(p, {
          circles: currentCircles,
          baseRadius: sphereRadius,
          currentMorphProgress: currentParams.morphProgress,
          projectionMethod: currentParams.projectionMethod,
          projectionScaleMultiplier: currentParams.projectionScale,
          rotationAngleX: rotationXRef.current,
          rotationAngleY: rotationYRef.current,
          showStroke: currentParams.showStroke,
          strokeWeight: currentParams.strokeWeight,
          circleSegments: currentParams.circleSegments,
        });

        // Front layer graticule grid lines
        if (currentParams.showGrid) {
          renderGraticuleGridLines(p, {
            baseRadius: sphereRadius,
            currentMorphProgress: currentParams.morphProgress,
            projectionMethod: currentParams.projectionMethod,
            projectionScaleMultiplier: currentParams.projectionScale,
            rotationAngleX: rotationXRef.current,
            rotationAngleY: rotationYRef.current,
            activePalette: currentPalette,
            isExclusiveBackground: currentParams.isExclusiveBackground,
            isFrontLayer: true,
          });
        }

        p.pop();

        // Film grain overlay
        if (currentParams.showFilmGrain && grainBuffer) {
          p.push();
          p.blendMode(p.OVERLAY);
          p.image(grainBuffer, 0, 0, p.width, p.height);
          p.blendMode(p.BLEND);
          p.pop();
        }

        // HUD Debug overlay
        if (currentParams.isDebugMode) {
          renderDebugInformationOverlay(
            p,
            currentParams,
            currentCircles.length,
            sphereRadius,
          );
        }
      };

      p.mousePressed = () => {
        // Prevent rotation when interacting with control panel
        if (p.mouseX < 380 && isPanelOpenRef.current) return;
        isDraggingCanvasRef.current = true;
        prevMouseXRef.current = p.mouseX;
        prevMouseYRef.current = p.mouseY;
      };

      p.mouseDragged = () => {
        if (!isDraggingCanvasRef.current) return;
        const deltaX = p.mouseX - prevMouseXRef.current;
        const deltaY = p.mouseY - prevMouseYRef.current;

        rotationYRef.current += deltaX * 0.008;
        rotationXRef.current = Math.max(
          -Math.PI * 0.45,
          Math.min(Math.PI * 0.45, rotationXRef.current + deltaY * 0.008),
        );

        prevMouseXRef.current = p.mouseX;
        prevMouseYRef.current = p.mouseY;
      };

      p.mouseReleased = () => {
        isDraggingCanvasRef.current = false;
      };
    };

    const p5Instance = new p5(sketch);
    p5InstanceRef.current = p5Instance;

    return () => {
      clearLoopTimers();
      p5Instance.remove();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* p5 Canvas Container */}
      <div
        ref={p5ContainerRef}
        className="absolute inset-0 w-full h-full flex items-center justify-center"
      />

      {/* Control Panel Sidebar */}
      <ControlPanel
        onParamChange={handleParamChange}
        onRecomputePacking={recomputePacking}
        onApplyPalette={handleApplyPalette}
        onPickRandomPalette={handlePickRandomPalette}
        onGenerateGradientTheme={handleGenerateGradientTheme}
        onRandomizeAll={randomizeSelectedParameters}
        onStartNLoopRecord={handleStartNLoopRecord}
        onExportHighRes={handleExportHighRes}
        onExportSvg={handleExportSvg}
        onStartRecord={handleStartRecord}
        onStopRecord={handleStopRecord}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Recording Overlay */}
      <RecordingOverlay />

      {/* Toast Notifications */}
      <ToastNotification />
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
