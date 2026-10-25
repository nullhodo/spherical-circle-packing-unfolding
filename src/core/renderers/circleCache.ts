import type { SphericalCircle } from "../../types/sketch";

export interface SphericalPoint {
  point3D: [number, number, number];
  lon: number; // -PI 〜 PI
  lat: number; // -PI/2 〜 PI/2
}

export interface CachedCircleGeometry {
  circle: SphericalCircle;
  circleVerticesCount: number;
  domeRings: number;
  radialRings: number;
  rawVertices: SphericalPoint[];
  domeRingsVertices: SphericalPoint[][]; // k = 1 .. radialRings - 1 の中間リング
  centerLonLat: { lon: number; lat: number };

  // 極キャップ円 (北極 / 南極を跨ぐ円)
  isPolarCap: boolean;
  pole3D?: [number, number, number];
  poleLat?: number;
  polarArcPoints?: SphericalPoint[];

  // シーム横断円 (ちぎり線 lon = ±PI を跨ぐ通常円)
  isSeamCrossing: boolean;
  eastFill?: SphericalPoint[];
  eastArc?: SphericalPoint[];
  westFill?: SphericalPoint[];
  westArc?: SphericalPoint[];
}

/**
 * 三角関数 (cos, sin) テーブルのキャッシュ
 */
const TRIG_TABLE_CACHE: {
  [count: number]: { cos: Float64Array; sin: Float64Array };
} = {};

