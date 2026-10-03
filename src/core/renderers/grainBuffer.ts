import type p5 from "p5";

/**
 * ざらついた質感のためのフィルムグレインバッファを生成する関数
 */
export function createFilmGrainTextureBuffer(
  p5Instance: p5,
  textureWidth: number,
  textureHeight: number,
): p5.Graphics {
  const grainBuffer = p5Instance.createGraphics(
    textureWidth,
    textureHeight,
  );
  grainBuffer.pixelDensity(1);
  grainBuffer.loadPixels();

  const pixelsLength = grainBuffer.pixels.length;
  for (let i = 0; i < pixelsLength; i += 4) {
    const noiseIntensity = Math.floor(Math.random() * 255);
    grainBuffer.pixels[i] = noiseIntensity;
    grainBuffer.pixels[i + 1] = noiseIntensity;
    grainBuffer.pixels[i + 2] = noiseIntensity;
    grainBuffer.pixels[i + 3] = Math.floor(Math.random() * 22) + 6; // 微細なノイズ不透明度
  }

  grainBuffer.updatePixels();
  return grainBuffer;
}
