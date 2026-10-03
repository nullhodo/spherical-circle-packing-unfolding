import p5 from "p5";
import type {
  Palette,
  SketchParams,
  SphericalCircle,
} from "../types/sketch";
import { getFormattedDate } from "../utils/date";
import { renderPackedCirclesGeometry } from "./renderers/circleRenderer";
import { createFilmGrainTextureBuffer } from "./renderers/grainBuffer";
import { renderGraticuleGridLines } from "./renderers/gridRenderer";

/**
 * 高解像度 (2880×2880px) でオフスクリーン再描画してPNG保存する関数
 */
export function exportHighResolutionImage(
  params: SketchParams,
  circles: SphericalCircle[],
  activePalette: Palette,
  sphereRotationX: number,
  sphereRotationY: number,
): void {
  const exportDimension = 2880;
  const formattedDateString = getFormattedDate();
  const baseFilename = `spherical-packing_${formattedDateString}_${exportDimension}x${exportDimension}`;

  new p5((offscreenInstance: p5) => {
    offscreenInstance.setup = () => {
      offscreenInstance.createCanvas(exportDimension, exportDimension);
      offscreenInstance.pixelDensity(1);
      offscreenInstance.noLoop();

      let backgroundColorRgb = [15, 23, 42];
      if (
        params.isExclusiveBackground &&
        activePalette.colors.length > 0
      ) {
        backgroundColorRgb = activePalette.colors[0].rgb;
      }
      offscreenInstance.background(
        backgroundColorRgb[0],
        backgroundColorRgb[1],
        backgroundColorRgb[2],
      );

      const scalingFactor = exportDimension / 1000;
      const highResSphereRadius = 300 * scalingFactor;

      offscreenInstance.push();
      offscreenInstance.translate(
        exportDimension / 2,
        exportDimension / 2,
      );

      if (params.showGrid) {
        renderGraticuleGridLines(offscreenInstance, {
          baseRadius: highResSphereRadius,
          currentMorphProgress: params.morphProgress,
          projectionMethod: params.projectionMethod,
          projectionScaleMultiplier: params.projectionScale,
          rotationAngleX: sphereRotationX,
          rotationAngleY: sphereRotationY,
          activePalette,
          isExclusiveBackground: params.isExclusiveBackground,
          isFrontLayer: false,
        });
      }

      renderPackedCirclesGeometry(offscreenInstance, {
        circles,
        baseRadius: highResSphereRadius,
        currentMorphProgress: params.morphProgress,
        projectionMethod: params.projectionMethod,
        projectionScaleMultiplier: params.projectionScale,
        rotationAngleX: sphereRotationX,
        rotationAngleY: sphereRotationY,
        showStroke: params.showStroke,
        strokeWeight: params.strokeWeight * scalingFactor,
        circleSegments: params.circleSegments,
      });

      if (params.showGrid) {
        renderGraticuleGridLines(offscreenInstance, {
          baseRadius: highResSphereRadius,
          currentMorphProgress: params.morphProgress,
          projectionMethod: params.projectionMethod,
          projectionScaleMultiplier: params.projectionScale,
          rotationAngleX: sphereRotationX,
          rotationAngleY: sphereRotationY,
          activePalette,
          isExclusiveBackground: params.isExclusiveBackground,
          isFrontLayer: true,
        });
      }

      offscreenInstance.pop();

      if (params.showFilmGrain) {
        const highResGrainBuffer = createFilmGrainTextureBuffer(
          offscreenInstance,
          exportDimension,
          exportDimension,
        );
        offscreenInstance.push();
        offscreenInstance.blendMode(offscreenInstance.OVERLAY);
        offscreenInstance.image(
          highResGrainBuffer,
          0,
          0,
          exportDimension,
          exportDimension,
        );
        offscreenInstance.blendMode(offscreenInstance.BLEND);
        offscreenInstance.pop();
      }

      offscreenInstance.saveCanvas(`${baseFilename}.png`);
      exportJsonSettings(
        params,
        baseFilename,
        activePalette,
        circles.length,
      );

      setTimeout(() => offscreenInstance.remove(), 1000);
    };
  });
}

/**
 * ベクターSVGファイルとして現在の状態を書き出す関数
 */
export function exportSvgGraphics(
  params: SketchParams,
  circles: SphericalCircle[],
  activePalette: Palette,
  sphereRotationX: number,
  sphereRotationY: number,
  width = 1600,
  height = 1200,
): void {
  const formattedDateString = getFormattedDate();
  const filename = `spherical-packing_${formattedDateString}.svg`;

  new p5((svgInstance: p5) => {
    svgInstance.setup = () => {
      // @ts-expect-error - p5.SVG is injected by p5.js-svg
      svgInstance.createCanvas(width, height, svgInstance.SVG);
      svgInstance.noLoop();

      let backgroundColorRgb = [15, 23, 42];
      if (
        params.isExclusiveBackground &&
        activePalette.colors.length > 0
      ) {
        backgroundColorRgb = activePalette.colors[0].rgb;
      }
      svgInstance.background(
        backgroundColorRgb[0],
        backgroundColorRgb[1],
        backgroundColorRgb[2],
      );

      const sphereRadius = Math.min(width, height) * 0.28;

      svgInstance.push();
      svgInstance.translate(width / 2, height / 2);

      if (params.showGrid) {
        renderGraticuleGridLines(svgInstance, {
          baseRadius: sphereRadius,
          currentMorphProgress: params.morphProgress,
          projectionMethod: params.projectionMethod,
          projectionScaleMultiplier: params.projectionScale,
          rotationAngleX: sphereRotationX,
          rotationAngleY: sphereRotationY,
          activePalette,
          isExclusiveBackground: params.isExclusiveBackground,
          isFrontLayer: false,
        });
      }

      renderPackedCirclesGeometry(svgInstance, {
        circles,
        baseRadius: sphereRadius,
        currentMorphProgress: params.morphProgress,
        projectionMethod: params.projectionMethod,
        projectionScaleMultiplier: params.projectionScale,
        rotationAngleX: sphereRotationX,
        rotationAngleY: sphereRotationY,
        showStroke: params.showStroke,
        strokeWeight: params.strokeWeight,
        circleSegments: params.circleSegments,
      });

      if (params.showGrid) {
        renderGraticuleGridLines(svgInstance, {
          baseRadius: sphereRadius,
          currentMorphProgress: params.morphProgress,
          projectionMethod: params.projectionMethod,
          projectionScaleMultiplier: params.projectionScale,
          rotationAngleX: sphereRotationX,
          rotationAngleY: sphereRotationY,
          activePalette,
          isExclusiveBackground: params.isExclusiveBackground,
          isFrontLayer: true,
        });
      }

      svgInstance.pop();

      // @ts-expect-error - saveSVG is provided by p5.js-svg
      svgInstance.saveSVG(filename);
      setTimeout(() => svgInstance.remove(), 1000);
    };
  });
}

/**
 * パラメータJSONファイルをダウンロード保存する関数
 */
export function exportJsonSettings(
  params: SketchParams,
  filenamePrefix?: string,
  activePalette?: Palette,
  circlesCount?: number,
): void {
  const formattedDate = getFormattedDate();
  const filename =
    filenamePrefix || `spherical-packing_${formattedDate}_settings`;

  const exportData = {
    title: "spherical-circle-packing-unfolding",
    exportedAt: new Date().toISOString(),
    formattedDate,
    parameters: params,
    activePalette,
    circlesCount,
  };

  const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = URL.createObjectURL(jsonBlob);
  downloadAnchor.download = `${filename}.json`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
  URL.revokeObjectURL(downloadAnchor.href);
}
