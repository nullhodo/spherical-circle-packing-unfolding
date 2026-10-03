import { useAtom } from "jotai";
import {
  Dices,
  Palette as PaletteIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { colourPalettes } from "../../constants/palettes";
import {
  activePaletteAtom,
  sketchParamsAtom,
} from "../../state/sketchStore";

interface Props {
  onParamChange: <
    K extends keyof import("../../types/sketch").SketchParams,
  >(
    key: K,
    value: import("../../types/sketch").SketchParams[K],
  ) => void;
  onApplyPalette: (index: number) => void;
  onPickRandomPalette: () => void;
  onGenerateGradientTheme: (baseHex: string) => void;
}

export const MaterialSection: React.FC<Props> = ({
  onParamChange,
  onApplyPalette,
  onPickRandomPalette,
  onGenerateGradientTheme,
}) => {
  const [params] = useAtom(sketchParamsAtom);
  const [activePalette] = useAtom(activePaletteAtom);
  const [customColor, setCustomColor] = useState("#38bdf8");

  return (
    <div className="space-y-4 text-xs">
      {/* パレット選択 & ランダムボタン */}
      <div>
        <div className="flex items-center justify-between mb-1.5 font-medium text-slate-300">
          <span className="flex items-center gap-1.5">
            <PaletteIcon className="w-3.5 h-3.5 text-pink-400" />
            配色パレット
          </span>
          <button
            type="button"
            onClick={onPickRandomPalette}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
          >
            <Dices className="w-3 h-3 text-pink-400" />
            <span>ランダム</span>
          </button>
        </div>

        <select
          value={params.activePaletteIndex}
          onChange={(e) =>
            onApplyPalette(Number.parseInt(e.target.value, 10))
          }
          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-pink-400"
        >
          {colourPalettes.map((pal, idx) => (
            <option key={pal.title} value={idx}>
              {pal.title} ({pal.colors.length}色)
            </option>
          ))}
        </select>
        {activePalette.comment && (
          <p className="text-[10px] text-slate-400 mt-1 italic">
            {activePalette.comment}
          </p>
        )}
      </div>

      {/* カラープレビュースウォッチ */}
      <div>
        <div className="flex items-center gap-1.5 h-7 p-1 rounded-lg bg-slate-900/60 border border-slate-800">
          {activePalette.colors.map((c, i) => (
            <div
              key={`${c.hex}-${i}`}
              className="flex-1 h-full rounded shadow-inner cursor-pointer hover:scale-105 transition-transform"
              style={{ backgroundColor: c.hex }}
              title={`${c.name || "Color"} (${c.hex})`}
            />
          ))}
        </div>
      </div>

      {/* 背景色排他トグル */}
      <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
        <input
          type="checkbox"
          checked={params.isExclusiveBackground}
          onChange={(e) =>
            onParamChange("isExclusiveBackground", e.target.checked)
          }
          className="rounded bg-slate-800 border-slate-700 text-pink-500 focus:ring-0 w-3.5 h-3.5"
        />
        <span>背景にパレット第1色を適用 (排他使用)</span>
      </label>

      {/* カスタムグラデーション生成器 */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>ベース色から自動生成</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
          />
          <button
            type="button"
            onClick={() => onGenerateGradientTheme(customColor)}
            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            グラデ生成
          </button>
        </div>
      </div>

      {/* フィルムグレイン質感 */}
      <div className="pt-2 border-t border-slate-800/80">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={params.showFilmGrain}
            onChange={(e) =>
              onParamChange("showFilmGrain", e.target.checked)
            }
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>フィルムグレイン質感 (Film Grain Noise)</span>
        </label>
      </div>
    </div>
  );
};
