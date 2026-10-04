import type p5 from "p5";
import type {
  GridLayerMode,
  Palette,
  ProjectionMethod,
} from "../../types/sketch";
import { projectSphericalCoordinatesToPlane } from "../math/projections";
import { applySphereOrientationRotation } from "../math/rotation";

interface GridRenderOptions {
  baseRadius: number;
  currentMorphProgress: number;
  projectionMethod: ProjectionMethod;
  projectionScaleMultiplier?: number;
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

/**
 * 球の表裏クリッピング境界で途切れた区間ごとに
 * beginShape / vertex / endShape を安全に呼び出すヘルパー関数
 * 解決策 3: 境界点補間は画面2D直線ではなく、真の球面3D投影点を用いて輪郭Jitterを排除
 */
function renderClippedPolyline(
  p5Instance: p5,
  points: ProjectedSamplePoint[],
  isFront: boolean,
  threshold: number,
  isUnclipped: boolean,
  samplePointFn: (lon: number, lat: number) => ProjectedSamplePoint,
): void {
  if (points.length < 2) return;

  // モーフィング展開時またはアンダーレイ全描画時は全頂点を一本の連続パスとして描画
  if (isUnclipped) {
    p5Instance.beginShape();
    for (let i = 0; i < points.length; i++) {
      p5Instance.vertex(points[i].screenX, points[i].screenY);
    }
    p5Instance.endShape();
    return;
  }

  let currentStrip: { x: number; y: number }[] | null = null;

  const flushStrip = () => {
    if (currentStrip && currentStrip.length >= 2) {
      p5Instance.beginShape();
      for (let i = 0; i < currentStrip.length; i++) {
        p5Instance.vertex(currentStrip[i].x, currentStrip[i].y);
      }
      p5Instance.endShape();
    }
    currentStrip = null;
  };

  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];

    const aVis = isFront ? pA.depthZ >= threshold : pA.depthZ < threshold;
    const bVis = isFront ? pB.depthZ >= threshold : pB.depthZ < threshold;

    if (aVis && bVis) {
      // 両端点ともに可視
      if (!currentStrip) {
        currentStrip = [
          { x: pA.screenX, y: pA.screenY },
          { x: pB.screenX, y: pB.screenY },
        ];
      } else {
        currentStrip.push({ x: pB.screenX, y: pB.screenY });
      }
    } else if (aVis && !bVis) {
      // pA は可視、pB は不可視 -> 真の球面境界点で打ち切り
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;

      const clipLon = pA.lon + t * (pB.lon - pA.lon);
      const clipLat = pA.lat + t * (pB.lat - pA.lat);
      const clipPoint = samplePointFn(clipLon, clipLat);

      if (!currentStrip) {
        currentStrip = [
          { x: pA.screenX, y: pA.screenY },
          { x: clipPoint.screenX, y: clipPoint.screenY },
        ];
      } else {
        currentStrip.push({
          x: clipPoint.screenX,
          y: clipPoint.screenY,
        });
      }
      flushStrip();
    } else if (!aVis && bVis) {
      // pA は不可視、pB は可視 -> 真の球面境界点から開始
      flushStrip();
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;

      const clipLon = pA.lon + t * (pB.lon - pA.lon);
      const clipLat = pA.lat + t * (pB.lat - pA.lat);
      const clipPoint = samplePointFn(clipLon, clipLat);

      currentStrip = [
        { x: clipPoint.screenX, y: clipPoint.screenY },
        { x: pB.screenX, y: pB.screenY },
      ];
    } else {
      // 両端点とも不可視
      flushStrip();
    }
  }
  flushStrip();
}

/**
 * 経度・緯度から3D回転および平面投影を合成したスクリーン座標を計算
 */
function sampleSphericalPoint(
  longitudeAngle: number,
  latitudeAngle: number,
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotationAngleX: number,
  rotationAngleY: number,
  isFrontLayer = true,
  isUnderlay = false,
): ProjectedSamplePoint {
  const px = Math.cos(latitudeAngle) * Math.cos(longitudeAngle);
  const py = Math.sin(latitudeAngle);
  const pz = Math.cos(latitudeAngle) * Math.sin(longitudeAngle);

  const rotated3D = applySphereOrientationRotation(
    [px, py, pz],
    rotationAngleX,
    rotationAngleY,
  );

  const projected2D = projectSphericalCoordinatesToPlane(
    longitudeAngle,
    latitudeAngle,
    baseRadius,
    projectionMethod,
    projectionScaleMultiplier,
  );

  // 半径バイアス (Depth Bias):
  // アンダーレイ時は円の直下 (baseRadius * 0.999) に安定配置
  // オーバーレイ前面時は円の表面より +0.5% (約+1.2px) 浮かす
  const morphFade = 1 - currentMorphProgress;
  let radiusBias = 0;
  if (isUnderlay) {
    radiusBias = -0.001 * morphFade;
  } else {
    radiusBias = isFrontLayer ? 0.005 * morphFade : -0.002 * morphFade;
  }
  const effectiveSphereRadius = baseRadius * (1 + radiusBias);

  const screenX =
    rotated3D.screenX *
      effectiveSphereRadius *
      (1 - currentMorphProgress) +
    projected2D.planarX * currentMorphProgress;
  const screenY =
    rotated3D.screenY *
      effectiveSphereRadius *
      (1 - currentMorphProgress) +
    projected2D.planarY * currentMorphProgress;

  return {
    screenX,
    screenY,
    depthZ: rotated3D.depthZ,
    lon: longitudeAngle,
    lat: latitudeAngle,
  };
}

