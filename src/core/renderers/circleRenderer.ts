import type p5 from "p5";
import type {
  ProjectionMethod,
  SphericalCircle,
} from "../../types/sketch";
import { projectSphericalCoordinatesToPlane } from "../math/projections";
import { applySphereOrientationRotation } from "../math/rotation";

interface CircleRenderOptions {
  circles: SphericalCircle[];
  baseRadius: number;
  currentMorphProgress: number;
  projectionMethod: ProjectionMethod;
  projectionScaleMultiplier?: number;
  rotationAngleX: number;
  rotationAngleY: number;
  showStroke: boolean;
  strokeWeight: number;
  circleSegments?: number;
}

interface SphericalPoint {
  point3D: [number, number, number];
  lon: number; // -PI 〜 PI
  lat: number; // -PI/2 〜 PI/2
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
  rotationAngleX: number,
  rotationAngleY: number,
): { x: number; y: number } {
  // 1. 球面3D回転後のスクリーン座標
  const rotatedPoint = applySphereOrientationRotation(
    point3D,
    rotationAngleX,
    rotationAngleY,
  );
  const sphereScreenX = rotatedPoint.screenX * baseRadius;
  const sphereScreenY = rotatedPoint.screenY * baseRadius;

  // 2. 地図投影2D展開座標
  const projected2D = projectSphericalCoordinatesToPlane(
    lon,
    lat,
    baseRadius,
    projectionMethod,
    projectionScaleMultiplier,
  );

  // 3. モーフィング補間
  const blendedScreenX =
    sphereScreenX * (1 - currentMorphProgress) +
    projected2D.planarX * currentMorphProgress;
  const blendedScreenY =
    sphereScreenY * (1 - currentMorphProgress) +
    projected2D.planarY * currentMorphProgress;

  return { x: blendedScreenX, y: blendedScreenY };
}

/**
 * 分割されたピース（または単一円）を描画する
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
): void {
  // 1. 塗りつぶしポリゴン
  p5Instance.push();
  p5Instance.noStroke();
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
    );
    p5Instance.vertex(pos.x, pos.y);
  }
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.pop();

  // 2. 輪郭線 (外周円弧部分のみに適用し、ちぎり切断面にはストロークを付けない)
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

    // 円周サンプリング頂点列の生成
    const rawVertices: SphericalPoint[] = [];
    for (
      let vertexIndex = 0;
      vertexIndex < circleVerticesCount;
      vertexIndex++
    ) {
      const perimeterAngle =
        (vertexIndex / circleVerticesCount) * Math.PI * 2;
      const cosPerimeter = Math.cos(perimeterAngle);
      const sinPerimeter = Math.sin(perimeterAngle);

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
      // ちぎり線を跨がない通常円: そのまま描画
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
      );
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
    );
  }

  p5Instance.pop();
}
