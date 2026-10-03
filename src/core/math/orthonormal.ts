interface OrthonormalBasis {
  basisVectorU: [number, number, number];
  basisVectorV: [number, number, number];
}

/**
 * 法線ベクトルに対して直交する正規直交基底(U, V)を計算する関数
 * 極点特異点を解消し、任意の球面上位置で正確な円環を生成する
 */
export function computeOrthonormalBasisForVector(
  normalX: number,
  normalY: number,
  normalZ: number,
): OrthonormalBasis {
  let referenceX = 0;
  let referenceY = 1;
  let referenceZ = 0;

  if (Math.abs(normalY) > 0.92) {
    referenceX = 1;
    referenceY = 0;
    referenceZ = 0;
  }

  // U = Normal x Reference
  let vectorUx = normalY * referenceZ - normalZ * referenceY;
  let vectorUy = normalZ * referenceX - normalX * referenceZ;
  let vectorUz = normalX * referenceY - normalY * referenceX;
  const lengthU = Math.hypot(vectorUx, vectorUy, vectorUz) || 1e-6;
  vectorUx /= lengthU;
  vectorUy /= lengthU;
  vectorUz /= lengthU;

  // V = Normal x U
  const vectorVx = normalY * vectorUz - normalZ * vectorUy;
  const vectorVy = normalZ * vectorUx - normalX * vectorUz;
  const vectorVz = normalX * vectorUy - normalY * vectorUx;

  return {
    basisVectorU: [vectorUx, vectorUy, vectorUz],
    basisVectorV: [vectorVx, vectorVy, vectorVz],
  };
}
