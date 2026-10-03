import { describe, expect, it } from "vitest";
import { computeSphericalCirclePacking } from "../core/math/packing";
import type { Palette } from "../types/sketch";

const mockPalette: Palette = {
  title: "Test Palette",
  comment: "Unit test palette",
  colors: [
    { name: "Navy", hex: "#0A192F", rgb: [10, 25, 47] },
    { name: "Cyan", hex: "#64FFDA", rgb: [100, 255, 218] },
    { name: "Slate", hex: "#8892B0", rgb: [136, 146, 176] },
  ],
};

describe("computeSphericalCirclePacking", () => {
  it("generates circles using dense relaxation algorithm", () => {
    const circles = computeSphericalCirclePacking({
      maxCircles: 50,
      minRadius: 0.05,
      maxRadius: 0.3,
      palette: mockPalette,
      isExclusiveBackground: false,
      algorithm: "relaxation",
    });

    expect(circles.length).toBeGreaterThan(15);
    for (const c of circles) {
      expect(c.angularRadius).toBeGreaterThanOrEqual(0.045);
      expect(c.angularRadius).toBeLessThanOrEqual(0.35);

      // 法線ベクトルのノルムが 1 (球面上) であることを確認
      const [x, y, z] = c.normalVector;
      const len = Math.sqrt(x * x + y * y + z * z);
      expect(len).toBeCloseTo(1.0, 4);
    }
  });

  it("strictly guarantees zero overlap among all circle pairs (especially small circles)", () => {
    const circles = computeSphericalCirclePacking({
      maxCircles: 120,
      minRadius: 0.02,
      maxRadius: 0.4,
      palette: mockPalette,
      isExclusiveBackground: false,
      algorithm: "relaxation",
    });

    expect(circles.length).toBeGreaterThan(30);

    // 全ペアで角距離 >= 半径和 (重なりゼロ) であることを検証
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const cA = circles[i];
        const cB = circles[j];
        const dot =
          cA.normalVector[0] * cB.normalVector[0] +
          cA.normalVector[1] * cB.normalVector[1] +
          cA.normalVector[2] * cB.normalVector[2];
        const angularDist = Math.acos(Math.max(-1, Math.min(1, dot)));
        const requiredDist = cA.angularRadius + cB.angularRadius;

        expect(angularDist + 1e-4).toBeGreaterThanOrEqual(requiredDist);
      }
    }
  });

  it("generates circles using hierarchical Apollonian algorithm", () => {
    const circles = computeSphericalCirclePacking({
      maxCircles: 50,
      minRadius: 0.04,
      maxRadius: 0.25,
      palette: mockPalette,
      isExclusiveBackground: false,
      algorithm: "hierarchical",
    });

    expect(circles.length).toBeGreaterThan(15);
    for (const c of circles) {
      expect(c.angularRadius).toBeGreaterThanOrEqual(0.035);
      expect(c.angularRadius).toBeLessThanOrEqual(0.26);
    }
  });

  it("generates circles using fast random algorithm", () => {
    const circles = computeSphericalCirclePacking({
      maxCircles: 40,
      minRadius: 0.05,
      maxRadius: 0.2,
      palette: mockPalette,
      isExclusiveBackground: false,
      algorithm: "random",
    });

    expect(circles.length).toBeGreaterThan(5);
  });

  it("respects isExclusiveBackground by omitting the first palette color", () => {
    const circles = computeSphericalCirclePacking({
      maxCircles: 30,
      minRadius: 0.05,
      maxRadius: 0.2,
      palette: mockPalette,
      isExclusiveBackground: true,
      algorithm: "relaxation",
    });

    for (const c of circles) {
      const isNavy =
        c.primaryColor[0] === 10 &&
        c.primaryColor[1] === 25 &&
        c.primaryColor[2] === 47;
      expect(isNavy).toBe(false);
    }
  });
});
