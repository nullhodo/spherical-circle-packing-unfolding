import type p5 from "p5";
import type {
  MorphTransitionMode,
  ProjectionMethod,
  SphericalCircle,
} from "../../types/sketch";
import { computeMorphedPoint2D } from "../math/morphing";
import { applySphereOrientationRotation } from "../math/rotation";

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
}

interface SphericalPoint {
  point3D: [number, number, number];
  lon: number; // -PI 〜 PI
  lat: number; // -PI/2 〜 PI/2
}

/**
 * セグメントごとの三角関数テーブル (cos, sin) をキャッシュして毎フレームの計算を省略
 */
const TRIG_TABLE_CACHE: {
  [count: number]: { cos: Float64Array; sin: Float64Array };
} = {};
function getTrigTable(count: number): {
  cos: Float64Array;
  sin: Float64Array;
} {
  let table = TRIG_TABLE_CACHE[count];
  if (!table) {
    const cos = new Float64Array(count);
    const sin = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      cos[i] = Math.cos(angle);
      sin[i] = Math.sin(angle);
    }
    table = { cos, sin };
    TRIG_TABLE_CACHE[count] = table;
  }
  return table;
}

/**
 * 3D点と経度・緯度からスクリーン座標を算出 (進行度に応じたゼロコスト最適化パス付き)
 */
function computeScreenPosition(
  point3D: [number, number, number],
  lon: number,
  lat: number,
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotationAngleX: number,
  rotationAngleY: number,
  transitionMode: MorphTransitionMode = "direct",
): { x: number; y: number } {
  const result = computeMorphedPoint2D({
    point3D,
    lon,
    lat,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier,
    rotationAngleX,
    rotationAngleY,
    transitionMode,
  });
  return { x: result.x, y: result.y };
}

/**
 * 球面の曲率にフィットした同心リングメッシュ (Spherical Dome Mesh) を描画する関数
 * 半径に応じた適応型LODと三角関数テーブル参照により、見た目を変えずに超軽量化
 */
