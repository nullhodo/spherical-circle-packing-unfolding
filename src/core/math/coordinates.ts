/**
 * 3次元単位ベクトルを球面座標 (経度 longitude, 緯度 latitude) に変換する関数
 * @param xCoordinate X座標 (-1〜1)
 * @param yCoordinate Y座標 (-1〜1)
 * @param zCoordinate Z座標 (-1〜1)
 * @returns { longitude: number; latitude: number } 経度・緯度 (ラジアン)
 */
export function convertCartesianToSphericalCoordinates(
  xCoordinate: number,
  yCoordinate: number,
  zCoordinate: number,
): { longitude: number; latitude: number } {
  const longitudeAngle = Math.atan2(zCoordinate, xCoordinate);
  const latitudeAngle = Math.asin(Math.max(-1, Math.min(1, yCoordinate)));
  return { longitude: longitudeAngle, latitude: latitudeAngle };
}
