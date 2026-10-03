import type p5 from "p5";
import type { Palette, ProjectionMethod } from "../../types/sketch";
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
}

interface ProjectedSamplePoint {
  screenX: number;
  screenY: number;
  depthZ: number;
}

/**
 * 球の表裏クリッピング境界で途切れた区間ごとに
 * beginShape / vertex / endShape を安全に呼び出すヘルパー関数
 */
function renderClippedPolyline(
  p5Instance: p5,
  points: ProjectedSamplePoint[],
  isFront: boolean,
  threshold: number,
): void {
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
      // pA は可視、pB は不可視 -> 境界で打ち切り
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;
      const clipX = pA.screenX + t * (pB.screenX - pA.screenX);
      const clipY = pA.screenY + t * (pB.screenY - pA.screenY);
      if (!currentStrip) {
        currentStrip = [
          { x: pA.screenX, y: pA.screenY },
          { x: clipX, y: clipY },
        ];
      } else {
        currentStrip.push({ x: clipX, y: clipY });
      }
      flushStrip();
    } else if (!aVis && bVis) {
      // pA は不可視、pB は可視 -> 境界から開始
      flushStrip();
      const denominator = pB.depthZ - pA.depthZ;
      const t =
        denominator !== 0
          ? Math.max(0, Math.min(1, (threshold - pA.depthZ) / denominator))
          : 0.5;
      const clipX = pA.screenX + t * (pB.screenX - pA.screenX);
      const clipY = pA.screenY + t * (pB.screenY - pA.screenY);
      currentStrip = [
        { x: clipX, y: clipY },
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

  const screenX =
    rotated3D.screenX * baseRadius * (1 - currentMorphProgress) +
    projected2D.planarX * currentMorphProgress;
  const screenY =
    rotated3D.screenY * baseRadius * (1 - currentMorphProgress) +
    projected2D.planarY * currentMorphProgress;

  return {
    screenX,
    screenY,
    depthZ: rotated3D.depthZ,
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
  } = options;

  // 背面レイヤーはモーフィング展開に伴いフェードアウト（展開後は二重描画を防ぐ）
  if (!isFrontLayer && currentMorphProgress >= 0.5) {
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

  const morphFade = !isFrontLayer
    ? Math.max(0, 1 - currentMorphProgress * 2)
    : 1.0;
  const baseAlpha = Math.round((isFrontLayer ? 130 : 65) * morphFade);

  if (baseAlpha <= 0) {
    p5Instance.pop();
    return;
  }

  // 前面レイヤーはモーフィング進行に伴い全領域を展開（球体時は 0.0、展開完了時は -1.05）
  const depthThreshold = isFrontLayer
    ? (1 - currentMorphProgress) * 0.0 + currentMorphProgress * -1.05
    : 0.0;

  const latitudeSteps = 12;
  const longitudeSteps = 24;
  const segmentResolution = 72;

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
      isEquator ? Math.min(255, baseAlpha + 60) : baseAlpha,
    );
    p5Instance.strokeWeight(isEquator ? 1.6 : 0.85);

    const points: ProjectedSamplePoint[] = [];
    for (
      let segmentIndex = 0;
      segmentIndex <= segmentResolution;
      segmentIndex++
    ) {
      const longitudeAngle =
        -Math.PI + (segmentIndex / segmentResolution) * Math.PI * 2;

      points.push(
        sampleSphericalPoint(
          longitudeAngle,
          latitudeAngle,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
        ),
      );
    }

    renderClippedPolyline(
      p5Instance,
      points,
      isFrontLayer,
      depthThreshold,
    );
  }

  // 2. 経線（Meridians: 本初子午線を含む）
  for (
    let longitudeIndex = 0;
    longitudeIndex < longitudeSteps;
    longitudeIndex++
  ) {
    const longitudeAngle =
      -Math.PI + (longitudeIndex / longitudeSteps) * Math.PI * 2;
    const isPrimeMeridian =
      Math.abs(longitudeAngle) < 0.05 ||
      Math.abs(Math.abs(longitudeAngle) - Math.PI) < 0.05;

    p5Instance.stroke(
      gridStrokeColor[0],
      gridStrokeColor[1],
      gridStrokeColor[2],
      isPrimeMeridian ? Math.min(255, baseAlpha + 60) : baseAlpha,
    );
    p5Instance.strokeWeight(isPrimeMeridian ? 1.6 : 0.85);

    const points: ProjectedSamplePoint[] = [];
    for (
      let segmentIndex = 0;
      segmentIndex <= segmentResolution;
      segmentIndex++
    ) {
      const latitudeAngle =
        -Math.PI / 2 + (segmentIndex / segmentResolution) * Math.PI;

      points.push(
        sampleSphericalPoint(
          longitudeAngle,
          latitudeAngle,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
        ),
      );
    }

    renderClippedPolyline(
      p5Instance,
      points,
      isFrontLayer,
      depthThreshold,
    );
  }

  p5Instance.pop();
}