export function getTrigTable(count: number): {
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
 * 円オブジェクト参照ごとの幾何キャッシュ
 */
const CIRCLE_GEOMETRY_CACHE = new WeakMap<
  SphericalCircle,
  Map<string, CachedCircleGeometry>
>();

/**
 * サークルパッキング円の幾何メッシュデータを事前生成・キャッシュする関数
 * パッキングが変わらない限り、毎フレームの逆三角関数や交差点探索などの重い計算をゼロコスト化
 */
export function getCachedCircleGeometry(
  circleData: SphericalCircle,
  circleSegments: number,
  domeRings = 4,
): CachedCircleGeometry {
  const count = Math.max(16, circleSegments);
  const cacheKey = `${count}_${domeRings}`;

  let circleMap = CIRCLE_GEOMETRY_CACHE.get(circleData);
  if (!circleMap) {
    circleMap = new Map();
    CIRCLE_GEOMETRY_CACHE.set(circleData, circleMap);
  }

  const cached = circleMap.get(cacheKey);
  if (cached) {
    return cached;
  }

  // === 幾何メッシュの事前生成 ===
  const cosRadius = Math.cos(circleData.angularRadius);
  const sinRadius = Math.sin(circleData.angularRadius);
  const trigTable = getTrigTable(count);

  // 1. 外周頂点列 (rawVertices)
  const rawVertices: SphericalPoint[] = [];
  for (let vertexIndex = 0; vertexIndex < count; vertexIndex++) {
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

  // 2. 適応型LODによる同心リング多段メッシュの事前生成
  let radialRings = 1;
  if (circleData.angularRadius >= 0.03 && domeRings > 1) {
    const scale = Math.min(1, circleData.angularRadius / 0.15);
    radialRings = Math.max(
      1,
      Math.min(domeRings, Math.round(domeRings * scale)),
    );
  }

  const domeRingsVertices: SphericalPoint[][] = [];
  if (radialRings > 1) {
    for (let k = 1; k < radialRings; k++) {
      const ringRadius = circleData.angularRadius * (k / radialRings);
      const cosRingRad = Math.cos(ringRadius);
      const sinRingRad = Math.sin(ringRadius);
      const ringPoints: SphericalPoint[] = [];

      for (let j = 0; j < count; j++) {
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

        const lon = Math.atan2(pz, px);
        const lat = Math.asin(Math.max(-1, Math.min(1, py)));

        ringPoints.push({
          point3D: [px, py, pz],
          lon,
          lat,
        });
      }
      domeRingsVertices.push(ringPoints);
    }
  }

  // 3. 極点（北極 / 南極）を包含する円（Circumpolar Polar Cap）の検出
  const normalY = circleData.normalVector[1];
  const encompassesNorthPole = normalY >= cosRadius - 1e-5;
  const encompassesSouthPole = normalY <= -cosRadius + 1e-5;

  let isPolarCap = false;
  let pole3D: [number, number, number] | undefined;
  let poleLat: number | undefined;
  let polarArcPoints: SphericalPoint[] | undefined;

  if (encompassesNorthPole || encompassesSouthPole) {
    poleLat = encompassesNorthPole ? Math.PI / 2 : -Math.PI / 2;
    pole3D = [0, encompassesNorthPole ? 1 : -1, 0];

    // シーム (lon = ±PI) 横断インデックスの検出
    let seamIdx = -1;
    for (let i = 0; i < count; i++) {
      const nextIndex = (i + 1) % count;
      const lonA = rawVertices[i].lon;
      const lonB = rawVertices[nextIndex].lon;
      if (Math.abs(lonB - lonA) > Math.PI) {
        seamIdx = i;
        break;
      }
    }

    if (seamIdx !== -1) {
      const pA = rawVertices[seamIdx];
      const pB = rawVertices[(seamIdx + 1) % count];
      const inter = computeIntersection(pA, pB);

      const interiorPoints: SphericalPoint[] = [];
      let curr = (seamIdx + 1) % count;
      while (curr !== seamIdx) {
        interiorPoints.push(rawVertices[curr]);
        curr = (curr + 1) % count;
      }
      interiorPoints.push(rawVertices[seamIdx]);

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

      polarArcPoints = [interWest, ...orderedInterior, interEast];
      isPolarCap = true;
    }
  }

  // 4. ちぎり線 (lon = ±PI) を跨ぐかどうかの判定 (通常円)
  let isSeamCrossing = false;
  let eastFill: SphericalPoint[] | undefined;
  let eastArc: SphericalPoint[] | undefined;
  let westFill: SphericalPoint[] | undefined;
  let westArc: SphericalPoint[] | undefined;

  if (!isPolarCap) {
    const crossingIndices: number[] = [];
    for (let i = 0; i < count; i++) {
      const nextIndex = (i + 1) % count;
      const lonA = rawVertices[i].lon;
      const lonB = rawVertices[nextIndex].lon;

      if (Math.abs(lonB - lonA) > Math.PI) {
        crossingIndices.push(i);
      }
    }

    if (crossingIndices.length === 2) {
      const idx0 = crossingIndices[0];
      const idx1 = crossingIndices[1];
      const inter0 = computeIntersection(
        rawVertices[idx0],
        rawVertices[(idx0 + 1) % count],
      );
      const inter1 = computeIntersection(
        rawVertices[idx1],
        rawVertices[(idx1 + 1) % count],
      );

      const goingEastToWest0 = rawVertices[idx0].lon > 0;

      const seg1Vertices: SphericalPoint[] = [];
      let curr = (idx0 + 1) % count;
      while (curr !== (idx1 + 1) % count) {
        seg1Vertices.push(rawVertices[curr]);
        curr = (curr + 1) % count;
      }

      const seg2Vertices: SphericalPoint[] = [];
      curr = (idx1 + 1) % count;
      while (curr !== (idx0 + 1) % count) {
        seg2Vertices.push(rawVertices[curr]);
        curr = (curr + 1) % count;
      }

      let eastPoints: SphericalPoint[];
      let westPoints: SphericalPoint[];
      let interEastStart: SphericalPoint;
      let interEastEnd: SphericalPoint;
      let interWestStart: SphericalPoint;
      let interWestEnd: SphericalPoint;

      if (goingEastToWest0) {
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

      const eastArcLine = [interEastStart, ...eastPoints, interEastEnd];
      const eastSeamLine = createSeamSegment(
        interEastEnd,
        interEastStart,
        Math.PI,
      );
      eastFill = [...eastArcLine, ...eastSeamLine];
      eastArc = eastArcLine;

      const westArcLine = [interWestStart, ...westPoints, interWestEnd];
      const westSeamLine = createSeamSegment(
        interWestEnd,
        interWestStart,
        -Math.PI,
      );
      westFill = [...westArcLine, ...westSeamLine];
      westArc = westArcLine;

      isSeamCrossing = true;
    }
  }

  const geometry: CachedCircleGeometry = {
    circle: circleData,
    circleVerticesCount: count,
    domeRings,
    radialRings,
    rawVertices,
    domeRingsVertices,
    centerLonLat: {
      lon: circleData.longitude,
      lat: circleData.latitude,
    },
    isPolarCap,
    pole3D,
    poleLat,
    polarArcPoints,
    isSeamCrossing,
    eastFill,
    eastArc,
    westFill,
    westArc,
  };

  circleMap.set(cacheKey, geometry);
  return geometry;
}
