import { useAtom } from "jotai";
import {
  Activity,
  Compass,
  Globe,
  Play,
  RotateCw,
  UnfoldHorizontal,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { PROJECTION_OPTIONS } from "../../constants/projections";
import {
  liveMorphProgress,
  sketchParamsAtom,
} from "../../state/sketchStore";
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
  const sliderRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  // 自動モーフィングアニメーションがオンのとき、スライダーと数値を高精度・軽量にリアルタイム追従させる
  useEffect(() => {
    if (!params.isAutoMorph) return;

    let animId: number;
    const update = () => {
      const val = liveMorphProgress.value;
      if (sliderRef.current) {
        sliderRef.current.value = val.toString();
      }
      if (labelRef.current) {
        labelRef.current.textContent = val.toFixed(2);
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [params.isAutoMorph]);

  return (
    <div className="space-y-4 text-xs">
      {/* モーフィングスライダー */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            展開モーフィング (Morph)
          </span>
          <span ref={labelRef} className="font-mono text-slate-400">
            {params.morphProgress.toFixed(2)}
          </span>
        </div>
        <input
          ref={sliderRef}
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

      {/* 展開アニメーション方式 (Transition Style) */}
      <div>
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
          <span className="flex items-center gap-1.5">
            <UnfoldHorizontal className="w-3.5 h-3.5 text-sky-400" />
            展開の開き方 (Transition)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onParamChange("morphTransitionMode", "direct")}
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.morphTransitionMode === "direct"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-900"
            }`}
          >
            ダイレクト
          </button>
          <button
            type="button"
            onClick={() =>
              onParamChange("morphTransitionMode", "cylinder")
            }
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.morphTransitionMode === "cylinder"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-900"
            }`}
          >
            1. 円筒展開
          </button>
          <button
            type="button"
            onClick={() => onParamChange("morphTransitionMode", "unroll")}
            className={`py-1.5 px-1 rounded text-[11px] font-medium transition-all text-center ${
              params.morphTransitionMode === "unroll"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-900"
            }`}
          >
            2. 両開き展開
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
          {params.morphTransitionMode === "direct" &&
            "従来の直線ワープ。自転しながら画面上で直線的に四角形へと変形吸着"}
          {params.morphTransitionMode === "cylinder" &&
            "シリンダー経由。球体が円筒を経て裏側の継ぎ目から左右にパカッと開く等長アンロール"}
          {params.morphTransitionMode === "unroll" &&
            "両開き展開。自転を正面に整列させ、背中から本を開くように左右へめくれていく扇状展開"}
        </p>
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
            onChange={(e) => {
              const checked = e.target.checked;
              if (!checked) {
                onParamChange("morphProgress", liveMorphProgress.value);
              }
              onParamChange("isAutoMorph", checked);
            }}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          <span>自動モーフィングアニメーション</span>
        </label>

        {/* 自動モーフィングがオンのときのみ表示されるモーフィング速度スライダ */}
        {params.isAutoMorph && (
          <div className="pl-2 border-l-2 border-sky-500/40 space-y-1.5 transition-all">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                モーフィング速度 (Morph Speed)
              </span>
              <span className="font-mono text-slate-400">
                {params.morphSpeed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={params.morphSpeed}
              onChange={(e) =>
                onParamChange(
                  "morphSpeed",
                  Number.parseFloat(e.target.value),
                )
              }
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
        )}

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
