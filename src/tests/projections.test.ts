import { describe, expect, it } from "vitest";
import { projectSphericalCoordinatesToPlane } from "../core/math/projections";

describe("projectSphericalCoordinatesToPlane", () => {
  const radius = 200;

  it("projects center (lon 0, lat 0) to origin in Winkel Tripel", () => {
    const { planarX, planarY } = projectSphericalCoordinatesToPlane(
      0,
      0,
      radius,
      "winkel",
    );
    expect(planarX).toBeCloseTo(0);
    expect(planarY).toBeCloseTo(0);
  });

  it("projects center (lon 0, lat 0) to origin in Mercator", () => {
    const { planarX, planarY } = projectSphericalCoordinatesToPlane(
      0,
      0,
      radius,
      "mercator",
    );
    expect(planarX).toBeCloseTo(0);
    expect(planarY).toBeCloseTo(0);
  });

  it("projects center (lon 0, lat 0) to origin in Mollweide", () => {
    const { planarX, planarY } = projectSphericalCoordinatesToPlane(
      0,
      0,
      radius,
      "mollweide",
    );
    expect(planarX).toBeCloseTo(0);
    expect(planarY).toBeCloseTo(0);
  });

  it("projects symmetrically across the equator in Mercator", () => {
    const north = projectSphericalCoordinatesToPlane(
      0.5,
      0.8,
      radius,
      "mercator",
    );
    const south = projectSphericalCoordinatesToPlane(
      0.5,
      -0.8,
      radius,
      "mercator",
    );
    expect(north.planarX).toBeCloseTo(south.planarX);
    expect(north.planarY).toBeCloseTo(-south.planarY);
  });

  it("scales with projectionScaleMultiplier", () => {
    const normal = projectSphericalCoordinatesToPlane(
      1.0,
      0.5,
      radius,
      "winkel",
      1.0,
    );
    const doubled = projectSphericalCoordinatesToPlane(
      1.0,
      0.5,
      radius,
      "winkel",
      2.0,
    );
    expect(doubled.planarX).toBeCloseTo(normal.planarX * 2);
    expect(doubled.planarY).toBeCloseTo(normal.planarY * 2);
  });
});
