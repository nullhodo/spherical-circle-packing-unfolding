import { useAtom } from "jotai";
import { Compass, Globe, Play, RotateCw } from "lucide-react";
import type React from "react";
import { PROJECTION_OPTIONS } from "../../constants/projections";
import { sketchParamsAtom } from "../../state/sketchStore";
import type { ProjectionMethod } from "../../types/sketch";

interface Props {
  onParamChange: <
    K extends keyof import("../../types/sketch").SketchParams,
  >(
    key: K,
    value: import("../../types/sketch").SketchParams[K],
    skipHistory?: boolean,
  ) => void;
}

export const ProjectionSection: React.FC<Props> = ({ onParamChange }) => {
  const [params] = useAtom(sketchParamsAtom);

  return (
    <div className="space-y-4 text-xs">
      {/* モーフィングスライダー */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            展開モーフィング (Morph)
          </span>
          <span className="font-mono text-slate-400">
            {params.morphProgress.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={params.morphProgress}
          onInput={(e) => {
            const val = Number.parseFloat(
              (e.target as HTMLInputElement).value,
            );
            onParamChange("morphProgress", val, true);
            if (params.isAutoMorph) {
              onParamChange("isAutoMorph", false, true);
            }
          }}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            onParamChange("morphProgress", val);
            if (params.isAutoMorph) {
              onParamChange("isAutoMorph", false);
            }
          }}
          className="w-full accent-sky-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          <span>3D 球面 (0.0)</span>
          <span>2D 平面展開 (1.0)</span>
        </div>
      </div>

      {/* 投影法選択 */}
      <div>
        <span className="flex items-center gap-1.5 text-slate-300 font-medium mb-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          地図投影法 (Projection)
        </span>
        <select
          value={params.projectionMethod}
          onChange={(e) =>
            onParamChange(
              "projectionMethod",
              e.target.value as ProjectionMethod,
            )
          }
          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-400"
        >
          {PROJECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-500 mt-1">
          {
            PROJECTION_OPTIONS.find(
              (o) => o.value === params.projectionMethod,
            )?.description
          }
        </p>
      </div>

      {/* 展開スケール倍率 */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span>展開後スケール倍率</span>
          <span className="font-mono text-slate-400">
            {params.projectionScale.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.05"
          value={params.projectionScale}
          onChange={(e) =>
            onParamChange(
              "projectionScale",
              Number.parseFloat(e.target.value),
            )
          }
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      {/* 自動モーフィング & 回転速度 */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={params.isAutoMorph}
            onChange={(e) =>
              onParamChange("isAutoMorph", e.target.checked)
            }
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          <span>自動モーフィングアニメーション</span>
        </label>

        <div>
          <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
            <span className="flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              自転速度 (Rotation Speed)
            </span>
            <span className="font-mono text-slate-400">
              {params.rotationSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={params.rotationSpeed}
            onChange={(e) =>
              onParamChange(
                "rotationSpeed",
                Number.parseFloat(e.target.value),
              )
            }
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
