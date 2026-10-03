import type { ColorRGB, Palette } from "../types/sketch";

/**
 * 16進数カラーコードをRGBタプルに変換する関数
 */
export function convertHexToRgb(hexColorString: string): ColorRGB {
  let sanitizedHex = hexColorString.replace("#", "");
  if (sanitizedHex.length === 3) {
    sanitizedHex = sanitizedHex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const numericValue = Number.parseInt(sanitizedHex, 16);
  if (Number.isNaN(numericValue)) {
    return [0, 0, 0];
  }
  return [
    (numericValue >> 16) & 255,
    (numericValue >> 8) & 255,
    numericValue & 255,
  ];
}

/**
 * 2つのRGBカラーを線形補間する関数
 */
export function interpolateRgbColors(
  colorA: ColorRGB,
  colorB: ColorRGB,
  factor: number,
): ColorRGB {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return [
    Math.round(colorA[0] + (colorB[0] - colorA[0]) * clampedFactor),
    Math.round(colorA[1] + (colorB[1] - colorA[1]) * clampedFactor),
    Math.round(colorA[2] + (colorB[2] - colorA[2]) * clampedFactor),
  ];
}

/**
 * 基準色から明暗グラデーションパレットを自動生成する関数
 */
export function generateGradientPaletteFromBaseColor(
  baseHexColor: string,
): Palette {
  const baseRgb = convertHexToRgb(baseHexColor);
  const steps = 5;
  const generatedColors = [];

  const lightAnchor: ColorRGB = [245, 248, 252];
  const darkAnchor: ColorRGB = [15, 23, 42];

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    let targetRgb: ColorRGB;
    if (ratio < 0.5) {
      targetRgb = interpolateRgbColors(darkAnchor, baseRgb, ratio * 2);
    } else {
      targetRgb = interpolateRgbColors(
        baseRgb,
        lightAnchor,
        (ratio - 0.5) * 2,
      );
    }
    const hexString = `#${targetRgb
      .map((v) =>
        Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"),
      )
      .join("")}`;
    generatedColors.push({
      name: `Grade ${i + 1}`,
      hex: hexString,
      rgb: targetRgb,
    });
  }

  return {
    title: `Custom (${baseHexColor})`,
    comment: "基準色から自動生成されたグラデーションパレット",
    colors: generatedColors,
  };
}
