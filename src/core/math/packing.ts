import type {
  ColorRGB,
  PackingAlgorithm,
  Palette,
  SphericalCircle,
} from "../../types/sketch";
import { convertCartesianToSphericalCoordinates } from "./coordinates";
import { computeOrthonormalBasisForVector } from "./orthonormal";

interface CirclePackingOptions {
  maxCircles: number;
  minRadius: number;
  maxRadius: number;
  palette: Palette;
  isExclusiveBackground: boolean;
  algorithm?: PackingAlgorithm;
}

interface RawCircle {
  x: number;
  y: number;
  z: number;
  radius: number;
}

/**
 * 球面上に均一に分布するフィボナッチ格子点を生成
 */
function generateFibonacciSpherePoints(
  count: number,
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const phi = (1 + Math.sqrt(5)) / 2;
  const angleIncrement = Math.PI * 2 * phi;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const y = 1 - 2 * t;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const azimuth = angleIncrement * i;

    const x = radiusAtY * Math.cos(azimuth);
    const z = radiusAtY * Math.sin(azimuth);

    points.push([x, y, z]);
  }
  return points;
}

/**
 * 2つの球面上の点間の角距離 (rad) を計算
 */
function computeGreatCircleDistance(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): number {
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * 全円ペアを検証し、重なりを厳密に排除する保証パス
 * 接触限界を下回るペアがある場合、小さい方の半径を安全値に縮小し、
 * minRadius を維持できない場合は確実に破棄する。
 */
function enforceZeroOverlap(
  circles: RawCircle[],
  minRadius: number,
  minGap = 0.008,
): RawCircle[] {
  // 半径の大きい円を優先して保護するため降順ソート
  const sorted = [...circles].sort((a, b) => b.radius - a.radius);
  const validCircles: RawCircle[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const candidate = sorted[i];
    let maxAllowedRadius = candidate.radius;
    let hasFatalOverlap = false;

    for (let j = 0; j < validCircles.length; j++) {
      const existing = validCircles[j];
      const dist = computeGreatCircleDistance(
        candidate.x,
        candidate.y,
        candidate.z,
        existing.x,
        existing.y,
        existing.z,
      );

      const safeLimit = dist - existing.radius - minGap;
      if (safeLimit < minRadius) {
        hasFatalOverlap = true;
        break;
      }
      if (safeLimit < maxAllowedRadius) {
        maxAllowedRadius = safeLimit;
      }
    }

    if (!hasFatalOverlap && maxAllowedRadius >= minRadius) {
      candidate.radius = maxAllowedRadius;
      validCircles.push(candidate);
    }
  }

  return validCircles;
}

/**
 * SphericalCircle オブジェクトを構築する共通ヘルパー
 */
function buildSphericalCircle(
  id: number,
  x: number,
  y: number,
  z: number,
  angularRadius: number,
  usableColors: { rgb: ColorRGB; hex: string }[],
  fallbackColor: { rgb: ColorRGB; hex: string },
): SphericalCircle {
  const sphericalCoordinates = convertCartesianToSphericalCoordinates(
    x,
    y,
    z,
  );
  const orthonormalBasis = computeOrthonormalBasisForVector(x, y, z);

  const primaryChoice =
    usableColors[Math.floor(Math.random() * usableColors.length)] ||
    fallbackColor;
  const secondaryChoice =
    usableColors[Math.floor(Math.random() * usableColors.length)] ||
    primaryChoice;

  return {
    id,
    normalVector: [x, y, z],
    basisVectorU: orthonormalBasis.basisVectorU,
    basisVectorV: orthonormalBasis.basisVectorV,
    angularRadius,
    longitude: sphericalCoordinates.longitude,
    latitude: sphericalCoordinates.latitude,
    primaryColor: primaryChoice.rgb,
    secondaryColor: secondaryChoice.rgb,
    primaryHex: primaryChoice.hex,
  };
}

/**
 * 1. 高密度緩和＆適応成長パッキング (Dense Relaxation & Growth)
 * 初期シードの測地線反発と空間成長、および隙間（ボイド）探索充填の2段階により、
 * 重なりゼロを完全保証しながら高密度に充填する
 */
function computeRelaxationPacking(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
): RawCircle[] {
  let circles: RawCircle[] = [];
  const minGap = 0.008;

  // 1. 初期シード配置 (過密を防ぎ、適度な数から成長させる)
  const initialSeedCount = Math.min(
    maxCircles,
    Math.max(24, Math.floor(maxCircles * 0.35)),
  );
  const seedPoints = generateFibonacciSpherePoints(initialSeedCount);

  for (let i = 0; i < seedPoints.length; i++) {
    const [sx, sy, sz] = seedPoints[i];
    // 初期は最小半径付近からスタートし、空間に合わせて成長させる
    const r =
      minRadius + (maxRadius - minRadius) * (0.2 + 0.3 * Math.random());
    circles.push({ x: sx, y: sy, z: sz, radius: r });
  }

  // 2. 緩和・反発＆成長シミュレーション (24 ステップ)
  const iterations = 24;
  for (let iter = 0; iter < iterations; iter++) {
    // ペアごとの重なり解消 (Geodesic Repulsion)
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const cA = circles[i];
        const cB = circles[j];
        const dist = computeGreatCircleDistance(
          cA.x,
          cA.y,
          cA.z,
          cB.x,
          cB.y,
          cB.z,
        );
        const targetDist = cA.radius + cB.radius + minGap;

        if (dist < targetDist && dist > 1e-6) {
          const overlap = targetDist - dist;
          const dot = cA.x * cB.x + cA.y * cB.y + cA.z * cB.z;
          let tanX = cA.x - dot * cB.x;
          let tanY = cA.y - dot * cB.y;
          let tanZ = cA.z - dot * cB.z;
          const tanLen = Math.sqrt(
            tanX * tanX + tanY * tanY + tanZ * tanZ,
          );

          if (tanLen > 1e-6) {
            tanX /= tanLen;
            tanY /= tanLen;
            tanZ /= tanLen;

            const shift = overlap * 0.4;
            cA.x += tanX * shift;
            cA.y += tanY * shift;
            cA.z += tanZ * shift;

            cB.x -= tanX * shift;
            cB.y -= tanY * shift;
            cB.z -= tanZ * shift;

            // 球面上へ再正規化
            const normA = Math.sqrt(
              cA.x * cA.x + cA.y * cA.y + cA.z * cA.z,
            );
            cA.x /= normA;
            cA.y /= normA;
            cA.z /= normA;

            const normB = Math.sqrt(
              cB.x * cB.x + cB.y * cB.y + cB.z * cB.z,
            );
            cB.x /= normB;
            cB.y /= normB;
            cB.z /= normB;
          }
        }
      }
    }

    // 衝突していない円を適応的に膨張 (Growth)
    if (iter > 3 && iter < iterations - 3) {
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        if (c.radius < maxRadius) {
          c.radius = Math.min(maxRadius, c.radius * 1.04);
        }
      }
    }
  }

  // 3. 一次整合性チェック: 重複を厳格に解消
  circles = enforceZeroOverlap(circles, minRadius, minGap);

  // 4. 残余ボイドへの高密度追加充填フェーズ (フィボナッチ格子探索)
  const candidatePool = generateFibonacciSpherePoints(
    Math.min(1600, maxCircles * 6),
  );

  for (let pIdx = 0; pIdx < candidatePool.length; pIdx++) {
    if (circles.length >= maxCircles) break;

    const [sx, sy, sz] = candidatePool[pIdx];
    let maxFreeRadius = maxRadius;
    let isTooClose = false;

    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dist = computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z);
      const freeSpace = dist - c.radius - minGap;

      if (freeSpace < minRadius) {
        isTooClose = true;
        break;
      }
      if (freeSpace < maxFreeRadius) {
        maxFreeRadius = freeSpace;
      }
    }

    if (!isTooClose && maxFreeRadius >= minRadius) {
      circles.push({
        x: sx,
        y: sy,
        z: sz,
        radius: Math.min(maxRadius, maxFreeRadius),
      });
    }
  }

  // 5. ランダム追加充填 (微小な隙間を最後まで埋め尽くす)
  const remainingSlots = maxCircles - circles.length;
  const maxAttempts = remainingSlots * 25;

  for (let a = 0; a < maxAttempts; a++) {
    if (circles.length >= maxCircles) break;

    const rZ = Math.random() * 2 - 1;
    const rAzimuth = Math.random() * Math.PI * 2;
    const pRadius = Math.sqrt(Math.max(0, 1 - rZ * rZ));
    const sx = pRadius * Math.cos(rAzimuth);
    const sy = rZ;
    const sz = pRadius * Math.sin(rAzimuth);

    let maxFreeRadius = maxRadius;
    let isTooClose = false;

    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dist = computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z);
      const freeSpace = dist - c.radius - minGap;

      if (freeSpace < minRadius) {
        isTooClose = true;
        break;
      }
      if (freeSpace < maxFreeRadius) {
        maxFreeRadius = freeSpace;
      }
    }

    if (!isTooClose && maxFreeRadius >= minRadius) {
      circles.push({
        x: sx,
        y: sy,
        z: sz,
        radius: Math.min(maxRadius, maxFreeRadius),
      });
    }
  }

  // 6. 最終絶対保証パス: すべての円の重なりを 100% 排除
  return enforceZeroOverlap(circles, minRadius, minGap);
}

