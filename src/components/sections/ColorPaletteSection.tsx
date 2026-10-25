import { useAtom } from "jotai";
import {
  CheckIcon,
  ChevronDownIcon,
  DicesIcon,
  PaletteIcon,
  RefreshCwIcon,
  ShuffleIcon,
  SparklesIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { colourPalettes } from "../../constants/palettes";
import {
  activePaletteAtom,
  sketchParamsAtom,
} from "../../state/sketchStore";

interface Props {
  onApplyPalette: (index: number) => void;
  onPickRandomPalette: () => void;
  onShufflePaletteColors: () => void;
  onGenerateGradientTheme: (baseHex: string) => void;
  onRandomizeBackgroundColor: () => void;
  onSetBackgroundColor: (colorIndex: number, targetHex?: string) => void;
}

export const ColorPaletteSection: React.FC<Props> = ({
  onApplyPalette,
  onPickRandomPalette,
  onShufflePaletteColors,
  onGenerateGradientTheme,
  onRandomizeBackgroundColor,
  onSetBackgroundColor,
}) => {
  const [params] = useAtom(sketchParamsAtom);
  const [activePalette] = useAtom(activePaletteAtom);
  const [baseColor, setBaseColor] = useState("#38bdf8");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPalette =
    activePalette ||
    colourPalettes[params.activePaletteIndex] ||
    colourPalettes[0];

  const getPaletteGradient = (
    palette: (typeof colourPalettes)[number],
    angle = 90,
  ) => {
    if (!palette?.colors?.length) return "transparent";
    const hexes = palette.colors.map((c) => c.hex);
    if (hexes.length === 1) return hexes[0];
    return `linear-gradient(${angle}deg, ${hexes.join(", ")})`;
  };

  const getPaletteSoftGradient = (
    palette: (typeof colourPalettes)[number],
    opacity = 0.25,
    angle = 90,
  ) => {
    if (!palette?.colors?.length) return "transparent";
    const stops = palette.colors.map((c) => {
      const [r, g, b] = c.rgb;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    });
    if (stops.length === 1) return stops[0];
    return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
  };

  // ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    const handleDropdownOutside = (e: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("pointerdown", handleDropdownOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handleDropdownOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="space-y-3 bg-white/50 backdrop-blur-md p-3.5 rounded-md border border-white/50 shadow-xs relative overflow-hidden">
      {/* 上部アクセントグラデーションバー */}
      <div
        className="h-[3px] absolute top-0 left-0 right-0 transition-all duration-300"
        style={{ background: getPaletteGradient(currentPalette, 90) }}
      />

      <div className="font-bold text-gray-900 flex items-center gap-2 text-xs pt-0.5">
        <PaletteIcon className="w-4 h-4 text-gray-700" />
        カラーパレット &amp; テーマ
      </div>

      {/* パレットセレクタードロップダウン */}
      <div className="space-y-1 relative" ref={dropdownRef}>
        <span className="text-gray-600 font-medium block mb-1 text-[11px]">
          プリセットパレット
        </span>

        {/* ドロップダウントリガーボタン */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          style={{
            background: getPaletteSoftGradient(currentPalette, 0.35, 90),
          }}
          className="w-full border border-gray-300/80 hover:border-gray-400 text-gray-900 rounded p-2 text-xs focus:ring-1 focus:ring-gray-800 focus:outline-none cursor-pointer flex items-center justify-between gap-2 shadow-xs transition"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <div
              className="flex gap-0.5 flex-shrink-0 p-0.5 bg-white/80 backdrop-blur-xs rounded border border-gray-200 shadow-2xs max-w-[108px] overflow-hidden"
              style={
                currentPalette.colors.length > 5
                  ? {
                      maskImage:
                        "linear-gradient(to right, black calc(100% - 20px), transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black calc(100% - 20px), transparent 100%)",
                    }
                  : undefined
              }
            >
              {currentPalette.colors.map((c) => (
                <div
                  key={c.hex}
                  className="w-3.5 h-3.5 rounded-[2px] flex-shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <span className="font-semibold truncate text-gray-900 text-[11px] min-w-0 flex-1">
              {currentPalette.title}
            </span>
          </div>
          <ChevronDownIcon
            className={`w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform duration-200 ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* ドロップダウンメニュー */}
        {isDropdownOpen && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-md shadow-2xl max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1.5">
            {colourPalettes.map((pal, idx) => {
              const isSelected = idx === params.activePaletteIndex;
              return (
                <button
                  type="button"
                  key={pal.title}
                  onClick={() => {
                    onApplyPalette(idx);
                    setIsDropdownOpen(false);
                  }}
                  style={{
                    background: isSelected
                      ? getPaletteSoftGradient(pal, 0.45, 90)
                      : getPaletteSoftGradient(pal, 0.18, 90),
                  }}
                  className={`w-full text-left p-2.5 rounded-md flex flex-col gap-1.5 transition-all cursor-pointer text-xs border relative overflow-hidden ${
                    isSelected
                      ? "border-gray-900/60 shadow-sm ring-1 ring-gray-900/30"
                      : "border-gray-200/60 hover:border-gray-400 hover:brightness-95"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 relative z-10">
                    <span className="font-bold text-[11px] text-gray-900 truncate min-w-0 flex-1">
                      {pal.title}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-900 border border-gray-200/80 shadow-2xs flex-shrink-0">
                        <CheckIcon className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        選択中
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <div
                      className="flex gap-1 flex-shrink-0 p-0.5 bg-white/80 backdrop-blur-xs rounded border border-gray-200/80 shadow-2xs max-w-[130px] overflow-hidden"
                      style={
                        pal.colors.length > 5
                          ? {
                              maskImage:
                                "linear-gradient(to right, black calc(100% - 18px), transparent 100%)",
                              WebkitMaskImage:
                                "linear-gradient(to right, black calc(100% - 18px), transparent 100%)",
                            }
                          : undefined
                      }
                    >
                      {pal.colors.map((c) => (
                        <div
                          key={c.hex}
                          className="w-3.5 h-3.5 rounded-[2px] flex-shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                    {pal.comment && (
                      <span className="text-[10px] text-gray-600 truncate text-right">
                        {pal.comment}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* パレット操作ボタン群 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPickRandomPalette}
          className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-1.5 px-2 rounded font-medium transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-xs"
        >
          <ShuffleIcon className="w-3.5 h-3.5" />
          <span>ランダム変更</span>
        </button>
        <button
          type="button"
          onClick={onShufflePaletteColors}
          className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-1.5 px-2 rounded font-medium transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-xs"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          <span>配色シャッフル</span>
        </button>
      </div>

      {/* 1色からのグラデーション生成 */}
      <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
        <span className="text-gray-600 font-medium block text-[11px]">
          1色から調和グラデーション生成
        </span>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-white/70 border border-gray-300/80 rounded px-2 py-1 flex-1 shadow-2xs">
            <input
              type="color"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <input
              type="text"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              className="font-mono text-[11px] text-gray-800 bg-transparent focus:outline-none w-20"
            />
          </div>
          <button
            type="button"
            onClick={() => onGenerateGradientTheme(baseColor)}
            className="bg-gray-900/90 hover:bg-gray-900 text-white px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 cursor-pointer text-xs shadow-xs"
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>生成</span>
          </button>
        </div>
      </div>

      {/* 背景色設定 */}
      <div className="pt-2 border-t border-gray-200/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 font-semibold text-xs">
            背景色の独立設定
          </span>
          <button
            type="button"
            onClick={onRandomizeBackgroundColor}
            className="flex items-center gap-1 bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 px-2 py-1 rounded text-[10px] font-medium transition cursor-pointer shadow-2xs"
          >
            <DicesIcon className="w-3 h-3" />
            <span>パレットから再設定</span>
          </button>
        </div>

        {/* スウォッチ選択 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>現在のパレット色から背景に設定:</span>
            {params.isExclusiveBackground && (
              <span className="font-mono text-emerald-600 font-medium truncate max-w-[120px]">
                {currentPalette.colors[0]?.name ||
                  currentPalette.colors[0]?.hex}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentPalette.colors.map((c, idx) => {
              const isCurrentBg =
                idx === 0 && params.isExclusiveBackground;
              const isLight =
                0.299 * c.rgb[0] + 0.587 * c.rgb[1] + 0.114 * c.rgb[2] >
                140;
              return (
                <button
                  key={`${c.hex}-${idx}`}
                  type="button"
                  onClick={() => onSetBackgroundColor(idx, c.hex)}
                  title={`${c.name || c.hex} を背景色に設定`}
                  className={`w-7 h-7 rounded-md border transition-all shadow-2xs cursor-pointer flex items-center justify-center relative ${
                    isCurrentBg
                      ? "border-gray-900 ring-2 ring-gray-900/50 scale-105 z-10"
                      : "border-gray-300/80 hover:scale-110 active:scale-95"
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {isCurrentBg && (
                    <CheckIcon
                      className={`w-3.5 h-3.5 ${
                        isLight ? "text-gray-900" : "text-white"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