function renderSphericalFittedCircle(
  p5Instance: p5,
  circleData: SphericalCircle,
  rawVertices: SphericalPoint[],
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotationAngleX: number,
  rotationAngleY: number,
  showStroke: boolean,
  circleVerticesCount: number,
  transitionMode: MorphTransitionMode = "direct",
): void {
  // 適応型LOD: 極小円(半径<0.05rad)は球面の凹凸が0.3px未満のため中心ファンのみ(1段)、中〜大円は2段メッシュで曲面を完全再現
  const isSmallCircle = circleData.angularRadius < 0.05;
  const radialRings = isSmallCircle ? 1 : 2;

  // 中心点 (k = 0)
  const centerScreenPos = computeScreenPosition(
    circleData.normalVector,
    circleData.longitude,
    circleData.latitude,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier,
    rotationAngleX,
    rotationAngleY,
    transitionMode,
  );

  // 外周リング (k = radialRings): 既に計算済みの rawVertices を投影
  const outerRingPoints: { x: number; y: number }[] = [];
  for (let j = 0; j < rawVertices.length; j++) {
    const v = rawVertices[j];
    outerRingPoints.push(
      computeScreenPosition(
        v.point3D,
        v.lon,
        v.lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode,
      ),
    );
  }

  p5Instance.push();
  p5Instance.noStroke();

  if (radialRings === 1) {
    // 極小円: 中心ファンのみ (計算量最小、見た目は真円曲面と完全一致)
    p5Instance.beginShape(p5Instance.TRIANGLE_FAN);
    p5Instance.vertex(centerScreenPos.x, centerScreenPos.y);
    for (let j = 0; j < circleVerticesCount; j++) {
      p5Instance.vertex(outerRingPoints[j].x, outerRingPoints[j].y);
    }
    p5Instance.vertex(outerRingPoints[0].x, outerRingPoints[0].y);
    p5Instance.endShape();
  } else {
    // 中〜大円: 中間リング (k = 1) を生成
    const trigTable = getTrigTable(circleVerticesCount);
    const ringRadius = circleData.angularRadius * 0.5;
    const cosRingRad = Math.cos(ringRadius);
    const sinRingRad = Math.sin(ringRadius);
    const needLonLat = currentMorphProgress > 1e-4;

    const midRingPoints: { x: number; y: number }[] = [];
    for (let j = 0; j < circleVerticesCount; j++) {
      const cosP = trigTable.cos[j];
      const sinP = trigTable.sin[j];

      const px =
        circleData.normalVector[0] * cosRingRad +
        (circleData.basisVectorU[0] * cosP +
          circleData.basisVectorV[0] * sinP) *
          sinRingRad;
      const py =
        circleData.normalVector[1] * cosRingRad +
        (circleData.basisVectorU[1] * cosP +
          circleData.basisVectorV[1] * sinP) *
          sinRingRad;
      const pz =
        circleData.normalVector[2] * cosRingRad +
        (circleData.basisVectorU[2] * cosP +
          circleData.basisVectorV[2] * sinP) *
          sinRingRad;

      const lon = needLonLat ? Math.atan2(pz, px) : 0;
      const lat = needLonLat
        ? Math.asin(Math.max(-1, Math.min(1, py)))
        : 0;

      midRingPoints.push(
        computeScreenPosition(
          [px, py, pz],
          lon,
          lat,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
          transitionMode,
        ),
      );
    }

    // 中心ファン (中心 -> 中間リング)
    p5Instance.beginShape(p5Instance.TRIANGLE_FAN);
    p5Instance.vertex(centerScreenPos.x, centerScreenPos.y);
    for (let j = 0; j < circleVerticesCount; j++) {
      p5Instance.vertex(midRingPoints[j].x, midRingPoints[j].y);
    }
    p5Instance.vertex(midRingPoints[0].x, midRingPoints[0].y);
    p5Instance.endShape();

    // 中間リング帯 (中間リング -> 外周リング)
    p5Instance.beginShape(p5Instance.TRIANGLE_STRIP);
    for (let j = 0; j <= circleVerticesCount; j++) {
      const idx = j % circleVerticesCount;
      p5Instance.vertex(midRingPoints[idx].x, midRingPoints[idx].y);
      p5Instance.vertex(outerRingPoints[idx].x, outerRingPoints[idx].y);
    }
    p5Instance.endShape();
  }

  p5Instance.pop();

  // 輪郭線ストローク (外周のみに適用)
  if (showStroke && outerRingPoints.length >= 2) {
    p5Instance.beginShape();
    for (let j = 0; j < outerRingPoints.length; j++) {
      p5Instance.vertex(outerRingPoints[j].x, outerRingPoints[j].y);
    }
    p5Instance.endShape(p5Instance.CLOSE);
  }
}

/**
 * 分割されたピース（または単一円）を描画する
 * fitSphericalSurface 有効時は球面上の重心ファンを適用し、シームピースや極キャップも球面にフィット
 */
