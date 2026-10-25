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
  projectionMethod: "mercator",
  morphTransitionMode: "cylinder",
  packingAlgorithm: "maximal",
  gridLayerMode: "underlay",
  isAutoMorph: true,
  rotationSpeed: 1.0,
  morphSpeed: 2.5,
  maxCircles: 380,
  minRadius: 0.02,
  maxRadius: 0.5,
  showStroke: false,
  strokeWeight: 1.5,
  circleSegments: 96,
  fitSphericalSurface: true,
  domeRings: 6,
  showGrid: true,
  activePaletteIndex: defaultPaletteIndex,
  isExclusiveBackground: true,
  seamLongitude: Math.PI,
  randomizeSeamOnLoop: false,
  showFilmGrain: true,
  isDebugMode: false,
};

export const liveMorphProgress = { value: 0.0 };

export const sketchParamsAtom = atom<SketchParams>(initialParams);

export const activePaletteAtom = atom<Palette>(
  colourPalettes[defaultPaletteIndex] ?? colourPalettes[0],
);

export const circlesAtom = atom<SphericalCircle[]>([]);

export const randomTargetsAtom = atom<RandomTargets>({
  palette: true,
  paletteShuffle: true,
  projectionMethod: true,
  morphTransitionMode: false,
  projectionScale: false,
  seamLongitude: true,
  rotationSpeed: false,
  morphSpeed: false,
  maxCircles: true,
  minRadius: true,
  maxRadius: true,
  showStroke: true,
  strokeWeight: false,
  circleSegments: false,
  domeRings: false,
  showGrid: false,
  isExclusiveBackground: true,
});

export const isRandomTargetsModalOpenAtom = atom<boolean>(false);

export const isPanelOpenAtom = atom<boolean>(true);

export const recordingStateAtom = atom<RecordingState>({
  isRecording: false,
  elapsedSeconds: 0,
  isLoopMode: false,
  currentLoop: 1,
  totalLoops: 2,
  loopIntervalMs: 4000,
});

export const isAutoCycleActiveAtom = atom<boolean>(false);
export const cycleIntervalMsAtom = atom<number>(4000);
export const autoRandomIntervalMsAtom = cycleIntervalMsAtom;
export const isAutoRandomActiveAtom = isAutoCycleActiveAtom;
export const targetLoopsCountAtom = atom<number>(2);

interface ToastItem {
  id: string;
  message: string;
  variant: "info" | "success" | "danger";
}

export const toastsAtom = atom<ToastItem[]>([]);

export const historyUndoAtom = atom<SketchParams[]>([]);
export const historyRedoAtom = atom<SketchParams[]>([]);
