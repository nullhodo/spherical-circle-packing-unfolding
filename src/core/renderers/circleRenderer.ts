import type p5 from "p5";
import type {
  MorphTransitionMode,
  ProjectionMethod,
  SphericalCircle,
} from "../../types/sketch";
import { computeMorphedPoint2D } from "../math/morphing";
import {
  type CachedCircleGeometry,
  type SphericalPoint,
  getCachedCircleGeometry,
} from "./circleCache";

interface CircleRenderOptions {
  circles: SphericalCircle[];
  baseRadius: number;
  currentMorphProgress: number;
  projectionMethod: ProjectionMethod;
  projectionScaleMultiplier?: number;
  morphTransitionMode?: MorphTransitionMode;
  rotationAngleX: number;
  rotationAngleY: number;
  showStroke: boolean;
  strokeWeight: number;
  circleSegments?: number;
  fitSphericalSurface?: boolean;
  domeRings?: number;
  seamLongitude?: number;
}

interface RotationMatrix {
  cosX: number;
  sinX: number;
  cosY: number;
  sinY: number;
  angleX: number;
  angleY: number;
}

/**
 * 3D点と経度・緯度からスクリーン座標を算出
 */
function computeScreenPosition(
  point3D: [number, number, number],
  lon: number,
  lat: number,
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotMat: RotationMatrix,
  transitionMode: MorphTransitionMode = "direct",
): { x: number; y: number } {
  // 3D自転時のゼロ・プロジェクション高速パス (ダイレクト遷移時のみ地図投影スキップ & 行列インライン展開)
  if (currentMorphProgress <= 1e-4 && transitionMode === "direct") {
    const x1 = point3D[0] * rotMat.cosY + point3D[2] * rotMat.sinY;
    const y1 = point3D[1];
    const z1 = -point3D[0] * rotMat.sinY + point3D[2] * rotMat.cosY;
    return {
      x: x1 * baseRadius,
      y: (y1 * rotMat.cosX - z1 * rotMat.sinX) * baseRadius,
    };
  }

  const result = computeMorphedPoint2D({
    point3D,
    lon,
    lat,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier,
    rotationAngleX: rotMat.angleX,
    rotationAngleY: rotMat.angleY,
    transitionMode,
  });
  return { x: result.x, y: result.y };
}

/**
 * 球面の曲率にフィットした同心リングメッシュを描画する関数
 * 事前キャッシュされた頂点データとネイティブ Canvas2D パスにより超高速描画
 */
