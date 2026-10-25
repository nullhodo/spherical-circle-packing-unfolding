import type { SphericalCircle } from "../../types/sketch";

export interface SphericalPoint {
  point3D: [number, number, number];
  lon: number; // -PI 〜 PI (切り分け経線を基準とした相対経度)
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

  // シーム横断円 (ちぎり線を跨ぐ通常円)
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
 * 角度を [-PI, PI] に正規化するヘルパー
 */
function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * 相対シーム線 (relLon = ±PI, すなわち z_rel = 0, x_rel < 0) との交点を計算するヘルパー
 */
function computeIntersectionRel(
  pA: SphericalPoint,
  pB: SphericalPoint,
  relA: SphericalPoint,
  relB: SphericalPoint,
): { lat: number; point3D: [number, number, number] } {
  const zA = relA.point3D[2];
  const zB = relB.point3D[2];
  const t = Math.abs(zB - zA) > 1e-7 ? -zA / (zB - zA) : 0.5;
  const clampedT = Math.max(0, Math.min(1, t));

  // 実空間 3D 座標の補間
  let ix = pA.point3D[0] + clampedT * (pB.point3D[0] - pA.point3D[0]);
  let iy = pA.point3D[1] + clampedT * (pB.point3D[1] - pA.point3D[1]);
  let iz = pA.point3D[2] + clampedT * (pB.point3D[2] - pA.point3D[2]);

  const len = Math.hypot(ix, iy, iz);
  if (len > 0) {
    ix /= len;
    iy /= len;
    iz /= len;
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
 * @param seamLongitude 切り分け経線角度 (-PI 〜 PI、デフォルト: PI = 180度)
 */
export function getCachedCircleGeometry(
  circleData: SphericalCircle,
  circleSegments: number,
  domeRings = 4,
  seamLongitude = Math.PI,
): CachedCircleGeometry {
  const count = Math.max(16, circleSegments);
  const seamDeg = Math.round((seamLongitude * 180) / Math.PI);
  const cacheKey = `${count}_${domeRings}_${seamDeg}`;

  let circleMap = CIRCLE_GEOMETRY_CACHE.get(circleData);
  if (!circleMap) {
    circleMap = new Map();
    CIRCLE_GEOMETRY_CACHE.set(circleData, circleMap);
  }

  const cached = circleMap.get(cacheKey);
  if (cached) {
    return cached;
  }

  // === 切り分け経線に基づく相対座標系の係数 ===
  // seamLongitude がちぎり線 (relLon = ±PI) になり、
  // centralMeridian (seamLongitude - PI) が展開図の中央 (relLon = 0) になる
  const centralMeridian =
    seamLongitude > 0 ? seamLongitude - Math.PI : seamLongitude + Math.PI;
  const phi = seamLongitude - Math.PI; // 相対座標系への Y軸回転角
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // === 幾何メッシュの事前生成 ===
  const cosRadius = Math.cos(circleData.angularRadius);
  const sinRadius = Math.sin(circleData.angularRadius);
  const trigTable = getTrigTable(count);

  // 1. 外周頂点列 (rawVertices) および相対座標 (relVertices)
  const rawVertices: SphericalPoint[] = [];
  const relVertices: SphericalPoint[] = [];

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

    const origLon = Math.atan2(pz, px);
    const lat = Math.asin(Math.max(-1, Math.min(1, py)));
    const relLon = normalizeAngle(origLon - centralMeridian);

    // 相対 3D 座標: Y軸周りに -phi 回転
    const rx = px * cosPhi + pz * sinPhi;
    const ry = py;
    const rz = -px * sinPhi + pz * cosPhi;

    rawVertices.push({
      point3D: [px, py, pz],
      lon: relLon,
      lat,
    });

    relVertices.push({
      point3D: [rx, ry, rz],
      lon: relLon,
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

        const origLon = Math.atan2(pz, px);
        const lat = Math.asin(Math.max(-1, Math.min(1, py)));
        const relLon = normalizeAngle(origLon - centralMeridian);

        ringPoints.push({
          point3D: [px, py, pz],
          lon: relLon,
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

    // 相対シーム (relLon = ±PI) 横断インデックスの検出
    let seamIdx = -1;
    for (let i = 0; i < count; i++) {
      const nextIndex = (i + 1) % count;
      const lonA = relVertices[i].lon;
      const lonB = relVertices[nextIndex].lon;
      if (Math.abs(lonB - lonA) > Math.PI) {
        seamIdx = i;
        break;
      }
    }

    if (seamIdx !== -1) {
      const pA = rawVertices[seamIdx];
      const pB = rawVertices[(seamIdx + 1) % count];
      const relA = relVertices[seamIdx];
      const relB = relVertices[(seamIdx + 1) % count];
      const inter = computeIntersectionRel(pA, pB, relA, relB);

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

  // 4. ちぎり線 (relLon = ±PI) を跨ぐかどうかの判定 (通常円)
  let isSeamCrossing = false;
  let eastFill: SphericalPoint[] | undefined;
  let eastArc: SphericalPoint[] | undefined;
  let westFill: SphericalPoint[] | undefined;
  let westArc: SphericalPoint[] | undefined;

  if (!isPolarCap) {
    const crossingIndices: number[] = [];
    for (let i = 0; i < count; i++) {
      const nextIndex = (i + 1) % count;
      const lonA = relVertices[i].lon;
      const lonB = relVertices[nextIndex].lon;

      if (Math.abs(lonB - lonA) > Math.PI) {
        crossingIndices.push(i);
      }
    }

    if (crossingIndices.length === 2) {
      const idx0 = crossingIndices[0];
      const idx1 = crossingIndices[1];
      const inter0 = computeIntersectionRel(
        rawVertices[idx0],
        rawVertices[(idx0 + 1) % count],
        relVertices[idx0],
        relVertices[(idx0 + 1) % count],
      );
      const inter1 = computeIntersectionRel(
        rawVertices[idx1],
        rawVertices[(idx1 + 1) % count],
        relVertices[idx1],
        relVertices[(idx1 + 1) % count],
      );

      const goingEastToWest0 = relVertices[idx0].lon > 0;

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

          // 相対座標系でのちぎり線上の点
          const rx = Math.cos(lat) * Math.cos(targetLon);
          const ry = Math.sin(lat);
          const rz = 0;

          // 実空間 3D 座標に戻す: Y軸周りに +phi 回転
          const px = rx * cosPhi - rz * sinPhi;
          const py = ry;
          const pz = rx * sinPhi + rz * cosPhi;

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

  const centerRelLon = normalizeAngle(
    circleData.longitude - centralMeridian,
  );

  const geometry: CachedCircleGeometry = {
    circle: circleData,
    circleVerticesCount: count,
    domeRings,
    radialRings,
    rawVertices,
    domeRingsVertices,
    centerLonLat: {
      lon: centerRelLon,
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
