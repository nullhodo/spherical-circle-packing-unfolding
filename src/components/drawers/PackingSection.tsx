import { useAtom } from "jotai";
import { CircleDot, Cpu, Grid, RefreshCw } from "lucide-react";
import type React from "react";
import { circlesAtom, sketchParamsAtom } from "../../state/sketchStore";

interface Props {
  onParamChange: <
    K extends keyof import("../../types/sketch").SketchParams,
  >(
    key: K,
    value: import("../../types/sketch").SketchParams[K],
  ) => void;
  onRecomputePacking: () => void;
}

export const PackingSection: React.FC<Props> = ({
  onParamChange,
  onRecomputePacking,
}) => {
  const [params] = useAtom(sketchParamsAtom);
  const [circles] = useAtom(circlesAtom);

  return (
    <div className="space-y-4 text-xs">
      {/* 再計算ボタン */}
      <button
        type="button"
        onClick={onRecomputePacking}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-600/80 hover:bg-sky-500 text-sky-100 font-medium transition-colors shadow-sm"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>サークルパッキング再計算</span>
      </button>

      {/* アルゴリズム選択 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            充填アルゴリズム (Algorithm)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onParamChange("packingAlgorithm", "relaxation")}
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.packingAlgorithm === "relaxation"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            高密度緩和
          </button>
          <button
            type="button"
            onClick={() =>
              onParamChange("packingAlgorithm", "hierarchical")
            }
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.packingAlgorithm === "hierarchical"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            階層充填
          </button>
          <button
            type="button"
            onClick={() => onParamChange("packingAlgorithm", "random")}
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.packingAlgorithm === "random"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            高速ランダム
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
          {params.packingAlgorithm === "relaxation" &&
            "接触反発と空間膨張シミュレーションにより、隙間を極限まで埋める高密度充填 (推奨)"}
          {params.packingAlgorithm === "hierarchical" &&
            "大円を配置後に残余ボイドを探索し、中円・小円を吸着させるアポロニアン充填"}
          {params.packingAlgorithm === "random" &&
            "速度最優先のランダム試行配置 (従来の浮遊感スタイル)"}
        </p>
      </div>

      {/* 最大円数 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span className="flex items-center gap-1.5">
            <CircleDot className="w-3.5 h-3.5 text-sky-400" />
            最大目標円数 (Max Circles)
          </span>
          <span className="font-mono text-slate-400">
            {circles.length} / {params.maxCircles}
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="1200"
          step="10"
          value={params.maxCircles}
          onChange={(e) =>
            onParamChange(
              "maxCircles",
              Number.parseInt(e.target.value, 10),
            )
          }
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      {/* 最小角半径 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span>最小角半径 (Min Radius)</span>
          <span className="font-mono text-slate-400">
            {params.minRadius.toFixed(2)} rad
          </span>
        </div>
        <input
          type="range"
          min="0.02"
          max="0.15"
          step="0.01"
          value={params.minRadius}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            onParamChange("minRadius", val);
            if (val > params.maxRadius) {
              onParamChange("maxRadius", val + 0.02);
            }
          }}
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      {/* 最大角半径 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span>最大角半径 (Max Radius)</span>
          <span className="font-mono text-slate-400">
            {params.maxRadius.toFixed(2)} rad
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="0.6"
          step="0.01"
          value={params.maxRadius}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            onParamChange("maxRadius", val);
            if (val < params.minRadius) {
              onParamChange("minRadius", Math.max(0.02, val - 0.02));
            }
          }}
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      {/* 円の分割精度 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span>円の分割精度 (Circle Segments)</span>
          <span className="font-mono text-slate-400">
            {params.circleSegments} 頂点
          </span>
        </div>
        <input
          type="range"
          min="16"
          max="128"
          step="4"
          value={params.circleSegments}
          onChange={(e) =>
            onParamChange(
              "circleSegments",
              Number.parseInt(e.target.value, 10),
            )
          }
          className="w-full accent-sky-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          <span>軽量 (16)</span>
          <span>標準 (64)</span>
          <span>超高精細 (128)</span>
        </div>
      </div>

      {/* 線・グリッドのオプション */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={params.showStroke}
            onChange={(e) => onParamChange("showStroke", e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span>円の輪郭線を描画 (Stroke)</span>
        </label>

        {params.showStroke && (
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
              <span>輪郭線幅</span>
              <span className="font-mono text-slate-400">
                {params.strokeWeight.toFixed(1)}px
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={params.strokeWeight}
              onChange={(e) =>
                onParamChange(
                  "strokeWeight",
                  Number.parseFloat(e.target.value),
                )
              }
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={params.showGrid}
            onChange={(e) => onParamChange("showGrid", e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
          />
          <Grid className="w-3.5 h-3.5 text-indigo-400" />
          <span>経緯線グリッドを表示 (Graticule)</span>
        </label>
      </div>
    </div>
  );
};