function renderSphericalFittedCircle(
  ctx: CanvasRenderingContext2D,
  geometry: CachedCircleGeometry,
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotMat: RotationMatrix,
  showStroke: boolean,
  transitionMode: MorphTransitionMode = "direct",
): void {
  const { circle, radialRings, rawVertices, domeRingsVertices } = geometry;
  const count = rawVertices.length;

  // 1. 中心点のスクリーン座標
  const centerScreenPos = computeScreenPosition(
    circle.normalVector,
    circle.longitude,
    circle.latitude,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier,
    rotMat,
    transitionMode,
  );

  // 2. 外周リングのスクリーン座標
  const outerRingPoints: { x: number; y: number }[] = new Array(count);
  for (let j = 0; j < count; j++) {
    const v = rawVertices[j];
    outerRingPoints[j] = computeScreenPosition(
      v.point3D,
      v.lon,
      v.lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotMat,
      transitionMode,
    );
  }

  if (radialRings === 1) {
    // 1段: 中心ファンのみ
    for (let j = 0; j < count; j++) {
      const next = (j + 1) % count;
      ctx.beginPath();
      ctx.moveTo(centerScreenPos.x, centerScreenPos.y);
      ctx.lineTo(outerRingPoints[j].x, outerRingPoints[j].y);
      ctx.lineTo(outerRingPoints[next].x, outerRingPoints[next].y);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // 多段メッシュ: 中間リングの投影
    const allRings: { x: number; y: number }[][] = new Array(
      radialRings + 1,
    );
    allRings[radialRings] = outerRingPoints;

    for (let k = 1; k < radialRings; k++) {
      const ringPts = domeRingsVertices[k - 1];
      const projectedRing: { x: number; y: number }[] = new Array(count);
      for (let j = 0; j < count; j++) {
        const v = ringPts[j];
        projectedRing[j] = computeScreenPosition(
          v.point3D,
          v.lon,
          v.lat,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotMat,
          transitionMode,
        );
      }
      allRings[k] = projectedRing;
    }

    // 1段目: 中心ファン (中心 -> ring 1)
    const ring1 = allRings[1];
    for (let j = 0; j < count; j++) {
      const next = (j + 1) % count;
      ctx.beginPath();
      ctx.moveTo(centerScreenPos.x, centerScreenPos.y);
      ctx.lineTo(ring1[j].x, ring1[j].y);
      ctx.lineTo(ring1[next].x, ring1[next].y);
      ctx.closePath();
      ctx.fill();
    }

    // 2段目以降: TRIANGLE_STRIP (ring k -> ring k+1)
    for (let k = 1; k < radialRings; k++) {
      const innerRing = allRings[k];
      const outerRing = allRings[k + 1];
      for (let j = 0; j < count; j++) {
        const next = (j + 1) % count;
        // 三角形 1: inner[j] -> outer[j] -> inner[next]
        ctx.beginPath();
        ctx.moveTo(innerRing[j].x, innerRing[j].y);
        ctx.lineTo(outerRing[j].x, outerRing[j].y);
        ctx.lineTo(innerRing[next].x, innerRing[next].y);
        ctx.closePath();
        ctx.fill();

        // 三角形 2: outer[j] -> outer[next] -> inner[next]
        ctx.beginPath();
        ctx.moveTo(outerRing[j].x, outerRing[j].y);
        ctx.lineTo(outerRing[next].x, outerRing[next].y);
        ctx.lineTo(innerRing[next].x, innerRing[next].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 輪郭線ストローク (外周のみに適用)
  if (showStroke && outerRingPoints.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(outerRingPoints[0].x, outerRingPoints[0].y);
    for (let j = 1; j < count; j++) {
      ctx.lineTo(outerRingPoints[j].x, outerRingPoints[j].y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/**
 * 分割ピース（東側/西側ちぎれピース、またはフラット円）を描画する関数
 */
function renderCirclePiece(
  ctx: CanvasRenderingContext2D,
  fillVertices: SphericalPoint[],
  arcVertices: SphericalPoint[],
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotMat: RotationMatrix,
  showStroke: boolean,
  fitSphericalSurface: boolean,
  transitionMode: MorphTransitionMode = "direct",
): void {
  if (fillVertices.length < 3) return;

  ctx.beginPath();

  if (fitSphericalSurface) {
    // 球面上の重心を計算し球面上半径1へ正規化
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let sumLon = 0;
    let sumLat = 0;
    const len = fillVertices.length;
    for (let i = 0; i < len; i++) {
      cx += fillVertices[i].point3D[0];
      cy += fillVertices[i].point3D[1];
      cz += fillVertices[i].point3D[2];
      sumLon += fillVertices[i].lon;
      sumLat += fillVertices[i].lat;
    }
    const norm = Math.hypot(cx, cy, cz) || 1;
    cx /= norm;
    cy /= norm;
    cz /= norm;

    const centerPos = computeScreenPosition(
      [cx, cy, cz],
      sumLon / len,
      sumLat / len,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotMat,
      transitionMode,
    );

    const projectedVertices: { x: number; y: number }[] = new Array(len);
    for (let i = 0; i < len; i++) {
      projectedVertices[i] = computeScreenPosition(
        fillVertices[i].point3D,
        fillVertices[i].lon,
        fillVertices[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
    }

    // TRIANGLE_FAN による球面ドーム化
    for (let i = 0; i < len; i++) {
      const next = (i + 1) % len;
      ctx.beginPath();
      ctx.moveTo(centerPos.x, centerPos.y);
      ctx.lineTo(projectedVertices[i].x, projectedVertices[i].y);
      ctx.lineTo(projectedVertices[next].x, projectedVertices[next].y);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // 通常のフラットポリゴン描画
    ctx.beginPath();
    const firstPos = computeScreenPosition(
      fillVertices[0].point3D,
      fillVertices[0].lon,
      fillVertices[0].lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotMat,
      transitionMode,
    );
    ctx.moveTo(firstPos.x, firstPos.y);
    for (let i = 1; i < fillVertices.length; i++) {
      const pos = computeScreenPosition(
        fillVertices[i].point3D,
        fillVertices[i].lon,
        fillVertices[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 輪郭線 (外周円弧部分のみ)
  if (showStroke && arcVertices.length >= 2) {
    ctx.beginPath();
    const firstArc = computeScreenPosition(
      arcVertices[0].point3D,
      arcVertices[0].lon,
      arcVertices[0].lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotMat,
      transitionMode,
    );
    ctx.moveTo(firstArc.x, firstArc.y);
    for (let i = 1; i < arcVertices.length; i++) {
      const pos = computeScreenPosition(
        arcVertices[i].point3D,
        arcVertices[i].lon,
        arcVertices[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
  }
}

/**
 * 極点（北極 / 南極）を包含する円（Circumpolar Polar Cap）の描画関数
 */
function renderPolarCapStripMesh(
  ctx: CanvasRenderingContext2D,
  arcPoints: SphericalPoint[],
  pole3D: [number, number, number],
  poleLat: number,
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotMat: RotationMatrix,
  showStroke: boolean,
  fitSphericalSurface: boolean,
  transitionMode: MorphTransitionMode = "direct",
  domeRings = 4,
): void {
  const count = arcPoints.length;
  if (count < 2) return;

  ctx.beginPath();

  if (fitSphericalSurface) {
    const radialRings = Math.max(1, domeRings);
    const stripLines: { x: number; y: number }[][] = new Array(
      radialRings + 1,
    );

    // k=0: 極線
    const poleLine: { x: number; y: number }[] = new Array(count);
    for (let i = 0; i < count; i++) {
      poleLine[i] = computeScreenPosition(
        pole3D,
        arcPoints[i].lon,
        poleLat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
    }
    stripLines[0] = poleLine;

    // k=radialRings: 外周円弧
    const arcLine: { x: number; y: number }[] = new Array(count);
    for (let i = 0; i < count; i++) {
      arcLine[i] = computeScreenPosition(
        arcPoints[i].point3D,
        arcPoints[i].lon,
        arcPoints[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
    }
    stripLines[radialRings] = arcLine;

    // k=1..radialRings-1: 中間補間線
    for (let k = 1; k < radialRings; k++) {
      const t = k / radialRings;
      const intermediateLine: { x: number; y: number }[] = new Array(
        count,
      );
      for (let i = 0; i < count; i++) {
        const curLon = arcPoints[i].lon;
        const curLat = poleLat + t * (arcPoints[i].lat - poleLat);
        const cosLat = Math.cos(curLat);
        const intermediate3D: [number, number, number] = [
          cosLat * Math.cos(curLon),
          Math.sin(curLat),
          cosLat * Math.sin(curLon),
        ];
        intermediateLine[i] = computeScreenPosition(
          intermediate3D,
          curLon,
          curLat,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotMat,
          transitionMode,
        );
      }
      stripLines[k] = intermediateLine;
    }

    // ストリップクアッドの描画
    for (let k = 0; k < radialRings; k++) {
      const topPts = stripLines[k];
      const botPts = stripLines[k + 1];
      for (let i = 0; i < count - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(topPts[i].x, topPts[i].y);
        ctx.lineTo(topPts[i + 1].x, topPts[i + 1].y);
        ctx.lineTo(botPts[i + 1].x, botPts[i + 1].y);
        ctx.lineTo(botPts[i].x, botPts[i].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    // 1段ストリップ (極線 -> 外周円弧)
    const poleLine: { x: number; y: number }[] = new Array(count);
    const arcLine: { x: number; y: number }[] = new Array(count);
    for (let i = 0; i < count; i++) {
      poleLine[i] = computeScreenPosition(
        pole3D,
        arcPoints[i].lon,
        poleLat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
      arcLine[i] = computeScreenPosition(
        arcPoints[i].point3D,
        arcPoints[i].lon,
        arcPoints[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
    }
    for (let i = 0; i < count - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(poleLine[i].x, poleLine[i].y);
      ctx.lineTo(poleLine[i + 1].x, poleLine[i + 1].y);
      ctx.lineTo(arcLine[i + 1].x, arcLine[i + 1].y);
      ctx.lineTo(arcLine[i].x, arcLine[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 輪郭線ストローク (外周円弧部分のみに描画)
  if (showStroke && arcPoints.length >= 2) {
    ctx.beginPath();
    const firstArc = computeScreenPosition(
      arcPoints[0].point3D,
      arcPoints[0].lon,
      arcPoints[0].lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotMat,
      transitionMode,
    );
    ctx.moveTo(firstArc.x, firstArc.y);
    for (let k = 1; k < arcPoints.length; k++) {
      const posArc = computeScreenPosition(
        arcPoints[k].point3D,
        arcPoints[k].lon,
        arcPoints[k].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        transitionMode,
      );
      ctx.lineTo(posArc.x, posArc.y);
    }
    ctx.stroke();
  }
}

/**
 * サークルパッキング群を深度ソートしてレンダリングする関数
 * 事前ジオメトリキャッシュとネイティブパス描画により、見た目を一切変えずに超軽量化
 */
export function renderPackedCirclesGeometry(
  p5Instance: p5,
  options: CircleRenderOptions,
): void {
  const {
    circles,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier = 1.0,
    rotationAngleX,
    rotationAngleY,
    showStroke,
    strokeWeight,
    circleSegments = 64,
    fitSphericalSurface = true,
    domeRings = 4,
    seamLongitude = Math.PI,
    morphTransitionMode = "direct",
  } = options;

  if (circles.length === 0) return;

  // フレーム共通の回転行列係数を 1 回だけ事前計算 (数十万回の三角関数呼び出しを 0 化)
  const rotMat: RotationMatrix = {
    cosX: Math.cos(rotationAngleX),
    sinX: Math.sin(rotationAngleX),
    cosY: Math.cos(rotationAngleY),
    sinY: Math.sin(rotationAngleY),
    angleX: rotationAngleX,
    angleY: rotationAngleY,
  };

  // 高速深度ソートの計算 (三角関数ゼロの積和演算)
  const processedCircles = circles.map((circleItem) => {
    const [nx, ny, nz] = circleItem.normalVector;
    const z1 = -nx * rotMat.sinY + nz * rotMat.cosY;
    const depthZ = ny * rotMat.sinX + z1 * rotMat.cosX;
    return {
      circleData: circleItem,
      centerDepth: depthZ,
    };
  });

  // 遠い円(depthが小さい)から手前の円(depthが大きい)へと順にソート
  processedCircles.sort(
    (circleA, circleB) => circleA.centerDepth - circleB.centerDepth,
  );

  const ctx = p5Instance.drawingContext as CanvasRenderingContext2D;

  for (
    let circleIndex = 0;
    circleIndex < processedCircles.length;
    circleIndex++
  ) {
    const { circleData, centerDepth } = processedCircles[circleIndex];

    // 幾何キャッシュの取得 (未キャッシュなら初回のみ事前生成)
    const geometry = getCachedCircleGeometry(
      circleData,
      circleSegments,
      domeRings,
      seamLongitude,
    );

    // 深度に応じた輝度と不透明度
    const depthFactor = p5Instance.map(centerDepth, -1.0, 1.0, 0.6, 1.0);
    const depthShading = p5Instance.lerp(
      depthFactor,
      1.0,
      currentMorphProgress,
    );

    const alphaRangeFactor = p5Instance.map(
      centerDepth,
      -1.0,
      1.0,
      150,
      245,
    );
    const circleAlpha = Math.floor(
      p5Instance.lerp(alphaRangeFactor, 245, currentMorphProgress),
    );

    const primaryColorRgb = circleData.primaryColor;
    const secondaryColorRgb = circleData.secondaryColor;

    const r = Math.round(primaryColorRgb[0] * depthShading);
    const g = Math.round(primaryColorRgb[1] * depthShading);
    const b = Math.round(primaryColorRgb[2] * depthShading);
    const a = circleAlpha / 255;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;

    if (showStroke) {
      const sr = Math.round(secondaryColorRgb[0] * depthShading);
      const sg = Math.round(secondaryColorRgb[1] * depthShading);
      const sb = Math.round(secondaryColorRgb[2] * depthShading);
      const sa = Math.min(255, circleAlpha + 35) / 255;
      ctx.strokeStyle = `rgba(${sr},${sg},${sb},${sa})`;
      ctx.lineWidth = strokeWeight;
    }

    // 2. 極点（北極 / 南極）を包含する円（Circumpolar Polar Cap）
    if (
      geometry.isPolarCap &&
      geometry.polarArcPoints &&
      geometry.pole3D &&
      geometry.poleLat !== undefined
    ) {
      renderPolarCapStripMesh(
        ctx,
        geometry.polarArcPoints,
        geometry.pole3D,
        geometry.poleLat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        showStroke,
        fitSphericalSurface,
        morphTransitionMode,
        domeRings,
      );
      continue;
    }

    // 3. ちぎり線 (lon = ±PI) を跨ぐ通常円
    if (
      geometry.isSeamCrossing &&
      geometry.eastFill &&
      geometry.eastArc &&
      geometry.westFill &&
      geometry.westArc
    ) {
      // 東側ピース (右端)
      renderCirclePiece(
        ctx,
        geometry.eastFill,
        geometry.eastArc,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        showStroke,
        fitSphericalSurface,
        morphTransitionMode,
      );
      // 西側ピース (左端)
      renderCirclePiece(
        ctx,
        geometry.westFill,
        geometry.westArc,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        showStroke,
        fitSphericalSurface,
        morphTransitionMode,
      );
      continue;
    }

    // 4. ちぎり線を跨がない通常円
    if (fitSphericalSurface) {
      renderSphericalFittedCircle(
        ctx,
        geometry,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        showStroke,
        morphTransitionMode,
      );
    } else {
      const fillList = geometry.rawVertices;
      const arcList = [...geometry.rawVertices, geometry.rawVertices[0]];
      renderCirclePiece(
        ctx,
        fillList,
        arcList,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotMat,
        showStroke,
        false,
        morphTransitionMode,
      );
    }
  }
}