/**
 * 2. 階層アポロニアン充填 (Hierarchical Apollonian Packing)
 * 大円から順に配置し、残存するボイドを探索して中円・小円で隙間なく埋め尽くす
 */
function computeHierarchicalPacking(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
): RawCircle[] {
  let circles: RawCircle[] = [];
  const minGap = 0.009;

  // 均一サンプリング候補点プール (フィボナッチ格子)
  const candidatePool = generateFibonacciSpherePoints(
    Math.min(1800, maxCircles * 8),
  );

  // 3段階のサイズ階層
  const tiers = [
    { targetCount: Math.floor(maxCircles * 0.2), radiusScale: 0.95 }, // 大円
    { targetCount: Math.floor(maxCircles * 0.5), radiusScale: 0.55 }, // 中円
    { targetCount: maxCircles, radiusScale: 0.28 }, // 小円
  ];

  for (const tier of tiers) {
    for (let pIdx = 0; pIdx < candidatePool.length; pIdx++) {
      if (circles.length >= tier.targetCount) break;

      const [sx, sy, sz] = candidatePool[pIdx];

      let closestDist = maxRadius;
      let isOverlap = false;

      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const dist = computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z);
        if (dist < c.radius + minGap) {
          isOverlap = true;
          break;
        }
        const freeSpace = dist - c.radius - minGap;
        if (freeSpace < closestDist) {
          closestDist = freeSpace;
        }
      }

      if (!isOverlap && closestDist >= minRadius) {
        const assignedR = Math.min(
          maxRadius * tier.radiusScale,
          closestDist,
        );
        if (assignedR >= minRadius) {
          circles.push({
            x: sx,
            y: sy,
            z: sz,
            radius: Math.max(minRadius, assignedR),
          });
        }
      }
    }
  }

  // 残りの隙間をランダムサンプリングで追加充填
  const remainingSlots = maxCircles - circles.length;
  for (let a = 0; a < remainingSlots * 25; a++) {
    if (circles.length >= maxCircles) break;

    const rZ = Math.random() * 2 - 1;
    const rAzimuth = Math.random() * Math.PI * 2;
    const pRadius = Math.sqrt(Math.max(0, 1 - rZ * rZ));
    const sx = pRadius * Math.cos(rAzimuth);
    const sy = rZ;
    const sz = pRadius * Math.sin(rAzimuth);

    let closestDist = maxRadius;
    let isOverlap = false;

    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      const dist = computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z);
      if (dist < c.radius + minGap) {
        isOverlap = true;
        break;
      }
      const freeSpace = dist - c.radius - minGap;
      if (freeSpace < closestDist) {
        closestDist = freeSpace;
      }
    }

    if (!isOverlap && closestDist >= minRadius) {
      circles.push({
        x: sx,
        y: sy,
        z: sz,
        radius: Math.max(minRadius, Math.min(maxRadius, closestDist)),
      });
    }
  }

  // 最終絶対保証パス
  circles = enforceZeroOverlap(circles, minRadius, minGap);
  return circles;
}

