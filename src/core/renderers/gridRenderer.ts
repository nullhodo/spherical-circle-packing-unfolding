import type p5 from "p5";
import type {
  GridLayerMode,
  MorphTransitionMode,
  Palette,
  ProjectionMethod,
} from "../../types/sketch";
import { computeMorphedPoint2D } from "../math/morphing";

interface GridRenderOptions {
  baseRadius: number;
  currentMorphProgress: number;
  projectionMethod: ProjectionMethod;
  projectionScaleMultiplier?: number;
  morphTransitionMode?: MorphTransitionMode;
  rotationAngleX: number;
  rotationAngleY: number;
  activePalette: Palette;
  isExclusiveBackground: boolean;
  isFrontLayer?: boolean;
  gridLayerMode?: GridLayerMode;
}

interface ProjectedSamplePoint {
  screenX: number;
  screenY: number;
  depthZ: number;
  lon: number;
  lat: number;
}

interface StaticGridSample {
  point3D: [number, number, number];
  lon: number;
  lat: number;
}

interface StaticGridLine {
  isKeyLine: boolean;
  samples: StaticGridSample[];
}

let CACHED_GRID_LINES: {
  parallels: StaticGridLine[];
  meridians: StaticGridLine[];
} | null = null;

function getStaticGridLines(): {
  parallels: StaticGridLine[];
  meridians: StaticGridLine[];
} {
  if (CACHED_GRID_LINES) return CACHED_GRID_LINES;

  const latitudeSteps = 12;
  const longitudeSteps = 24;
  const segmentResolution = 96;

  const parallels: StaticGridLine[] = [];
  for (let latIdx = 1; latIdx < latitudeSteps; latIdx++) {
    const lat = -Math.PI / 2 + (latIdx / latitudeSteps) * Math.PI;
    const isEquator = Math.abs(lat) < 0.05;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const samples: StaticGridSample[] = [];

    for (let step = 0; step <= segmentResolution; step++) {
      const lon = -Math.PI + (step / segmentResolution) * Math.PI * 2;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);
      samples.push({ point3D: [px, py, pz], lon, lat });
    }
    parallels.push({ isKeyLine: isEquator, samples });
  }

  const meridians: StaticGridLine[] = [];
  for (let lonIdx = 0; lonIdx <= longitudeSteps; lonIdx++) {
    const lon = -Math.PI + (lonIdx / longitudeSteps) * Math.PI * 2;
    const isSeamBorder = lonIdx === 0 || lonIdx === longitudeSteps;
    const isPrimeMeridian =
      Math.abs(lon) < 0.05 || Math.abs(Math.abs(lon) - Math.PI) < 0.05;
    const isKeyLine = isPrimeMeridian || isSeamBorder;
    const cosLon = Math.cos(lon);
    const sinLon = Math.sin(lon);
    const samples: StaticGridSample[] = [];

    for (let step = 0; step <= segmentResolution; step++) {
      const lat = -Math.PI / 2 + (step / segmentResolution) * Math.PI;
      const cosLat = Math.cos(lat);
      const py = Math.sin(lat);
      const px = cosLat * cosLon;
      const pz = cosLat * sinLon;
      samples.push({ point3D: [px, py, pz], lon, lat });
    }
    meridians.push({ isKeyLine, samples });
  }

  CACHED_GRID_LINES = { parallels, meridians };
  return CACHED_GRID_LINES;
}

/**
 * 球の表裏クリッピング境界で途切れた区間ごとにネイティブ Canvas2D でパスを描画
 */
function renderClippedPolyline(
  ctx: CanvasRenderingContext2D,
  points: ProjectedSamplePoint[],
  isFront: boolean,
  threshold: number,
  isUnclipped: boolean,
  samplePointFn: (lon: number, lat: number) => ProjectedSamplePoint,
): void {
  if (points.length < 2) return;

  if (isUnclipped) {
    ctx.beginPath();
    ctx.moveTo(points[0].screenX, points[0].screenY);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].screenX, points[i].screenY);
    }
    ctx.stroke();
    return;
  }

  let inStrip = false;

  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];

    const aVis = isFront ? pA.depthZ >= threshold : pA.depthZ < threshold;
    const bVis = isFront ? pB.depthZ >= threshold : pB.depthZ < threshold;

    if (aVis && bVis) {
      if (!inStrip) {
        ctx.beginPath();
        ctx.moveTo(pA.screenX, pA.screenY);
        inStrip = true;
      }
      ctx.lineTo(pB.screenX, pB.screenY);
    } else if (aVis && !bVis) {
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;

      const clipLon = pA.lon + t * (pB.lon - pA.lon);
      const clipLat = pA.lat + t * (pB.lat - pA.lat);
      const clipPoint = samplePointFn(clipLon, clipLat);

      if (!inStrip) {
        ctx.beginPath();
        ctx.moveTo(pA.screenX, pA.screenY);
        inStrip = true;
      }
      ctx.lineTo(clipPoint.screenX, clipPoint.screenY);
      ctx.stroke();
      inStrip = false;
    } else if (!aVis && bVis) {
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;

      const clipLon = pA.lon + t * (pB.lon - pA.lon);
      const clipLat = pA.lat + t * (pB.lat - pA.lat);
      const clipPoint = samplePointFn(clipLon, clipLat);

      ctx.beginPath();
      ctx.moveTo(clipPoint.screenX, clipPoint.screenY);
      ctx.lineTo(pB.screenX, pB.screenY);
      inStrip = true;
    } else {
      if (inStrip) {
        ctx.stroke();
        inStrip = false;
      }
    }
  }

  if (inStrip) {
    ctx.stroke();
  }
}

