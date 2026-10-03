import { describe, expect, it } from "vitest";
import {
  convertHexToRgb,
  generateGradientPaletteFromBaseColor,
  interpolateRgbColors,
} from "../utils/color";

describe("color utilities", () => {
  it("converts hex to rgb correctly", () => {
    expect(convertHexToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(convertHexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(convertHexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(convertHexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("interpolates colors linearly", () => {
    const black: [number, number, number] = [0, 0, 0];
    const white: [number, number, number] = [200, 200, 200];
    expect(interpolateRgbColors(black, white, 0.5)).toEqual([
      100, 100, 100,
    ]);
    expect(interpolateRgbColors(black, white, 0)).toEqual([0, 0, 0]);
    expect(interpolateRgbColors(black, white, 1)).toEqual([200, 200, 200]);
  });

  it("generates gradient palette from base color", () => {
    const palette = generateGradientPaletteFromBaseColor("#38bdf8");
    expect(palette.colors.length).toBe(5);
    expect(palette.title).toContain("#38bdf8");
  });
});
