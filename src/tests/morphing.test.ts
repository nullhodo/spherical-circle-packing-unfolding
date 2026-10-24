import { describe, expect, it } from "vitest";
import { computeMorphedPoint2D } from "../core/math/morphing";

describe("computeMorphedPoint2D", () => {
  const baseRadius = 200;
  const lon = 0.5;
  const lat = 0.3;
  const px = Math.cos(lat) * Math.cos(lon);
  const py = Math.sin(lat);
  const pz = Math.cos(lat) * Math.sin(lon);

  const testParams = {
    point3D: [px, py, pz] as [number, number, number],
    lon,
    lat,
    baseRadius,
    projectionMethod: "mercator" as const,
    projectionScaleMultiplier: 1.0,
    rotationAngleX: 0.1,
    rotationAngleY: 0.2,
  };

  it("should match sphere at progress 0 for all transition modes", () => {
    const direct0 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 0,
      transitionMode: "direct",
    });
    const cylinder0 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 0,
      transitionMode: "cylinder",
    });
    const unroll0 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 0,
      transitionMode: "unroll",
    });

    expect(direct0.x).toBeCloseTo(cylinder0.x, 3);
    expect(direct0.y).toBeCloseTo(cylinder0.y, 3);
    expect(direct0.x).toBeCloseTo(unroll0.x, 3);
    expect(direct0.y).toBeCloseTo(unroll0.y, 3);
  });

  it("should match planar projection at progress 1 for all transition modes", () => {
    const direct1 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 1,
      transitionMode: "direct",
    });
    const cylinder1 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 1,
      transitionMode: "cylinder",
    });
    const unroll1 = computeMorphedPoint2D({
      ...testParams,
      currentMorphProgress: 1,
      transitionMode: "unroll",
    });

    expect(direct1.x).toBeCloseTo(cylinder1.x, 3);
    expect(direct1.y).toBeCloseTo(cylinder1.y, 3);
    expect(direct1.x).toBeCloseTo(unroll1.x, 3);
    expect(direct1.y).toBeCloseTo(unroll1.y, 3);
  });

  it("should compute continuous and finite values mid-transition", () => {
    for (const mode of ["direct", "cylinder", "unroll"] as const) {
      for (const t of [0.25, 0.5, 0.75]) {
        const res = computeMorphedPoint2D({
          ...testParams,
          currentMorphProgress: t,
          transitionMode: mode,
        });
        expect(Number.isFinite(res.x)).toBe(true);
        expect(Number.isFinite(res.y)).toBe(true);
        expect(Number.isFinite(res.depthZ)).toBe(true);
      }
    }
  });
});
