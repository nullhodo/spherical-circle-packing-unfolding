interface Rotated3DPoint {
  screenX: number;
  screenY: number;
  depthZ: number;
}

/**
 * 3次元ベクトルに球面の姿勢回転(X軸およびY軸)を適用する関数
 */
export function applySphereOrientationRotation(
  pointVector: [number, number, number] | number[],
  rotationAngleX: number,
  rotationAngleY: number,
): Rotated3DPoint {
  const px = pointVector[0];
  const py = pointVector[1];
  const pz = pointVector[2];

  const cosY = Math.cos(rotationAngleY);
  const sinY = Math.sin(rotationAngleY);
  const rx_Y = px * cosY + pz * sinY;
  const rz_Y = -px * sinY + pz * cosY;

  const cosX = Math.cos(rotationAngleX);
  const sinX = Math.sin(rotationAngleX);
  const ry_Final = py * cosX - rz_Y * sinX;
  const rz_Final = py * sinX + rz_Y * cosX;

  return {
    screenX: rx_Y,
    screenY: -ry_Final,
    depthZ: rz_Final,
  };
}
