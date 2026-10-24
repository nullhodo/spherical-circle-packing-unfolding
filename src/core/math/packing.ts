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
 * 2つの球面上の円 (pA, rA) と (pB, rB) に対し、
 * 両方に外接する半径 rC の新しい円の中心候補 (最大2点) を算出する
 */
function findTangentCircleCentersOnSphere(
  pA: RawCircle,
  pB: RawCircle,
  rC: number,
  gap: number,
): [RawCircle, RawCircle] | null {
  const dA = Math.cos(pA.radius + rC + gap);
  const dB = Math.cos(pB.radius + rC + gap);
  const dot = pA.x * pB.x + pA.y * pB.y + pA.z * pB.z;

  const det = 1 - dot * dot;
  if (det < 1e-7) return null;

  const a = (dA - dB * dot) / det;
  const b = (dB - dA * dot) / det;

  const x0 = a * pA.x + b * pB.x;
  const y0 = a * pA.y + b * pB.y;
  const z0 = a * pA.z + b * pB.z;

  const lenSq = x0 * x0 + y0 * y0 + z0 * z0;
  if (lenSq > 1.0) return null;

  const crossX = pA.y * pB.z - pA.z * pB.y;
  const crossY = pA.z * pB.x - pA.x * pB.z;
  const crossZ = pA.x * pB.y - pA.y * pB.x;
  const crossLen = Math.sqrt(
    crossX * crossX + crossY * crossY + crossZ * crossZ,
  );
  if (crossLen < 1e-7) return null;

  const normCrossX = crossX / crossLen;
  const normCrossY = crossY / crossLen;
  const normCrossZ = crossZ / crossLen;

  const h = Math.sqrt(Math.max(0, 1.0 - lenSq));

  const cand1: RawCircle = {
    x: x0 + h * normCrossX,
    y: y0 + h * normCrossY,
    z: z0 + h * normCrossZ,
    radius: rC,
  };

  const cand2: RawCircle = {
    x: x0 - h * normCrossX,
    y: y0 - h * normCrossY,
    z: z0 - h * normCrossZ,
    radius: rC,
  };

  return [cand1, cand2];
}

/**
 * 候補円が既存の全円と衝突 (重なり) していないかを検証
 */
function isCircleValid(
  cand: RawCircle,
  circles: RawCircle[],
  minGap: number,
): boolean {
  for (let i = 0; i < circles.length; i++) {
    const existing = circles[i];
    const dist = computeGreatCircleDistance(
      cand.x,
      cand.y,
      cand.z,
      existing.x,
      existing.y,
      existing.z,
    );
    if (dist < cand.radius + existing.radius + minGap) {
      return false;
    }
  }
  return true;
}

/**
 * 4. 最大空隙グリーディ充填 (Maximal Inscribed Growth)
 * 球面上の「最も広い空隙 (ボイド)」を探索し、既存円に接する限界最大半径の円を優先的に配置。
 * 少ない円数で球面の表面積を最速・最大効率で覆い尽くし、大胆なメリハリと洗練されたランダム感を両立する。
 */
function computeMaximalInscribedPacking(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
): RawCircle[] {
  let circles: RawCircle[] = [];
  const minGap = 0.008;

  // 1. 初期シード大円配置 (球面上で互いに最も離れた点に数個の大円を配置)
  const initialLargeCount = Math.min(
    6,
    Math.max(3, Math.floor(maxCircles * 0.05)),
  );
  for (let i = 0; i < initialLargeCount; i++) {
    let bestX = 0;
    let bestY = 0;
    let bestZ = 1;
    let maxDist = -1;

    for (let s = 0; s < 45; s++) {
      const z = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r_xy = Math.sqrt(Math.max(0, 1 - z * z));
      const sx = r_xy * Math.cos(phi);
      const sy = z;
      const sz = r_xy * Math.sin(phi);

      let minDist = 100;
      for (let j = 0; j < circles.length; j++) {
        const c = circles[j];
        const d = computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestX = sx;
        bestY = sy;
        bestZ = sz;
      }
    }

    const rad = maxRadius * (0.85 + 0.15 * Math.random());
    const cand: RawCircle = { x: bestX, y: bestY, z: bestZ, radius: rad };
    if (isCircleValid(cand, circles, minGap)) {
      circles.push(cand);
    }
  }

  // 2. 空隙極大充填ループ
  const sampleBatchSize = 130;
  while (circles.length < maxCircles) {
    let bestCand: RawCircle | null = null;
    let maxFoundRadius = -1;

    for (let s = 0; s < sampleBatchSize; s++) {
      const z = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r_xy = Math.sqrt(Math.max(0, 1 - z * z));
      const sx = r_xy * Math.cos(phi);
      const sy = z;
      const sz = r_xy * Math.sin(phi);

      let closestDist = 100;
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const d =
          computeGreatCircleDistance(sx, sy, sz, c.x, c.y, c.z) - c.radius;
        if (d < closestDist) {
          closestDist = d;
        }
      }

      const availableRadius = closestDist - minGap;
      if (
        availableRadius >= minRadius &&
        availableRadius > maxFoundRadius
      ) {
        maxFoundRadius = availableRadius;
        bestCand = {
          x: sx,
          y: sy,
          z: sz,
          radius: Math.min(maxRadius, availableRadius),
        };
      }
    }

    if (!bestCand) {
      break; // これ以上 minRadius の円が入る隙間がない
    }

    circles.push(bestCand);
  }

  // 3. 安全な追加微小インフレーション (周囲に余白がある円を限界まで広げて充填率を極大化)
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (c.radius < maxRadius) {
      let maxGrowth = maxRadius - c.radius;
      for (let j = 0; j < circles.length; j++) {
        if (i === j) continue;
        const other = circles[j];
        const dist = computeGreatCircleDistance(
          c.x,
          c.y,
          c.z,
          other.x,
          other.y,
          other.z,
        );
        const margin = dist - c.radius - other.radius - minGap;
        if (margin < maxGrowth) {
          maxGrowth = Math.max(0, margin);
        }
      }
      c.radius += maxGrowth * 0.95;
    }
  }

  circles = enforceZeroOverlap(circles, minRadius, minGap);
  return circles;
}

