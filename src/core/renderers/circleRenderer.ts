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

/**
 * サークルパッキング群を深度ソートしてレンダリングする関数
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
  const circleVerticesCount = Math.max(8, circleSegments);

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

    p5Instance.beginShape();
    const cosRadius = Math.cos(circleData.angularRadius);
    const sinRadius = Math.sin(circleData.angularRadius);

    for (
      let vertexIndex = 0;
      vertexIndex <= circleVerticesCount;
      vertexIndex++
    ) {
      const perimeterAngle =
        (vertexIndex / circleVerticesCount) * Math.PI * 2;
      const cosPerimeter = Math.cos(perimeterAngle);
      const sinPerimeter = Math.sin(perimeterAngle);

      // 正規直交基底(U, V)による正確な球面上の円周点ベクトル
      const pointX =
        circleData.normalVector[0] * cosRadius +
        (circleData.basisVectorU[0] * cosPerimeter +
          circleData.basisVectorV[0] * sinPerimeter) *
          sinRadius;
      const pointY =
        circleData.normalVector[1] * cosRadius +
        (circleData.basisVectorU[1] * cosPerimeter +
          circleData.basisVectorV[1] * sinPerimeter) *
          sinRadius;
      const pointZ =
        circleData.normalVector[2] * cosRadius +
        (circleData.basisVectorU[2] * cosPerimeter +
          circleData.basisVectorV[2] * sinPerimeter) *
          sinRadius;

      // 1. 球面3D回転後のスクリーン座標
      const rotatedPoint = applySphereOrientationRotation(
        [pointX, pointY, pointZ],
        rotationAngleX,
        rotationAngleY,
      );
      const sphereScreenX = rotatedPoint.screenX * baseRadius;
      const sphereScreenY = rotatedPoint.screenY * baseRadius;

      // 2. 地図投影2D展開座標
      const pointLon = Math.atan2(pointZ, pointX);
      const pointLat = Math.asin(Math.max(-1, Math.min(1, pointY)));

      let deltaLon = pointLon - circleData.longitude;
      while (deltaLon > Math.PI) deltaLon -= Math.PI * 2;
      while (deltaLon < -Math.PI) deltaLon += Math.PI * 2;
      const unwrappedLon = circleData.longitude + deltaLon;

      const projected2D = projectSphericalCoordinatesToPlane(
        unwrappedLon,
        pointLat,
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

      p5Instance.vertex(blendedScreenX, blendedScreenY);
    }
    p5Instance.endShape(p5Instance.CLOSE);
  }

  p5Instance.pop();
}
