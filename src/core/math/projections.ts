import type { ProjectionMethod } from "../../types/sketch";

interface ProjectedPoint {
  planarX: number;
  planarY: number;
  isVisible: boolean;
}

/**
 * 経度・緯度から各種地図投影法の2D座標を算出する関数
 * @param longitude 経度 (ラジアン, -PI〜PI)
 * @param latitude 緯度 (ラジアン, -PI/2〜PI/2)
 * @param projectionRadius 投影半径 (px)
 * @param projectionMethod 投影法種別
 * @param projectionScaleMultiplier 展開後スケール倍率 (デフォルト 1.0)
 */
export function projectSphericalCoordinatesToPlane(
  longitude: number,
  latitude: number,
  projectionRadius: number,
  projectionMethod: ProjectionMethod,
  projectionScaleMultiplier = 1.0,
): ProjectedPoint {
  let planarX = 0;
  let planarY = 0;
  const isVisible = true;

  // 展開後スケール倍率を適用
  const effectiveRadius = projectionRadius * projectionScaleMultiplier;

  switch (projectionMethod) {
    case "mercator": {
      const clampedLatitude = Math.max(-1.48, Math.min(1.48, latitude));
      planarX = effectiveRadius * longitude * 0.78;
      planarY =
        -effectiveRadius *
        Math.log(Math.tan(Math.PI / 4 + clampedLatitude / 2)) *
        0.78;
      break;
    }

    case "azimuthal": {
      const polarDistance = Math.PI / 2 - latitude;
      const azimuthalRadius = effectiveRadius * polarDistance * 0.58;
      planarX = azimuthalRadius * Math.sin(longitude);
      planarY = -azimuthalRadius * Math.cos(longitude);
      break;
    }

    case "orthographic2d": {
      planarX =
        effectiveRadius * Math.cos(latitude) * Math.sin(longitude) * 1.15;
      planarY = -effectiveRadius * Math.sin(latitude) * 1.15;
      break;
    }

    case "mollweide": {
      let auxiliaryTheta = latitude;
      for (let iteration = 0; iteration < 4; iteration++) {
        const deltaTheta =
          -(
            auxiliaryTheta +
            Math.sin(auxiliaryTheta) -
            Math.PI * Math.sin(latitude)
          ) /
          (1 + Math.cos(auxiliaryTheta));
        auxiliaryTheta += deltaTheta;
        if (Math.abs(deltaTheta) < 1e-4) break;
      }
      auxiliaryTheta /= 2;
      planarX =
        ((2 * Math.SQRT2) / Math.PI) *
        effectiveRadius *
        longitude *
        Math.cos(auxiliaryTheta) *
        0.72;
      planarY =
        -Math.SQRT2 * effectiveRadius * Math.sin(auxiliaryTheta) * 0.72;
      break;
    }

    default: {
      const standardParallel = Math.acos(2 / Math.PI);
      const equirectangularX = longitude * Math.cos(standardParallel);
      const equirectangularY = latitude;
      const halfAlpha = Math.acos(
        Math.cos(latitude) * Math.cos(longitude / 2),
      );
      const sincAlpha =
        halfAlpha === 0 ? 1 : Math.sin(halfAlpha) / halfAlpha;
      const aitoffX =
        (2 * Math.cos(latitude) * Math.sin(longitude / 2)) / sincAlpha;
      const aitoffY = Math.sin(latitude) / sincAlpha;

      planarX = effectiveRadius * (equirectangularX + aitoffX) * 0.44;
      planarY = -effectiveRadius * (equirectangularY + aitoffY) * 0.44;
      break;
    }
  }

  return { planarX, planarY, isVisible };
}
