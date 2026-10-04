import { atom } from "jotai";
import { colourPalettes } from "../constants/palettes";
import type {
  Palette,
  RandomTargets,
  RecordingState,
  SketchParams,
  SphericalCircle,
} from "../types/sketch";

const oceanicSlateIndex = colourPalettes.findIndex(
  (p) => p.title.toLowerCase() === "oceanic slate",
);
const defaultPaletteIndex = oceanicSlateIndex >= 0 ? oceanicSlateIndex : 0;

const initialParams: SketchParams = {
  morphProgress: 0.0,
  projectionScale: 0.6,
  projectionMethod: "winkel",
  packingAlgorithm: "relaxation",
  gridLayerMode: "underlay",
  isAutoMorph: true,
  rotationSpeed: 1.0,
  maxCircles: 380,
  minRadius: 0.02,
  maxRadius: 0.5,
  showStroke: false,
  strokeWeight: 1.5,
  circleSegments: 64,
  showGrid: true,
  activePaletteIndex: defaultPaletteIndex,
  isExclusiveBackground: true,
  showFilmGrain: true,
  isDebugMode: false,
};

export const sketchParamsAtom = atom<SketchParams>(initialParams);

export const activePaletteAtom = atom<Palette>(
  colourPalettes[defaultPaletteIndex] ?? colourPalettes[0],
);

export const circlesAtom = atom<SphericalCircle[]>([]);

export const randomTargetsAtom = atom<RandomTargets>({
  palette: true,
  projection: true,
  counts: true,
});

export const isPanelOpenAtom = atom<boolean>(true);

export const recordingStateAtom = atom<RecordingState>({
  isRecording: false,
  elapsedSeconds: 0,
});

export const isAutoCycleActiveAtom = atom<boolean>(false);
export const cycleIntervalMsAtom = atom<number>(4000);
export const targetLoopsCountAtom = atom<number>(2);

interface ToastItem {
  id: string;
  message: string;
  variant: "info" | "success" | "danger";
}

export const toastsAtom = atom<ToastItem[]>([]);

export const historyUndoAtom = atom<SketchParams[]>([]);
export const historyRedoAtom = atom<SketchParams[]>([]);