/**
 * 3. 高速ランダムパッキング (Fast Random Dart-throwing)
 * 速度最優先の従来型ランダムサンプリング
 */
function computeFastRandomPacking(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
): RawCircle[] {
  let circles: RawCircle[] = [];
  const maximumAttempts = maxCircles * 30;
  const minGap = 0.01;

  for (let a = 0; a < maximumAttempts; a++) {
    if (circles.length >= maxCircles) break;

    const randomZ = Math.random() * 2 - 1;
    const randomAzimuth = Math.random() * Math.PI * 2;
    const planarRadius = Math.sqrt(Math.max(0, 1 - randomZ * randomZ));
    const sampleX = planarRadius * Math.cos(randomAzimuth);
    const sampleY = randomZ;
    const sampleZ = planarRadius * Math.sin(randomAzimuth);

    let closestAngularDistance = maxRadius;
    let isOverlappingAnyCircle = false;

    for (let i = 0; i < circles.length; i++) {
      const existing = circles[i];
      const angularDistance = computeGreatCircleDistance(
        sampleX,
        sampleY,
        sampleZ,
        existing.x,
        existing.y,
        existing.z,
      );

      if (angularDistance < existing.radius + minGap + 0.005) {
        isOverlappingAnyCircle = true;
        break;
      }

      const potentialRadius = angularDistance - existing.radius - minGap;
      if (potentialRadius < closestAngularDistance) {
        closestAngularDistance = potentialRadius;
      }
    }

    if (!isOverlappingAnyCircle && closestAngularDistance >= minRadius) {
      circles.push({
        x: sampleX,
        y: sampleY,
        z: sampleZ,
        radius: Math.min(
          maxRadius,
          Math.max(minRadius, closestAngularDistance),
        ),
      });
    }
  }

  circles = enforceZeroOverlap(circles, minRadius, minGap);
  return circles;
}

