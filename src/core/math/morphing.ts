import type {
  MorphTransitionMode,
  ProjectionMethod,
} from "../../types/sketch";
import { projectSphericalCoordinatesToPlane } from "./projections";
import { applySphereOrientationRotation } from "./rotation";

export interface MorphedPointResult {
  x: number;
  y: number;
  depthZ: number;
}

export interface MorphPointParams {
  point3D: [number, number, number];
  lon: number;
  lat: number;
  baseRadius: number;
  currentMorphProgress: number;
  projectionMethod: ProjectionMethod;
  projectionScaleMultiplier: number;
  rotationAngleX: number;
  rotationAngleY: number;
  transitionMode?: MorphTransitionMode;
}

/**
 * 3D球面座標から2D平面展開へのモーフィング補間位置を算出する関数
 * - direct: スクリーン画面上での直線線形補間 (従来のダイレクトワープ)
 * - cylinder: 円筒面 (シリンダー) を経由して背面の継ぎ目から左右にパカッと開く等長アンロール展開
 * - unroll: 自転を正面に整列させ、背中から左右へ本や翼のように扇状に開く両開き展開
 */
export function computeMorphedPoint2D(
  params: MorphPointParams,
): MorphedPointResult {
  const {
    point3D,
    lon,
    lat,
    baseRadius,
    currentMorphProgress,
    projectionMethod,
    projectionScaleMultiplier,
    rotationAngleX,
    rotationAngleY,
    transitionMode = "direct",
  } = params;

  // 最適化: モーフィング 0 (3D自転時) は地図投影計算をスキップ
  if (currentMorphProgress <= 1e-4) {
    const rotated = applySphereOrientationRotation(
      point3D,
      rotationAngleX,
      rotationAngleY,
    );
    return {
      x: rotated.screenX * baseRadius,
      y: rotated.screenY * baseRadius,
      depthZ: rotated.depthZ,
    };
  }

  // 最適化: モーフィング 1 (2D平面展開完了時) は3D回転計算をスキップ
  if (currentMorphProgress >= 1 - 1e-4) {
    const projected2D = projectSphericalCoordinatesToPlane(
      lon,
      lat,
      baseRadius,
      projectionMethod,
      projectionScaleMultiplier,
    );
    return {
      x: projected2D.planarX,
      y: projected2D.planarY,
      depthZ: 0,
    };
  }

  // 目標となる2D平面投影座標
  const projected2D = projectSphericalCoordinatesToPlane(
    lon,
    lat,
    baseRadius,
    projectionMethod,
    projectionScaleMultiplier,
  );
  const targetX = projected2D.planarX;
  const targetY = projected2D.planarY;

  // モード 1: direct (ダイレクトワープ / 画面線形補間)
  if (transitionMode === "direct") {
    const rotated = applySphereOrientationRotation(
      point3D,
      rotationAngleX,
      rotationAngleY,
    );
    const sphereX = rotated.screenX * baseRadius;
    const sphereY = rotated.screenY * baseRadius;

    return {
      x:
        sphereX * (1 - currentMorphProgress) +
        targetX * currentMorphProgress,
      y:
        sphereY * (1 - currentMorphProgress) +
        targetY * currentMorphProgress,
      depthZ: rotated.depthZ * (1 - currentMorphProgress),
    };
  }

  // モード 2: cylinder (円筒アンロール / シリンダー展開)
  if (transitionMode === "cylinder") {
    // 展開の滑らかなイージング (smoothstep)
    const t = currentMorphProgress;
    const smoothT = t * t * (3 - 2 * t);

    // 自転を正面 (0) へスムーズに吸着 (裏側の継ぎ目が真後ろになり、左右対称に美しく開く)
    const rotFade = Math.cos(smoothT * Math.PI * 0.5);
    const curRotX = rotationAngleX * rotFade;
    const curRotY = rotationAngleY * rotFade;

    const rotated = applySphereOrientationRotation(
      point3D,
      curRotX,
      curRotY,
    );
    const sphereX = rotated.screenX * baseRadius;
    const sphereY = rotated.screenY * baseRadius;

    // 円筒曲率 kappa: 1.0 (円筒) -> 0.0 (平面)
    const kappa = Math.max(0.0001, 1 - smoothT);
    const theta = lon * kappa;

    // 目標X幅に基づく展開半径比
    const rCyl =
      Math.abs(lon) > 1e-5
        ? targetX / lon
        : baseRadius * 0.78 * projectionScaleMultiplier;

    // 開き途中の円筒上の幾何スクリーン位置: lim(kappa->0) sin(lon*kappa)/kappa = lon
    const unrolledX = (rCyl / kappa) * Math.sin(theta);
    const unrolledZ = (rCyl / kappa) * (1 - Math.cos(theta));

    // 球面から円筒アンロールへの遷移ブレンド
    const sphereWeight = Math.cos(smoothT * Math.PI * 0.5);
    const unrollWeight = 1 - sphereWeight;

    const finalX = sphereX * sphereWeight + unrolledX * unrollWeight;
    const finalY = sphereY * (1 - smoothT) + targetY * smoothT;

    return {
      x: finalX,
      y: finalY,
      depthZ:
        rotated.depthZ * sphereWeight + -unrolledZ * 0.4 * unrollWeight,
    };
  }

  // モード 3: unroll (経度アンローリング / 扇状両開き展開)
  // 背面 (|lon| = PI) から正面 (|lon| = 0) に向けて本や翼が開くようにめくれる
  const t = currentMorphProgress;
  const smoothT = t * t * (3 - 2 * t);

  // 自転を正面 (0) へスムーズに吸着
  const rotFade = Math.cos(smoothT * Math.PI * 0.5);
  const curRotX = rotationAngleX * rotFade;
  const curRotY = rotationAngleY * rotFade;

  const rotated = applySphereOrientationRotation(
    point3D,
    curRotX,
    curRotY,
  );
  const sphereX = rotated.screenX * baseRadius;
  const sphereY = rotated.screenY * baseRadius;

  // 正面からの角距離 (0: 正面, 1: 背面)
  const distFromCenter = Math.abs(lon) / Math.PI;

  // 背面から順番に平面へとめくれていく波面進行
  const peelProgress = Math.min(
    1,
    Math.max(0, smoothT * 1.5 - (1 - distFromCenter) * 0.5),
  );
  const easedPeel = peelProgress * peelProgress * (3 - 2 * peelProgress);

  const wingX = sphereX * (1 - easedPeel) + targetX * easedPeel;
  const wingY = sphereY * (1 - smoothT) + targetY * smoothT;

  return {
    x: wingX,
    y: wingY,
    depthZ: rotated.depthZ * (1 - easedPeel),
  };
}