/**
 * 経線・緯線 (Graticule) を描画する関数
 * 事前サンプリングキャッシュと Canvas2D パス直接描画により超高速化
 */
export function renderGraticuleGridLines(
  p5Instance: p5,
  options: GridRenderOptions,
): void {
  const {
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier = 1.0,
    rotationAngleX,
    rotationAngleY,
    activePalette,
    isExclusiveBackground,
    isFrontLayer = true,
    gridLayerMode = "underlay",
    morphTransitionMode = "direct",
  } = options;

  const isUnderlay = gridLayerMode === "underlay";

  if (isUnderlay && isFrontLayer) {
    return;
  }

  if (!isUnderlay && !isFrontLayer && currentMorphProgress >= 0.4) {
    return;
  }

  const currentBg =
    isExclusiveBackground && activePalette.colors.length > 0
      ? activePalette.colors[0].rgb
      : [15, 23, 42];
  const backgroundBrightness =
    (currentBg[0] * 299 + currentBg[1] * 587 + currentBg[2] * 114) / 1000;

  const gridStrokeColor =
    backgroundBrightness > 128 ? [30, 41, 59] : [241, 245, 249];

  let baseAlpha = 140;
  if (isUnderlay) {
    baseAlpha = 150;
  } else {
    const morphFade = !isFrontLayer
      ? Math.max(0, 1 - currentMorphProgress * 2.5)
      : 1.0;
    baseAlpha = Math.round((isFrontLayer ? 140 : 70) * morphFade);
  }

  if (baseAlpha <= 0) {
    return;
  }

  const isUnclipped =
    isUnderlay || (isFrontLayer && currentMorphProgress >= 0.15);
  const depthThreshold = isFrontLayer ? -currentMorphProgress * 2.0 : 0.0;

  const morphFade = 1 - currentMorphProgress;
  let radiusBias = 0;
  if (isUnderlay) {
    radiusBias = -0.001 * morphFade;
  } else {
    radiusBias = isFrontLayer ? 0.005 * morphFade : -0.002 * morphFade;
  }
  const effectiveSphereRadius = baseRadius * (1 + radiusBias);

  const samplePoint = (lon: number, lat: number): ProjectedSamplePoint => {
    const cosLat = Math.cos(lat);
    const px = cosLat * Math.cos(lon);
    const py = Math.sin(lat);
    const pz = cosLat * Math.sin(lon);

    const res = computeMorphedPoint2D({
      point3D: [px, py, pz],
      lon,
      lat,
      baseRadius: effectiveSphereRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      transitionMode: morphTransitionMode,
    });

    return {
      screenX: res.x,
      screenY: res.y,
      depthZ: res.depthZ,
      lon,
      lat,
    };
  };

  const ctx = p5Instance.drawingContext as CanvasRenderingContext2D;
  const { parallels, meridians } = getStaticGridLines();

  // 1. 緯線（Parallels）
  for (let i = 0; i < parallels.length; i++) {
    const line = parallels[i];
    const alpha = line.isKeyLine
      ? Math.min(255, baseAlpha + 65)
      : baseAlpha;
    ctx.strokeStyle = `rgba(${gridStrokeColor[0]},${gridStrokeColor[1]},${gridStrokeColor[2]},${alpha / 255})`;
    ctx.lineWidth = line.isKeyLine ? 1.8 : 1.15;

    const points: ProjectedSamplePoint[] = new Array(line.samples.length);
    for (let s = 0; s < line.samples.length; s++) {
      const sample = line.samples[s];
      const res = computeMorphedPoint2D({
        point3D: sample.point3D,
        lon: sample.lon,
        lat: sample.lat,
        baseRadius: effectiveSphereRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode: morphTransitionMode,
      });
      points[s] = {
        screenX: res.x,
        screenY: res.y,
        depthZ: res.depthZ,
        lon: sample.lon,
        lat: sample.lat,
      };
    }

    renderClippedPolyline(
      ctx,
      points,
      isFrontLayer,
      depthThreshold,
      isUnclipped,
      samplePoint,
    );
  }

  // 2. 経線（Meridians）
  for (let i = 0; i < meridians.length; i++) {
    const line = meridians[i];
    const alpha = line.isKeyLine
      ? Math.min(255, baseAlpha + 65)
      : baseAlpha;
    ctx.strokeStyle = `rgba(${gridStrokeColor[0]},${gridStrokeColor[1]},${gridStrokeColor[2]},${alpha / 255})`;
    ctx.lineWidth = line.isKeyLine ? 1.8 : 1.15;

    const points: ProjectedSamplePoint[] = new Array(line.samples.length);
    for (let s = 0; s < line.samples.length; s++) {
      const sample = line.samples[s];
      const res = computeMorphedPoint2D({
        point3D: sample.point3D,
        lon: sample.lon,
        lat: sample.lat,
        baseRadius: effectiveSphereRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode: morphTransitionMode,
      });
      points[s] = {
        screenX: res.x,
        screenY: res.y,
        depthZ: res.depthZ,
        lon: sample.lon,
        lat: sample.lat,
      };
    }

    renderClippedPolyline(
      ctx,
      points,
      isFrontLayer,
      depthThreshold,
      isUnclipped,
      samplePoint,
    );
  }
}