function renderCirclePiece(
  p5Instance: p5,
  fillVertices: SphericalPoint[],
  arcVertices: SphericalPoint[],
  baseRadius: number,
  currentMorphProgress: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier: number,
  rotationAngleX: number,
  rotationAngleY: number,
  showStroke: boolean,
  fitSphericalSurface = false,
  transitionMode: MorphTransitionMode = "direct",
): void {
  p5Instance.push();
  p5Instance.noStroke();

  if (fitSphericalSurface && fillVertices.length >= 3) {
    // 球面上の重心を計算し球面上半径1へ正規化
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let sumLon = 0;
    let sumLat = 0;
    for (let i = 0; i < fillVertices.length; i++) {
      cx += fillVertices[i].point3D[0];
      cy += fillVertices[i].point3D[1];
      cz += fillVertices[i].point3D[2];
      sumLon += fillVertices[i].lon;
      sumLat += fillVertices[i].lat;
    }
    const len = Math.hypot(cx, cy, cz) || 1;
    cx /= len;
    cy /= len;
    cz /= len;

    const centerPos = computeScreenPosition(
      [cx, cy, cz],
      sumLon / fillVertices.length,
      sumLat / fillVertices.length,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      transitionMode,
    );

    // TRIANGLE_FAN で中心から各外周頂点へファンを張って球面ドーム化
    p5Instance.beginShape(p5Instance.TRIANGLE_FAN);
    p5Instance.vertex(centerPos.x, centerPos.y);
    for (let i = 0; i < fillVertices.length; i++) {
      const pos = computeScreenPosition(
        fillVertices[i].point3D,
        fillVertices[i].lon,
        fillVertices[i].lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode,
      );
      p5Instance.vertex(pos.x, pos.y);
    }
    const firstPos = computeScreenPosition(
      fillVertices[0].point3D,
      fillVertices[0].lon,
      fillVertices[0].lat,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      transitionMode,
    );
    p5Instance.vertex(firstPos.x, firstPos.y);
    p5Instance.endShape();
  } else {
    // 通常のフラットポリゴン描画
    p5Instance.beginShape();
    for (let i = 0; i < fillVertices.length; i++) {
      const v = fillVertices[i];
      const pos = computeScreenPosition(
        v.point3D,
        v.lon,
        v.lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode,
      );
      p5Instance.vertex(pos.x, pos.y);
    }
    p5Instance.endShape(p5Instance.CLOSE);
  }
  p5Instance.pop();

  // 輪郭線 (外周円弧部分のみ)
  if (showStroke && arcVertices.length >= 2) {
    p5Instance.beginShape();
    for (let i = 0; i < arcVertices.length; i++) {
      const v = arcVertices[i];
      const pos = computeScreenPosition(
        v.point3D,
        v.lon,
        v.lat,
        baseRadius,
        currentMorphProgress,
        projectionMethod,
        projectionScaleMultiplier,
        rotationAngleX,
        rotationAngleY,
        transitionMode,
      );
      p5Instance.vertex(pos.x, pos.y);
    }
    p5Instance.endShape();
  }
}

/**
 * シーム線 (lon = ±PI, すなわち x < 0, z = 0) との交点Iを計算するヘルパー
 */
function computeIntersection(
  pA: SphericalPoint,
  pB: SphericalPoint,
): { lat: number; point3D: [number, number, number] } {
  const zA = pA.point3D[2];
  const zB = pB.point3D[2];
  const t = Math.abs(zB - zA) > 1e-7 ? -zA / (zB - zA) : 0.5;
  const clampedT = Math.max(0, Math.min(1, t));

  let ix = pA.point3D[0] + clampedT * (pB.point3D[0] - pA.point3D[0]);
  let iy = pA.point3D[1] + clampedT * (pB.point3D[1] - pA.point3D[1]);
  const iz = 0; // ちぎり線上なので z は厳密に 0

  const len = Math.sqrt(ix * ix + iy * iy);
  if (len > 0) {
    ix /= len;
    iy /= len;
  }
  const lat = Math.asin(Math.max(-1, Math.min(1, iy)));
  return { lat, point3D: [ix, iy, iz] };
}

