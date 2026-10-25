import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import {
  DicesIcon,
  Redo2Icon,
  SettingsIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import {
  historyRedoAtom,
  historyUndoAtom,
  isPanelOpenAtom,
  isRandomTargetsModalOpenAtom,
} from "../state/sketchStore";
import { RandomTargetsDrawer } from "./drawers/RandomTargetsDrawer";
import { ColorPaletteSection } from "./sections/ColorPaletteSection";
import { ExportSection } from "./sections/ExportSection";
import { OperationsSection } from "./sections/OperationsSection";
import { PackingSection } from "./sections/PackingSection";
import { ProjectionSection } from "./sections/ProjectionSection";
import { RenderingStyleSection } from "./sections/RenderingStyleSection";

interface Props {
  onParamChange: <K extends keyof import("../types/sketch").SketchParams>(
    key: K,
    value: import("../types/sketch").SketchParams[K],
    skipHistory?: boolean,
  ) => void;
  onRecomputePacking: () => void;
  onApplyPalette: (index: number) => void;
  onPickRandomPalette: () => void;
  onShufflePaletteColors: () => void;
  onGenerateGradientTheme: (baseHex: string) => void;
  onRandomizeBackgroundColor: () => void;
  onSetBackgroundColor: (index: number, targetHex?: string) => void;
  onRandomizeAll: () => void;
  onStartNLoopRecord: () => void;
  onExportHighRes: () => void;
  onExportSvg: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const ControlPanel: React.FC<Props> = ({
  onParamChange,
  onRecomputePacking,
  onApplyPalette,
  onPickRandomPalette,
  onShufflePaletteColors,
  onGenerateGradientTheme,
  onRandomizeBackgroundColor,
  onSetBackgroundColor,
  onRandomizeAll,
  onStartNLoopRecord,
  onExportHighRes,
  onExportSvg,
  onStartRecord,
  onStopRecord,
  onExportJson,
  onImportJson,
  onUndo,
  onRedo,
}) => {
  const [isOpen, setIsOpen] = useAtom(isPanelOpenAtom);
  const [isDrawerOpen, setIsDrawerOpen] = useAtom(
    isRandomTargetsModalOpenAtom,
  );
  const [undoStack] = useAtom(historyUndoAtom);
  const [redoStack] = useAtom(historyRedoAtom);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const panelContainerRef = useRef<HTMLDivElement>(null);

  // パネル外部クリックで閉じる処理 (メインパネルおよびドロワー)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (!isOpen) return;

      const path = e.composedPath?.() || [];
      if (
        panelContainerRef.current &&
        (path.includes(panelContainerRef.current) ||
          panelContainerRef.current.contains(e.target as Node))
      ) {
        return;
      }

      setIsOpen(false);
      setIsDrawerOpen(false);
    };

    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [isOpen, setIsOpen, setIsDrawerOpen]);

  return (
    <>
      {/* フローティング開閉トグルボタン (パネル非表示時のみ表示) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="ツール設定 (H)"
          aria-label="ツール設定を開く"
          className="absolute top-4 left-4 z-50 bg-white/70 hover:bg-white/90 text-gray-800 hover:text-gray-950 p-2.5 rounded-md shadow-lg backdrop-blur-md border border-white/50 transition-all flex items-center justify-center cursor-pointer active:scale-95"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      )}

      {/* サイドバーレイアウト: メインパネル + 右側展開サブドロワー */}
      <AnimatePresence>
        {isOpen && (
          <div
            ref={panelContainerRef}
            className="absolute top-4 left-4 bottom-4 flex items-start gap-3 z-40 pointer-events-none"
          >
            {/* メインパネル */}
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-96 h-full bg-white/65 backdrop-blur-xl text-gray-900 rounded-md shadow-2xl border border-white/50 flex flex-col overflow-hidden pointer-events-auto"
            >
              {/* ヘッダー */}
              <div className="p-3.5 border-b border-gray-200/50 flex items-center justify-between bg-white/40 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-gray-800" />
                  <span className="text-xs font-bold tracking-wide text-gray-900">
                    ツール設定
                  </span>
                  {import.meta.env.DEV && (
                    <span className="bg-amber-100/90 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px] leading-none select-none">
                      DEV
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsDrawerOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-gray-200/50 transition cursor-pointer"
                  title="パネルを閉じる"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {/* 固定上部クイックアクションバー */}
              <div className="p-3 bg-white/40 backdrop-blur-md border-b border-gray-200/50 space-y-2 flex-shrink-0 shadow-xs">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onRandomizeAll}
                    title="選択された対象パラメータをランダム設定します (スペースキー)"
                    className="flex-1 bg-gray-900/90 hover:bg-gray-900 active:scale-[0.99] text-white py-2 px-3 rounded font-bold transition flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm backdrop-blur-xs"
                  >
                    <DicesIcon className="w-4 h-4" />
                    <span>ランダム実行 (Space)</span>
                  </button>

                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={onUndo}
                      title="元に戻す (Ctrl+Z)"
                      className="bg-white/70 hover:bg-white/95 disabled:opacity-40 text-gray-800 border border-gray-300/80 px-2 py-1.5 rounded transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed text-xs font-medium shadow-xs"
                    >
                      <Undo2Icon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canRedo}
                      onClick={onRedo}
                      title="やり直す (Ctrl+Y)"
                      className="bg-white/70 hover:bg-white/95 disabled:opacity-40 text-gray-800 border border-gray-300/80 px-2 py-1.5 rounded transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed text-xs font-medium shadow-xs"
                    >
                      <Redo2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen((prev) => !prev)}
                  title="ランダム化対象の選択ドロワーを右側に開閉します"
                  className={`w-full py-1.5 rounded border transition flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                    isDrawerOpen
                      ? "bg-gray-200/80 border-gray-400 text-gray-900 font-semibold shadow-inner ring-1 ring-gray-400/40"
                      : "bg-white/70 hover:bg-white/95 text-gray-700 border-gray-300/80 shadow-xs font-medium"
                  }`}
                >
                  <SlidersHorizontalIcon className="w-3.5 h-3.5" />
                  <span>
                    ランダム対象パラメータの選択 {isDrawerOpen ? "◀" : "▶"}
                  </span>
                </button>
              </div>

              {/* スクロール可能セクション群 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
                <OperationsSection onUndo={onUndo} onRedo={onRedo} />
                <ProjectionSection onParamChange={onParamChange} />
                <PackingSection
                  onParamChange={onParamChange}
                  onRecomputePacking={onRecomputePacking}
                />
                <ColorPaletteSection
                  onApplyPalette={onApplyPalette}
                  onPickRandomPalette={onPickRandomPalette}
                  onShufflePaletteColors={onShufflePaletteColors}
                  onGenerateGradientTheme={onGenerateGradientTheme}
                  onRandomizeBackgroundColor={onRandomizeBackgroundColor}
                  onSetBackgroundColor={onSetBackgroundColor}
                />
                <RenderingStyleSection onParamChange={onParamChange} />
                <ExportSection
                  onExportHighRes={onExportHighRes}
                  onExportSvg={onExportSvg}
                  onStartRecord={onStartRecord}
                  onStopRecord={onStopRecord}
                  onStartNLoopRecord={onStartNLoopRecord}
                  onExportJson={onExportJson}
                  onImportJson={onImportJson}
                />
              </div>
            </motion.div>

            {/* 右側展開サブドロワー */}
            <RandomTargetsDrawer />
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
