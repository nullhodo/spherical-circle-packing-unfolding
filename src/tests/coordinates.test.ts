import { describe, expect, it } from "vitest";
import { convertCartesianToSphericalCoordinates } from "../core/math/coordinates";

describe("convertCartesianToSphericalCoordinates", () => {
  it("converts positive X axis to longitude 0, latitude 0", () => {
    const { longitude, latitude } = convertCartesianToSphericalCoordinates(
      1,
      0,
      0,
    );
    expect(longitude).toBeCloseTo(0);
    expect(latitude).toBeCloseTo(0);
  });

  it("converts North pole (Y = 1) to latitude PI/2", () => {
    const { latitude } = convertCartesianToSphericalCoordinates(0, 1, 0);
    expect(latitude).toBeCloseTo(Math.PI / 2);
  });

  it("converts South pole (Y = -1) to latitude -PI/2", () => {
    const { latitude } = convertCartesianToSphericalCoordinates(0, -1, 0);
    expect(latitude).toBeCloseTo(-Math.PI / 2);
  });

  it("converts positive Z axis to longitude PI/2", () => {
    const { longitude, latitude } = convertCartesianToSphericalCoordinates(
      0,
      0,
      1,
    );
    expect(longitude).toBeCloseTo(Math.PI / 2);
    expect(latitude).toBeCloseTo(0);
  });
});
