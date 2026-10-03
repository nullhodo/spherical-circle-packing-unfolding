import { describe, expect, it } from "vitest";
import { computeOrthonormalBasisForVector } from "../core/math/orthonormal";

describe("computeOrthonormalBasisForVector", () => {
  it("produces orthogonal unit vectors U and V perpendicular to normal vector", () => {
    const nx = 0.57735;
    const ny = 0.57735;
    const nz = 0.57735;

    const { basisVectorU, basisVectorV } =
      computeOrthonormalBasisForVector(nx, ny, nz);

    // Length of U should be 1
    const lenU = Math.hypot(...basisVectorU);
    expect(lenU).toBeCloseTo(1, 4);

    // Length of V should be 1
    const lenV = Math.hypot(...basisVectorV);
    expect(lenV).toBeCloseTo(1, 4);

    // Dot product of Normal and U should be 0
    const dotNormalU =
      nx * basisVectorU[0] + ny * basisVectorU[1] + nz * basisVectorU[2];
    expect(dotNormalU).toBeCloseTo(0, 4);

    // Dot product of Normal and V should be 0
    const dotNormalV =
      nx * basisVectorV[0] + ny * basisVectorV[1] + nz * basisVectorV[2];
    expect(dotNormalV).toBeCloseTo(0, 4);

    // Dot product of U and V should be 0
    const dotUV =
      basisVectorU[0] * basisVectorV[0] +
      basisVectorU[1] * basisVectorV[1] +
      basisVectorU[2] * basisVectorV[2];
    expect(dotUV).toBeCloseTo(0, 4);
  });

  it("handles singularity near the Y poles smoothly", () => {
    const { basisVectorU, basisVectorV } =
      computeOrthonormalBasisForVector(0, 1, 0);
    const lenU = Math.hypot(...basisVectorU);
    const lenV = Math.hypot(...basisVectorV);
    expect(lenU).toBeCloseTo(1, 4);
    expect(lenV).toBeCloseTo(1, 4);
  });
});
