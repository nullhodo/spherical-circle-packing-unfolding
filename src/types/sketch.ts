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

export type PackingAlgorithm = "relaxation" | "hierarchical" | "random";

export interface SketchParams {
  morphProgress: number; // 0 (Sphere 3D) to 1 (Planar Map 2D)
  projectionScale: number;
  projectionMethod: ProjectionMethod;
  packingAlgorithm: PackingAlgorithm;
  isAutoMorph: boolean;
  rotationSpeed: number;
  maxCircles: number;
  minRadius: number;
  maxRadius: number;
  showStroke: boolean;
  strokeWeight: number;
  circleSegments: number;
  showGrid: boolean;
  activePaletteIndex: number;
  isExclusiveBackground: boolean;
  showFilmGrain: boolean;
  isDebugMode: boolean;
}

export interface RandomTargets {
  palette: boolean;
  projection: boolean;
  counts: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  elapsedSeconds: number;
  currentLoop?: number;
  totalLoops?: number;
}
