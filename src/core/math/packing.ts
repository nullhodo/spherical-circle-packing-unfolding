import type { Palette, SphericalCircle } from "../../types/sketch";
import { convertCartesianToSphericalCoordinates } from "./coordinates";
import { computeOrthonormalBasisForVector } from "./orthonormal";

interface CirclePackingOptions {
  maxCircles: number;
  minRadius: number;
  maxRadius: number;
  palette: Palette;
  isExclusiveBackground: boolean;
}

/**
 * 球面上の正確なサークルパッキングを計算・生成する関数
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
  } = options;

  const circleCandidates: SphericalCircle[] = [];
  const maximumAttempts = maxCircles * 28;
  const paletteColorsList = palette.colors;

  let usableColorPalette = paletteColorsList;
  if (isExclusiveBackground && paletteColorsList.length > 1) {
    usableColorPalette = paletteColorsList.slice(1);
  }

  for (
    let attemptIndex = 0;
    attemptIndex < maximumAttempts;
    attemptIndex++
  ) {
    if (circleCandidates.length >= maxCircles) break;

    const randomZ = Math.random() * 2 - 1;
    const randomAzimuth = Math.random() * Math.PI * 2;
    const planarRadius = Math.sqrt(Math.max(0, 1 - randomZ * randomZ));
    const sampleX = planarRadius * Math.cos(randomAzimuth);
    const sampleY = randomZ;
    const sampleZ = planarRadius * Math.sin(randomAzimuth);

    let closestAngularDistance = maxRadius;
    let isOverlappingAnyCircle = false;

    for (let i = 0; i < circleCandidates.length; i++) {
      const existingCircle = circleCandidates[i];
      const dotProduct =
        sampleX * existingCircle.normalVector[0] +
        sampleY * existingCircle.normalVector[1] +
        sampleZ * existingCircle.normalVector[2];
      const angularDistance = Math.acos(
        Math.max(-1, Math.min(1, dotProduct)),
      );

      if (angularDistance < existingCircle.angularRadius + 0.015) {
        isOverlappingAnyCircle = true;
        break;
      }

      const potentialRadius =
        angularDistance - existingCircle.angularRadius - 0.012;
      if (potentialRadius < closestAngularDistance) {
        closestAngularDistance = potentialRadius;
      }
    }

    if (!isOverlappingAnyCircle && closestAngularDistance >= minRadius) {
      const assignedAngularRadius = Math.min(
        maxRadius,
        Math.max(minRadius, closestAngularDistance),
      );
      const sphericalCoordinates = convertCartesianToSphericalCoordinates(
        sampleX,
        sampleY,
        sampleZ,
      );
      const orthonormalBasis = computeOrthonormalBasisForVector(
        sampleX,
        sampleY,
        sampleZ,
      );

      const chosenColorData =
        usableColorPalette[
          Math.floor(Math.random() * usableColorPalette.length)
        ] || paletteColorsList[0];
      const secondaryColorData =
        usableColorPalette[
          Math.floor(Math.random() * usableColorPalette.length)
        ] || chosenColorData;

      circleCandidates.push({
        id: circleCandidates.length,
        normalVector: [sampleX, sampleY, sampleZ],
        basisVectorU: orthonormalBasis.basisVectorU,
        basisVectorV: orthonormalBasis.basisVectorV,
        angularRadius: assignedAngularRadius,
        longitude: sphericalCoordinates.longitude,
        latitude: sphericalCoordinates.latitude,
        primaryColor: chosenColorData.rgb,
        secondaryColor: secondaryColorData.rgb,
        primaryHex: chosenColorData.hex,
      });
    }
  }

  return circleCandidates;
}
