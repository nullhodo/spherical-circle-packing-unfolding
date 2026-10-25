export type ColorRGB = [number, number, number];

export interface ColorItem {
  name: string;
  hex: string;
  rgb: ColorRGB;
}

export interface Palette {
  title: string;
  comment?: string;
  colors: ColorItem[];
}

export interface SphericalCircle {
  id: number;
  normalVector: [number, number, number];
  basisVectorU: [number, number, number];
  basisVectorV: [number, number, number];
  angularRadius: number;
  longitude: number;
  latitude: number;
  primaryColor: ColorRGB;
  secondaryColor: ColorRGB;
  primaryHex: string;
}

export type ProjectionMethod =
  | "winkel"
  | "mercator"
  | "azimuthal"
  | "orthographic2d"
  | "mollweide";

export type PackingAlgorithm = "maximal" | "powerlaw" | "random";
export type GridLayerMode = "underlay" | "overlay";
export type MorphTransitionMode = "direct" | "cylinder" | "unroll";

export interface SketchParams {
  morphProgress: number; // 0 (Sphere 3D) to 1 (Planar Map 2D)
  projectionScale: number;
  projectionMethod: ProjectionMethod;
  morphTransitionMode: MorphTransitionMode;
  packingAlgorithm: PackingAlgorithm;
  gridLayerMode: GridLayerMode;
  isAutoMorph: boolean;
  rotationSpeed: number;
  morphSpeed: number;
  maxCircles: number;
  minRadius: number;
  maxRadius: number;
  showStroke: boolean;
  strokeWeight: number;
  circleSegments: number;
  fitSphericalSurface: boolean;
  domeRings: number;
  showGrid: boolean;
  activePaletteIndex: number;
  isExclusiveBackground: boolean;
  seamLongitude: number; // 切り分け経線 (-PI 〜 PI)
  randomizeSeamOnLoop: boolean; // ループごとに切り分け経線をランダムにするか
  showFilmGrain: boolean;
  isDebugMode: boolean;
}

export interface RandomTargets {
  palette: boolean;
  paletteShuffle: boolean;
  projectionMethod: boolean;
  morphTransitionMode: boolean;
  projectionScale: boolean;
  seamLongitude: boolean;
  rotationSpeed: boolean;
  morphSpeed: boolean;
  maxCircles: boolean;
  minRadius: boolean;
  maxRadius: boolean;
  showStroke: boolean;
  strokeWeight: boolean;
  circleSegments: boolean;
  domeRings: boolean;
  showGrid: boolean;
  isExclusiveBackground: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  elapsedSeconds: number;
  isLoopMode?: boolean;
  currentLoop?: number;
  totalLoops?: number;
  loopIntervalMs?: number;
}
