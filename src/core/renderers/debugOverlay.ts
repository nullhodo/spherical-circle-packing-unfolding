import type p5 from "p5";
import type { SketchParams } from "../../types/sketch";

/**
 * デバッグ情報モニターを描画する関数
 */
export function renderDebugInformationOverlay(
  p5Instance: p5,
  params: SketchParams,
  circlesCount: number,
  sphereRadius: number,
): void {
  p5Instance.push();
  p5Instance.fill(15, 23, 42, 220);
  p5Instance.stroke(56, 189, 248, 120);
  p5Instance.strokeWeight(1);
  p5Instance.rect(20, 20, 240, 160, 8);

  p5Instance.noStroke();
  p5Instance.fill(56, 189, 248);
  p5Instance.textSize(12);
  p5Instance.textFont("monospace");
  p5Instance.text("SPHERICAL PACKING HUD", 32, 42);

  p5Instance.fill(226, 232, 240);
  p5Instance.textSize(11);
  const frameRateValue = p5Instance.frameRate().toFixed(1);
  p5Instance.text(`FPS: ${frameRateValue}`, 32, 64);
  p5Instance.text(`Circles: ${circlesCount}`, 32, 86);
  p5Instance.text(
    `Morph: ${params.morphProgress.toFixed(2)} (${params.morphProgress > 0.5 ? "2D" : "3D"})`,
    32,
    108,
  );
  p5Instance.text(`Projection: ${params.projectionMethod}`, 32, 130);
  p5Instance.text(`Radius: ${sphereRadius.toFixed(0)}px`, 32, 152);
  p5Instance.pop();
}