/**
 * サークルパッキング群を深度ソートしてレンダリングする関数
 * ちぎる経線 (Seam: lon = ±PI) を跨ぐ円は自動的に左右に分割して描画する
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
    morphTransitionMode = "direct",
  } = options;

  // 深度ソートの計算
  const processedCircles = circles.map((circleItem) => {
    const centerRotated = applySphereOrientationRotation(
      circleItem.normalVector,
      rotationAngleX,
      rotationAngleY,
    );
    return {
      circleData: circleItem,
      centerDepth: centerRotated.depthZ,
    };
  });

  // 遠い円(depthが小さい)から手前の円(depthが大きい)へと順にソートして描画
  processedCircles.sort(
    (circleA, circleB) => circleA.centerDepth - circleB.centerDepth,
  );

  p5Instance.push();
  const circleVerticesCount = Math.max(16, circleSegments);

  for (
    let circleIndex = 0;
    circleIndex < processedCircles.length;
    circleIndex++
  ) {
    const { circleData, centerDepth } = processedCircles[circleIndex];

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

    p5Instance.fill(
      primaryColorRgb[0] * depthShading,
      primaryColorRgb[1] * depthShading,
      primaryColorRgb[2] * depthShading,
      circleAlpha,
    );

    if (showStroke) {
      p5Instance.stroke(
        secondaryColorRgb[0] * depthShading,
        secondaryColorRgb[1] * depthShading,
        secondaryColorRgb[2] * depthShading,
        Math.min(255, circleAlpha + 35),
      );
      p5Instance.strokeWeight(strokeWeight);
    } else {
      p5Instance.noStroke();
    }

    const cosRadius = Math.cos(circleData.angularRadius);
    const sinRadius = Math.sin(circleData.angularRadius);

    // 円周サンプリング頂点列の生成 (キャッシュテーブル活用)
    const trigTable = getTrigTable(circleVerticesCount);
    const rawVertices: SphericalPoint[] = [];
    for (
      let vertexIndex = 0;
      vertexIndex < circleVerticesCount;
      vertexIndex++
    ) {
      const cosPerimeter = trigTable.cos[vertexIndex];
      const sinPerimeter = trigTable.sin[vertexIndex];

      const px =
        circleData.normalVector[0] * cosRadius +
        (circleData.basisVectorU[0] * cosPerimeter +
          circleData.basisVectorV[0] * sinPerimeter) *
          sinRadius;
      const py =
        circleData.normalVector[1] * cosRadius +
        (circleData.basisVectorU[1] * cosPerimeter +
          circleData.basisVectorV[1] * sinPerimeter) *
          sinRadius;
      const pz =
        circleData.normalVector[2] * cosRadius +
        (circleData.basisVectorU[2] * cosPerimeter +
          circleData.basisVectorV[2] * sinPerimeter) *
          sinRadius;

      const lon = Math.atan2(pz, px);
      const lat = Math.asin(Math.max(-1, Math.min(1, py)));

      rawVertices.push({
        point3D: [px, py, pz],
        lon,
        lat,
      });
    }

    // 1. 極点（北極 / 南極）を包含する円（Circumpolar Polar Cap）の検出
    const normalY = circleData.normalVector[1];
    const encompassesNorthPole = normalY >= cosRadius - 1e-5;
    const encompassesSouthPole = normalY <= -cosRadius + 1e-5;

    if (encompassesNorthPole || encompassesSouthPole) {
      const poleLat = encompassesNorthPole ? Math.PI / 2 : -Math.PI / 2;
      const pole3D: [number, number, number] = [
        0,
        encompassesNorthPole ? 1 : -1,
        0,
      ];

      // シーム (lon = ±PI) 横断インデックスの検出
      let seamIdx = -1;
      for (let i = 0; i < circleVerticesCount; i++) {
        const nextIndex = (i + 1) % circleVerticesCount;
        const lonA = rawVertices[i].lon;
        const lonB = rawVertices[nextIndex].lon;
        if (Math.abs(lonB - lonA) > Math.PI) {
          seamIdx = i;
          break;
        }
      }

      if (seamIdx !== -1) {
        const pA = rawVertices[seamIdx];
        const pB = rawVertices[(seamIdx + 1) % circleVerticesCount];
        const inter = computeIntersection(pA, pB);

        // 円周を seamIdx+1 から seamIdx まで巡る（シームを跨がない一連の頂点列）
        const interiorPoints: SphericalPoint[] = [];
        let curr = (seamIdx + 1) % circleVerticesCount;
        while (curr !== seamIdx) {
          interiorPoints.push(rawVertices[curr]);
          curr = (curr + 1) % circleVerticesCount;
        }
        interiorPoints.push(rawVertices[seamIdx]);

        // 西(-PI)から東(+PI)へ経度が増加する順序に整列
        let isIncreasing = true;
        if (interiorPoints.length >= 2) {
          const firstLon = interiorPoints[0].lon;
          const lastLon = interiorPoints[interiorPoints.length - 1].lon;
          isIncreasing = firstLon < lastLon;
        }

        const orderedInterior = isIncreasing
          ? interiorPoints
          : [...interiorPoints].reverse();

        const interWest: SphericalPoint = {
          point3D: inter.point3D,
          lon: -Math.PI,
          lat: inter.lat,
        };
        const interEast: SphericalPoint = {
          point3D: inter.point3D,
          lon: Math.PI,
          lat: inter.lat,
        };

        const arcPoints = [interWest, ...orderedInterior, interEast];

        // 極線の生成: 東端 (lon = +PI) から 西端 (lon = -PI) へ戻るパス
        const poleSteps = Math.max(
          16,
          Math.floor(circleVerticesCount / 2),
        );
        const poleLine: SphericalPoint[] = [];
        for (let s = 0; s <= poleSteps; s++) {
          const t = s / poleSteps;
          const lon = Math.PI - t * (Math.PI * 2);
          poleLine.push({
            point3D: pole3D,
            lon,
            lat: poleLat,
          });
        }

        // 塗りつぶしポリゴン: 円周弧(西->東) + 極線(東->西)
        const fillPolygon = [...arcPoints, ...poleLine];

        renderCirclePiece(
          p5Instance,
          fillPolygon,
          arcPoints,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
          showStroke,
          fitSphericalSurface,
          morphTransitionMode,
        );
        continue;
      }
    }

    // 2. ちぎり線 (lon = ±PI, すなわち x < 0, z = 0) を跨ぐかどうかの判定 (通常円)
    const crossingIndices: number[] = [];
    for (let i = 0; i < circleVerticesCount; i++) {
      const nextIndex = (i + 1) % circleVerticesCount;
      const lonA = rawVertices[i].lon;
      const lonB = rawVertices[nextIndex].lon;

      if (Math.abs(lonB - lonA) > Math.PI) {
        crossingIndices.push(i);
      }
    }

    if (crossingIndices.length !== 2) {
      // ちぎり線を跨がない通常円: 球面曲面フィットまたは平面ディスクで描画
      if (fitSphericalSurface) {
        renderSphericalFittedCircle(
          p5Instance,
          circleData,
          rawVertices,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
          showStroke,
          circleVerticesCount,
          morphTransitionMode,
        );
      } else {
        const fillList = [...rawVertices];
        const arcList = [...rawVertices, rawVertices[0]];
        renderCirclePiece(
          p5Instance,
          fillList,
          arcList,
          baseRadius,
          currentMorphProgress,
          projectionMethod,
          projectionScaleMultiplier,
          rotationAngleX,
          rotationAngleY,
          showStroke,
          false,
          morphTransitionMode,
        );
      }
      continue;
    }

    // ちぎり線を跨ぐ円: 東側 (lon > 0, +PI 側) と 西側 (lon < 0, -PI 側) に分割

    // 交差点情報を収集
    const idx0 = crossingIndices[0];
    const idx1 = crossingIndices[1];
    const inter0 = computeIntersection(
      rawVertices[idx0],
      rawVertices[(idx0 + 1) % circleVerticesCount],
    );
    const inter1 = computeIntersection(
      rawVertices[idx1],
      rawVertices[(idx1 + 1) % circleVerticesCount],
    );

    // 円周を順次巡って東側・西側の頂点列を構成
    // idx0 から (idx0+1) への進行方向
    const goingEastToWest0 = rawVertices[idx0].lon > 0;

    // 区間 1: (idx0+1) から idx1 まで
    const seg1Vertices: SphericalPoint[] = [];
    let curr = (idx0 + 1) % circleVerticesCount;
    while (curr !== (idx1 + 1) % circleVerticesCount) {
      seg1Vertices.push(rawVertices[curr]);
      curr = (curr + 1) % circleVerticesCount;
    }

    // 区間 2: (idx1+1) から idx0 まで
    const seg2Vertices: SphericalPoint[] = [];
    curr = (idx1 + 1) % circleVerticesCount;
    while (curr !== (idx0 + 1) % circleVerticesCount) {
      seg2Vertices.push(rawVertices[curr]);
      curr = (curr + 1) % circleVerticesCount;
    }

    // 東側・西側に分類
    let eastPoints: SphericalPoint[];
    let westPoints: SphericalPoint[];
    let interEastStart: SphericalPoint;
    let interEastEnd: SphericalPoint;
    let interWestStart: SphericalPoint;
    let interWestEnd: SphericalPoint;

    if (goingEastToWest0) {
      // idx0 は東側、idx0+1 は西側
      // したがって seg1 は西側、seg2 は東側
      westPoints = seg1Vertices;
      eastPoints = seg2Vertices;

      interWestStart = {
        point3D: inter0.point3D,
        lon: -Math.PI,
        lat: inter0.lat,
      };
      interWestEnd = {
        point3D: inter1.point3D,
        lon: -Math.PI,
        lat: inter1.lat,
      };

      interEastStart = {
        point3D: inter1.point3D,
        lon: Math.PI,
        lat: inter1.lat,
      };
      interEastEnd = {
        point3D: inter0.point3D,
        lon: Math.PI,
        lat: inter0.lat,
      };
    } else {
      // idx0 は西側、idx0+1 は東側
      // したがって seg1 は東側、seg2 は西側
      eastPoints = seg1Vertices;
      westPoints = seg2Vertices;

      interEastStart = {
        point3D: inter0.point3D,
        lon: Math.PI,
        lat: inter0.lat,
      };
      interEastEnd = {
        point3D: inter1.point3D,
        lon: Math.PI,
        lat: inter1.lat,
      };

      interWestStart = {
        point3D: inter1.point3D,
        lon: -Math.PI,
        lat: inter1.lat,
      };
      interWestEnd = {
        point3D: inter0.point3D,
        lon: -Math.PI,
        lat: inter0.lat,
      };
    }

    // 切断面（ちぎり境界線に沿った補間点）の生成
    const seamInterpolationSteps = 4;
    const createSeamSegment = (
      startPt: SphericalPoint,
      endPt: SphericalPoint,
      targetLon: number,
    ): SphericalPoint[] => {
      const seamPoints: SphericalPoint[] = [];
      for (let s = 1; s < seamInterpolationSteps; s++) {
        const factor = s / seamInterpolationSteps;
        const lat = startPt.lat + factor * (endPt.lat - startPt.lat);
        const px = Math.cos(lat) * Math.cos(targetLon);
        const py = Math.sin(lat);
        const pz = 0;
        seamPoints.push({
          point3D: [px, py, pz],
          lon: targetLon,
          lat,
        });
      }
      return seamPoints;
    };

    // 1. 東側ピースの構築
    const eastArcLine = [interEastStart, ...eastPoints, interEastEnd];
    const eastSeamLine = createSeamSegment(
      interEastEnd,
      interEastStart,
      Math.PI,
    );
    const eastFillPolygon = [...eastArcLine, ...eastSeamLine];

    // 2. 西側ピースの構築
    const westArcLine = [interWestStart, ...westPoints, interWestEnd];
    const westSeamLine = createSeamSegment(
      interWestEnd,
      interWestStart,
      -Math.PI,
    );
    const westFillPolygon = [...westArcLine, ...westSeamLine];

    // 東側ピース（右端）の描画
    renderCirclePiece(
      p5Instance,
      eastFillPolygon,
      eastArcLine,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      showStroke,
      fitSphericalSurface,
      morphTransitionMode,
    );

    // 西側ピース（左端）の描画
    renderCirclePiece(
      p5Instance,
      westFillPolygon,
      westArcLine,
      baseRadius,
      currentMorphProgress,
      projectionMethod,
      projectionScaleMultiplier,
      rotationAngleX,
      rotationAngleY,
      showStroke,
      fitSphericalSurface,
      morphTransitionMode,
    );
  }

  p5Instance.pop();
}