/**
 * 球面上の正確なサークルパッキングを計算・生成するディスパッチ関数
 */
export function computeSphericalCirclePacking(
  options: CirclePackingOptions,
): SphericalCircle[] {
  const {
    maxCircles,
    minRadius,
    maxRadius,
    palette,
    isExclusiveBackground,
    algorithm = "relaxation",
  } = options;

  const paletteColorsList = palette.colors;
  let usableColorPalette = paletteColorsList;
  if (isExclusiveBackground && paletteColorsList.length > 1) {
    usableColorPalette = paletteColorsList.slice(1);
  }

  let rawCircles: RawCircle[];
  switch (algorithm) {
    case "hierarchical":
      rawCircles = computeHierarchicalPacking(
        maxCircles,
        minRadius,
        maxRadius,
      );
      break;
    case "random":
      rawCircles = computeFastRandomPacking(
        maxCircles,
        minRadius,
        maxRadius,
      );
      break;
    default:
      rawCircles = computeRelaxationPacking(
        maxCircles,
        minRadius,
        maxRadius,
      );
      break;
  }

  const fallback = paletteColorsList[0] || {
    rgb: [255, 255, 255],
    hex: "#FFFFFF",
  };

  return rawCircles.map((raw, idx) =>
    buildSphericalCircle(
      idx,
      raw.x,
      raw.y,
      raw.z,
      raw.radius,
      usableColorPalette,
      fallback,
    ),
  );
}
