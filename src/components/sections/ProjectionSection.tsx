import { useAtom } from "jotai";
import {
  ActivityIcon,
  DicesIcon,
  GlobeIcon,
  PlayIcon,
  RotateCwIcon,
  ScissorsIcon,
  ShuffleIcon,
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
    <div className="space-y-3 bg-white/50 backdrop-blur-md p-3.5 rounded-md border border-white/50 shadow-xs">
      <div className="font-bold text-gray-900 flex items-center gap-2 text-xs">
        <GlobeIcon className="w-4 h-4 text-gray-700" />
        地図投影 &amp; 展開モーフィング
      </div>

      {/* モーフィングスライダー */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>展開モーフィング (Morph)</span>
          <span
            ref={labelRef}
            className="font-mono text-gray-900 font-semibold"
          >
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
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>3D 球面 (0.0)</span>
          <span>2D 平面展開 (1.0)</span>
        </div>
      </div>

      {/* 展開アニメーション方式 (Transition Style) */}
      <div className="space-y-1">
        <span className="text-[11px] text-gray-600 block font-medium">
          展開の開き方 (Transition)
        </span>
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100/80 rounded-md border border-gray-200/80">
          <button
            type="button"
            onClick={() => onParamChange("morphTransitionMode", "direct")}
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.morphTransitionMode === "direct"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            ダイレクト
          </button>
          <button
            type="button"
            onClick={() =>
              onParamChange("morphTransitionMode", "cylinder")
            }
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.morphTransitionMode === "cylinder"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            1. 円筒展開
          </button>
          <button
            type="button"
            onClick={() => onParamChange("morphTransitionMode", "unroll")}
            className={`py-1 px-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer ${
              params.morphTransitionMode === "unroll"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-700 hover:text-gray-900 hover:bg-white/80"
            }`}
          >
            2. 両開き展開
          </button>
        </div>
        <p className="text-[10px] text-gray-500 leading-tight pt-0.5">
          {params.morphTransitionMode === "direct" &&
            "直線ワープ。自転しながら画面上で直線的に四角形へと変形吸着"}
          {params.morphTransitionMode === "cylinder" &&
            "シリンダー経由。球体が円筒を経て裏側の継ぎ目から左右にパカッと開く等長アンロール"}
          {params.morphTransitionMode === "unroll" &&
            "両開き展開。自転を正面に整列させ、背中から本を開くように左右へめくれていく扇状展開"}
        </p>
      </div>

      {/* 地図投影法選択 */}
      <div className="space-y-1">
        <label
          htmlFor="projection-method-select"
          className="text-[11px] text-gray-600 block font-medium"
        >
          地図投影法 (Projection)
        </label>
        <select
          id="projection-method-select"
          value={params.projectionMethod}
          onChange={(e) =>
            onParamChange(
              "projectionMethod",
              e.target.value as ProjectionMethod,
            )
          }
          className="w-full bg-white/70 hover:bg-white/95 border border-gray-300/80 text-gray-900 rounded p-1.5 text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none cursor-pointer shadow-2xs transition"
        >
          {PROJECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-500">
          {
            PROJECTION_OPTIONS.find(
              (o) => o.value === params.projectionMethod,
            )?.description
          }
        </p>
      </div>

      {/* 展開スケール倍率 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
          <span>展開後スケール倍率</span>
          <span className="font-mono text-gray-900 font-semibold">
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
          className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
        />
      </div>

      {/* 切り分け経線 (Seam Meridian) & 毎回ランダム */}
      <div className="space-y-2 pt-2 border-t border-gray-200/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-700 font-semibold flex items-center gap-1.5">
            <ScissorsIcon className="w-3.5 h-3.5 text-rose-500" />
            切り分け経線 (ちぎり線)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="ランダムな角度に変更"
              onClick={() => {
                const randDeg = Math.round(Math.random() * 360 - 180);
                onParamChange("seamLongitude", (randDeg * Math.PI) / 180);
              }}
              className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 cursor-pointer transition shadow-2xs text-[10px] flex items-center gap-0.5 border border-gray-200"
            >
              <DicesIcon className="w-3 h-3 text-emerald-600" />
              <span>ランダム</span>
            </button>
            <button
              type="button"
              title="背中 (180°) にリセット"
              onClick={() => onParamChange("seamLongitude", Math.PI)}
              className="px-1.5 py-0.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200/80 cursor-pointer transition shadow-2xs text-[10px] border border-gray-200"
            >
              180°
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
            <span>展開シーム位置</span>
            <span className="font-mono text-gray-900 font-semibold">
              {Math.round((params.seamLongitude * 180) / Math.PI)}°
            </span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={Math.round((params.seamLongitude * 180) / Math.PI)}
            onChange={(e) => {
              const deg = Number.parseFloat(e.target.value);
              onParamChange("seamLongitude", (deg * Math.PI) / 180);
            }}
            className="w-full accent-rose-500 bg-gray-200/80 rounded h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>-180° (西)</span>
            <span>0° (正面)</span>
            <span>+180° (東)</span>
          </div>
        </div>

        {/* 毎回切り分ける経線をランダムにするトグルオプション */}
        <div className="flex items-center justify-between p-2 rounded-md bg-rose-50/50 border border-rose-200/60">
          <div className="space-y-0.5">
            <span className="text-[11px] text-gray-800 font-medium flex items-center gap-1">
              <ShuffleIcon className="w-3 h-3 text-rose-500" />
              毎回切り分け経線をランダム化
            </span>
            <p className="text-[9.5px] text-gray-500 leading-tight">
              展開サイクル（モーフィング0.00）ごとに新しい経線を自動選定
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none ml-2 shrink-0">
            <input
              type="checkbox"
              checked={params.randomizeSeamOnLoop}
              onChange={(e) =>
                onParamChange("randomizeSeamOnLoop", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-rose-500 peer-checked:border-rose-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-transform peer-checked:after:translate-x-3.5 shadow-2xs" />
          </label>
        </div>
      </div>

      {/* 自動モーフィング & 回転速度 */}
      <div className="pt-2 border-t border-gray-200/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs flex items-center gap-1.5">
            <PlayIcon className="w-3.5 h-3.5 text-emerald-600" />
            自動モーフィングアニメーション
          </span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
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
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200/80 border border-gray-300/80 rounded-full peer peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4 shadow-2xs" />
          </label>
        </div>

        {/* 自動モーフィングON時のみ表示されるモーフィング速度スライダ */}
        {params.isAutoMorph && (
          <div className="space-y-1 pl-2 border-l-2 border-emerald-500/50 bg-emerald-50/40 p-1.5 rounded-r">
            <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
              <span className="flex items-center gap-1">
                <ActivityIcon className="w-3.5 h-3.5 text-emerald-600" />
                モーフィング速度
              </span>
              <span className="font-mono text-gray-900 font-semibold">
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
              className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
            />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
            <span className="flex items-center gap-1">
              <RotateCwIcon className="w-3.5 h-3.5 text-amber-600" />
              自転速度 (Rotation)
            </span>
            <span className="font-mono text-gray-900 font-semibold">
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
            className="w-full accent-emerald-600 bg-gray-200/80 rounded h-1.5 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
