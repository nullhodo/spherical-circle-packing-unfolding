import { useAtom } from "jotai";
import {
  CircleDotIcon,
  GlobeIcon,
  GridIcon,
  RefreshCwIcon,
} from "lucide-react";
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
    <div className="space-y-3 bg-white/50 backdrop-blur-md p-3.5 rounded-md border border-white/50 shadow-xs">
      <div className="font-bold text-gray-900 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CircleDotIcon className="w-4 h-4 text-gray-700" />
          サークルパッキング配置
        </div>
        <span className="text-[11px] font-mono text-gray-500 font-normal">
          {circles.length} 円
        </span>
      </div>

      {/* 再計算ボタン */}
      <button
        type="button"
        onClick={onRecomputePacking}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-gray-900/90 hover:bg-gray-900 text-white font-medium transition cursor-pointer text-xs shadow-xs active:scale-[0.99]"
      >
        <RefreshCwIcon className="w-3.5 h-3.5" />
        <span>サークルパッキング再計算</span>
      </button>

      {/* 充填アルゴリズム選択 */}
      <div className="space-y-1">
        <span className="text-[11px] text-gray-600 block font-medium">
          充填アルゴリズム (Algorithm)
        </span>
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100/80 rounded-md border border-gray-200/80">
          <button
            type="button"
            onClick={() => onParamChange("packingAlgorithm", "maximal")}
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.packingAlgorithm === "maximal"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            最大空隙充填
          </button>
          <button
            type="button"
            onClick={() => onParamChange("packingAlgorithm", "powerlaw")}
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.packingAlgorithm === "powerlaw"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            べき乗則接触
          </button>
          <button
            type="button"
            onClick={() => onParamChange("packingAlgorithm", "random")}
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.packingAlgorithm === "random"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            高速ランダム
          </button>
        </div>
        <p className="text-[10px] text-gray-500 leading-tight pt-0.5">
          {params.packingAlgorithm === "maximal" &&
            "最大の空隙に限界サイズの円を次々配置する高充填型。球面の表面積を大胆にカバー (推奨)"}
          {params.packingAlgorithm === "powerlaw" &&
            "フラクタル黄金比率（べき乗則）に基づき、接する円の谷間に次々とカチッと噛み合わせる高速連鎖成長"}
          {params.packingAlgorithm === "random" &&
            "速度最優先のランダム試行配置 (従来の浮遊感スタイル)"}
        </p>
      </div>

      {/* 最大目標円数 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>最大目標円数 (Max Circles)</span>
          <span className="font-mono text-gray-900 font-semibold">
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
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
      </div>

      {/* 最小角半径 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>最小角半径 (Min Radius)</span>
          <span className="font-mono text-gray-900 font-semibold">
            {params.minRadius.toFixed(3)} rad
          </span>
        </div>
        <input
          type="range"
          min="0.001"
          max="0.15"
          step="0.001"
          value={params.minRadius}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            onParamChange("minRadius", val);
            if (val > params.maxRadius) {
              onParamChange("maxRadius", val + 0.01);
            }
          }}
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
      </div>

      {/* 最大角半径 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>最大角半径 (Max Radius)</span>
          <span className="font-mono text-gray-900 font-semibold">
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
              onParamChange("minRadius", Math.max(0.001, val - 0.01));
            }
          }}
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
      </div>

      {/* 円の分割精度 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>円の分割精度 (Circle Segments)</span>
          <span className="font-mono text-gray-900 font-semibold">
            {params.circleSegments} 頂点
          </span>
        </div>
        <input
          type="range"
          min="16"
          max="256"
          step="4"
          value={params.circleSegments}
          onChange={(e) =>
            onParamChange(
              "circleSegments",
              Number.parseInt(e.target.value, 10),
            )
          }
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
        <div className="relative h-3.5 text-[10px] text-gray-500 select-none">
          <button
            type="button"
            onClick={() => onParamChange("circleSegments", 16)}
            className={`absolute left-0 hover:text-gray-900 cursor-pointer transition-colors ${
              params.circleSegments === 16
                ? "font-semibold text-emerald-700"
                : ""
            }`}
          >
            軽量(16)
          </button>
          <button
            type="button"
            onClick={() => onParamChange("circleSegments", 64)}
            style={{ left: "calc(7px + (100% - 14px) * 0.2)" }}
            className={`absolute -translate-x-1/2 hover:text-gray-900 cursor-pointer transition-colors whitespace-nowrap ${
              params.circleSegments === 64
                ? "font-semibold text-emerald-700"
                : ""
            }`}
          >
            標準(64)
          </button>
          <button
            type="button"
            onClick={() => onParamChange("circleSegments", 128)}
            style={{ left: "calc(7px + (100% - 14px) * 0.4667)" }}
            className={`absolute -translate-x-1/2 hover:text-gray-900 cursor-pointer transition-colors whitespace-nowrap ${
              params.circleSegments === 128
                ? "font-semibold text-emerald-700"
                : ""
            }`}
          >
            高精細(128)
          </button>
          <button
            type="button"
            onClick={() => onParamChange("circleSegments", 256)}
            className={`absolute right-0 hover:text-gray-900 cursor-pointer transition-colors ${
              params.circleSegments === 256
                ? "font-semibold text-emerald-700"
                : ""
            }`}
          >
            極限(256)
          </button>
        </div>
      </div>

      {/* 線・グリッドのオプション */}
      <div className="pt-2 border-t border-gray-200/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs flex items-center gap-1.5">
            <GlobeIcon className="w-3.5 h-3.5 text-gray-700" />
            球面曲面にフィット (Fit Sphere)
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={params.fitSphericalSurface}
              onChange={(e) =>
                onParamChange("fitSphericalSurface", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>

        {params.fitSphericalSurface && (
          <div className="pt-1 pl-2 border-l-2 border-emerald-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
              <span>球面フィット精度 (Dome Rings)</span>
              <span className="font-mono text-gray-900 font-semibold">
                {params.domeRings} 段
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={params.domeRings}
              onChange={(e) =>
                onParamChange(
                  "domeRings",
                  Number.parseInt(e.target.value, 10),
                )
              }
              className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
            />
            <div className="relative h-3.5 text-[10px] text-gray-500 select-none">
              <button
                type="button"
                onClick={() => onParamChange("domeRings", 1)}
                className={`absolute left-0 hover:text-gray-900 cursor-pointer transition-colors ${
                  params.domeRings === 1
                    ? "font-semibold text-emerald-700"
                    : ""
                }`}
              >
                軽量(1)
              </button>
              <button
                type="button"
                onClick={() => onParamChange("domeRings", 4)}
                style={{ left: "calc(7px + (100% - 14px) * 0.2)" }}
                className={`absolute -translate-x-1/2 hover:text-gray-900 cursor-pointer transition-colors whitespace-nowrap ${
                  params.domeRings === 4
                    ? "font-semibold text-emerald-700"
                    : ""
                }`}
              >
                標準(4)
              </button>
              <button
                type="button"
                onClick={() => onParamChange("domeRings", 8)}
                style={{ left: "calc(7px + (100% - 14px) * 0.4667)" }}
                className={`absolute -translate-x-1/2 hover:text-gray-900 cursor-pointer transition-colors whitespace-nowrap ${
                  params.domeRings === 8
                    ? "font-semibold text-emerald-700"
                    : ""
                }`}
              >
                高精細(8)
              </button>
              <button
                type="button"
                onClick={() => onParamChange("domeRings", 16)}
                className={`absolute right-0 hover:text-gray-900 cursor-pointer transition-colors ${
                  params.domeRings === 16
                    ? "font-semibold text-emerald-700"
                    : ""
                }`}
              >
                極限(16)
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs flex items-center gap-1.5">
            <GridIcon className="w-3.5 h-3.5 text-gray-700" />
            経緯線グリッドを表示 (Graticule)
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={params.showGrid}
              onChange={(e) => onParamChange("showGrid", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>

        {params.showGrid && (
          <div className="pt-1 pl-2 border-l-2 border-gray-200 space-y-1">
            <span className="text-[11px] text-gray-600 font-medium">
              グリッド配置階層 (Layering)
            </span>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-100/80 rounded-md border border-gray-200/80">
              <button
                type="button"
                onClick={() => onParamChange("gridLayerMode", "underlay")}
                className={`py-1 px-1 rounded text-[10px] font-medium transition-all text-center cursor-pointer ${
                  params.gridLayerMode === "underlay"
                    ? "bg-gray-900 text-white shadow-xs"
                    : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
                }`}
              >
                円の背面 (推奨)
              </button>
              <button
                type="button"
                onClick={() => onParamChange("gridLayerMode", "overlay")}
                className={`py-1 px-1 rounded text-[10px] font-medium transition-all text-center cursor-pointer ${
                  params.gridLayerMode === "overlay"
                    ? "bg-gray-900 text-white shadow-xs"
                    : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
                }`}
              >
                円の前面 (重畳)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
