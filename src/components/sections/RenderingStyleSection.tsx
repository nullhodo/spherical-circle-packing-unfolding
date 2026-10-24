import { useAtom } from "jotai";
import { EyeIcon, PaintbrushIcon, SparklesIcon } from "lucide-react";
import type React from "react";
import { sketchParamsAtom } from "../../state/sketchStore";

interface Props {
  onParamChange: <
    K extends keyof import("../../types/sketch").SketchParams,
  >(
    key: K,
    value: import("../../types/sketch").SketchParams[K],
  ) => void;
}

export const RenderingStyleSection: React.FC<Props> = ({
  onParamChange,
}) => {
  const [params] = useAtom(sketchParamsAtom);

  return (
    <div className="space-y-3 bg-white/50 backdrop-blur-md p-3.5 rounded-md border border-white/50 shadow-xs">
      <div className="font-bold text-gray-900 flex items-center gap-2 text-xs">
        <PaintbrushIcon className="w-4 h-4 text-gray-700" />
        描画マテリアル &amp; エフェクト
      </div>

      {/* 輪郭線ストローク設定 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs">
            円の輪郭線を描画 (Stroke)
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={params.showStroke}
              onChange={(e) =>
                onParamChange("showStroke", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>

        {params.showStroke && (
          <div className="space-y-1 pl-2 border-l-2 border-gray-200">
            <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
              <span>輪郭線の太さ</span>
              <span className="font-mono text-gray-900 font-semibold">
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
              className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* フィルムグレイン & デバッグHUD */}
      <div className="pt-2 border-t border-gray-200/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs flex items-center gap-1.5">
            <SparklesIcon className="w-3.5 h-3.5 text-gray-600" />
            フィルム粒子ノイズ (Film Grain)
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={params.showFilmGrain}
              onChange={(e) =>
                onParamChange("showFilmGrain", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs flex items-center gap-1.5">
            <EyeIcon className="w-3.5 h-3.5 text-gray-600" />
            HUD デバッグ情報表示 (D)
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={params.isDebugMode}
              onChange={(e) =>
                onParamChange("isDebugMode", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>
      </div>
    </div>
  );
};