/**
 * 5. べき乗則接触成長 (Power-Law Contact Packing)
 * フラクタル次元 (D ≈ 1.3) に基づく「大中小の黄金比率 (べき乗則分布)」に従って半径を決定し、
 * 既存円の谷間にカチッと外接させて高速に結晶成長させる。
 * 幾何計算のすべてが閉形式で解けるため、超高速かつ高い接触充填密度を実現する。
 */
function computePowerLawContactPacking(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
): RawCircle[] {
  let circles: RawCircle[] = [];
  const frontEdges: { i: number; j: number; attempts: number }[] = [];
  const minGap = 0.008;

  // 1. べき乗則 (Zipf / Pareto) 分布に従う目標半径配列を降順生成
  const alpha = 2.15; // フラクタル充填指数
  const radii: number[] = [];
  const minInv = minRadius ** (1 - alpha);
  const maxInv = maxRadius ** (1 - alpha);

  for (let i = 0; i < maxCircles; i++) {
    const u = i / Math.max(1, maxCircles - 1);
    const r = ((1 - u) * maxInv + u * minInv) ** (1 / (1 - alpha));
    radii.push(Math.max(minRadius, Math.min(maxRadius, r)));
  }

  // 2. 初期シード円ペアを配置
  const c0: RawCircle = {
    x: 0,
    y: 0,
    z: 1,
    radius: radii[0] ?? maxRadius,
  };
  circles.push(c0);

  const r1 = radii[1] ?? minRadius;
  const d01 = c0.radius + r1 + minGap;
  const c1: RawCircle = {
    x: Math.sin(d01),
    y: 0,
    z: Math.cos(d01),
    radius: r1,
  };
  circles.push(c1);

  frontEdges.push({ i: 0, j: 1, attempts: 0 });
  frontEdges.push({ i: 1, j: 0, attempts: 0 });

  // 3. べき乗半径リストに従って順次接触配置
  for (let idx = 2; idx < radii.length; idx++) {
    const targetRadius = radii[idx];
    let placed = false;

    // フロントエッジから優先的に接触谷間を探す
    if (frontEdges.length > 0) {
      const candidatesToTry = Math.min(frontEdges.length, 14);
      for (let t = 0; t < candidatesToTry; t++) {
        const edgeIdx = Math.floor(Math.random() * frontEdges.length);
        const edge = frontEdges[edgeIdx];

        const tangentCandidates = findTangentCircleCentersOnSphere(
          circles[edge.i],
          circles[edge.j],
          targetRadius,
          minGap,
        );

        if (tangentCandidates) {
          for (const cand of tangentCandidates) {
            if (isCircleValid(cand, circles, minGap)) {
              const newIdx = circles.length;
              circles.push(cand);

              frontEdges.splice(edgeIdx, 1);
              frontEdges.push({ i: edge.i, j: newIdx, attempts: 0 });
              frontEdges.push({ i: newIdx, j: edge.j, attempts: 0 });

              placed = true;
              break;
            }
          }
        }
        if (placed) break;
      }
    }

    // 谷間に入らなかった場合は、ランダム空隙に配置して新たな接触エッジを形成
    if (!placed) {
      for (let s = 0; s < 30; s++) {
        const z = Math.random() * 2 - 1;
        const phi = Math.random() * Math.PI * 2;
        const r_xy = Math.sqrt(Math.max(0, 1 - z * z));
        const cand: RawCircle = {
          x: r_xy * Math.cos(phi),
          y: z,
          z: r_xy * Math.sin(phi),
          radius: targetRadius,
        };
        if (isCircleValid(cand, circles, minGap)) {
          const newIdx = circles.length;
          circles.push(cand);

          for (let k = 0; k < circles.length - 1; k++) {
            const dist = computeGreatCircleDistance(
              cand.x,
              cand.y,
              cand.z,
              circles[k].x,
              circles[k].y,
              circles[k].z,
            );
            if (dist < cand.radius + circles[k].radius + minGap * 3) {
              frontEdges.push({ i: k, j: newIdx, attempts: 0 });
              frontEdges.push({ i: newIdx, j: k, attempts: 0 });
            }
          }
          placed = true;
          break;
        }
      }
    }
  }

  // 4. 重なりゼロの完全保証
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
    algorithm = "maximal",
  } = options;

  const paletteColorsList = palette.colors;
  let usableColorPalette = paletteColorsList;
  if (isExclusiveBackground && paletteColorsList.length > 1) {
    usableColorPalette = paletteColorsList.slice(1);
  }

  let rawCircles: RawCircle[];
  switch (algorithm) {
    case "maximal":
      rawCircles = computeMaximalInscribedPacking(
        maxCircles,
        minRadius,
        maxRadius,
      );
      break;
    case "powerlaw":
      rawCircles = computePowerLawContactPacking(
        maxCircles,
        minRadius,
        maxRadius,
      );
      break;
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