/**
 * 経線・緯線 (Graticule) を描画する関数
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
  } = options;

  const isUnderlay = gridLayerMode === "underlay";

  // 【解決策 1: アンダーレイ方式】
  // グリッドを円の背後 (下層) に敷く場合:
  // 円の描画前 (isFrontLayer === false) に全球のグリッドを完全描画し、
  // 円の描画後 (isFrontLayer === true) は何も描画しない (チラつきを完全ゼロ化)
  if (isUnderlay && isFrontLayer) {
    return;
  }

  // オーバーレイ時: 背面レイヤーはモーフィング進行に伴いフェードアウト
  if (!isUnderlay && !isFrontLayer && currentMorphProgress >= 0.4) {
    return;
  }

  p5Instance.push();
  p5Instance.noFill();

  // 現在の背景色に基づいて明暗コントラストの高いグリッド色を算出
  const currentBg =
    isExclusiveBackground && activePalette.colors.length > 0
      ? activePalette.colors[0].rgb
      : [15, 23, 42];
  const backgroundBrightness =
    (currentBg[0] * 299 + currentBg[1] * 587 + currentBg[2] * 114) / 1000;

  const gridStrokeColor =
    backgroundBrightness > 128 ? [30, 41, 59] : [241, 245, 249];

  // 不透明度
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
    p5Instance.pop();
    return;
  }

  // アンダーレイ時は常に全球のグリッドを一本の連続パスとして全描画 (クリッピング不要・途切れゼロ)
  // オーバーレイ時はモーフィング展開進行に伴いクリッピング解除
  const isUnclipped =
    isUnderlay || (isFrontLayer && currentMorphProgress >= 0.15);
  const depthThreshold = isFrontLayer ? -currentMorphProgress * 2.0 : 0.0;

  const latitudeSteps = 12;
  const longitudeSteps = 24;
  const segmentResolution = 96;

  const samplePoint = (lon: number, lat: number): ProjectedSamplePoint =>
    sampleSphericalPoint(
      lon,
      lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      isFrontLayer,
      isUnderlay,
    );

  // 1. 緯線（Parallels: 赤道を含む）
  for (
    let latitudeIndex = 1;
    latitudeIndex < latitudeSteps;
    latitudeIndex++
  ) {
    const latitudeAngle =
      -Math.PI / 2 + (latitudeIndex / latitudeSteps) * Math.PI;
    const isEquator = Math.abs(latitudeAngle) < 0.05;

    p5Instance.stroke(
      gridStrokeColor[0],
      gridStrokeColor[1],
      gridStrokeColor[2],
      isEquator ? Math.min(255, baseAlpha + 65) : baseAlpha,
    );
    p5Instance.strokeWeight(isEquator ? 1.8 : 1.15);

    const points: ProjectedSamplePoint[] = [];
    for (
      let segmentIndex = 0;
      segmentIndex <= segmentResolution;
      segmentIndex++
    ) {
      const longitudeAngle =
        -Math.PI + (segmentIndex / segmentResolution) * Math.PI * 2;
      points.push(samplePoint(longitudeAngle, latitudeAngle));
    }

    renderClippedPolyline(
      p5Instance,
      points,
      isFrontLayer,
      depthThreshold,
      isUnclipped,
      samplePoint,
    );
  }

  // 2. 経線（Meridians: 本初子午線およびちぎる経線の両側を含む）
  for (
    let longitudeIndex = 0;
    longitudeIndex <= longitudeSteps;
    longitudeIndex++
  ) {
    const longitudeAngle =
      -Math.PI + (longitudeIndex / longitudeSteps) * Math.PI * 2;

    const isSeamBorder =
      longitudeIndex === 0 || longitudeIndex === longitudeSteps;
    const isPrimeMeridian =
      Math.abs(longitudeAngle) < 0.05 ||
      Math.abs(Math.abs(longitudeAngle) - Math.PI) < 0.05;

    const isKeyLine = isPrimeMeridian || isSeamBorder;

    p5Instance.stroke(
      gridStrokeColor[0],
      gridStrokeColor[1],
      gridStrokeColor[2],
      isKeyLine ? Math.min(255, baseAlpha + 65) : baseAlpha,
    );
    p5Instance.strokeWeight(isKeyLine ? 1.8 : 1.15);

    const points: ProjectedSamplePoint[] = [];
    for (
      let segmentIndex = 0;
      segmentIndex <= segmentResolution;
      segmentIndex++
    ) {
      const latitudeAngle =
        -Math.PI / 2 + (segmentIndex / segmentResolution) * Math.PI;
      points.push(samplePoint(longitudeAngle, latitudeAngle));
    }

    renderClippedPolyline(
      p5Instance,
      points,
      isFrontLayer,
      depthThreshold,
      isUnclipped,
      samplePoint,
    );
  }

  p5Instance.pop();
}
