import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Undo2,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  historyRedoAtom,
  historyUndoAtom,
  isPanelOpenAtom,
  sketchParamsAtom,
} from "../state/sketchStore";
import { AutomationSection } from "./drawers/AutomationSection";
import { ExportSection } from "./drawers/ExportSection";
import { MaterialSection } from "./drawers/MaterialSection";
import { PackingSection } from "./drawers/PackingSection";
import { ProjectionSection } from "./drawers/ProjectionSection";

interface Props {
  onParamChange: <K extends keyof import("../types/sketch").SketchParams>(
    key: K,
    value: import("../types/sketch").SketchParams[K],
    skipHistory?: boolean,
  ) => void;
  onRecomputePacking: () => void;
  onApplyPalette: (index: number) => void;
  onPickRandomPalette: () => void;
  onGenerateGradientTheme: (baseHex: string) => void;
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

export const ControlPanel: React.FC<Props> = (props) => {
  const [isOpen, setIsOpen] = useAtom(isPanelOpenAtom);
  const [params] = useAtom(sketchParamsAtom);
  const [undoStack] = useAtom(historyUndoAtom);
  const [redoStack] = useAtom(historyRedoAtom);

  const [openSections, setOpenSections] = useState<
    Record<string, boolean>
  >({
    projection: true,
    packing: true,
    material: true,
    automation: false,
    export: false,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <>
      {/* UI開閉トグルボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-5 left-5 z-40 p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 shadow-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 group cursor-pointer"
        title="UIパネル開閉 (Shortcut: H)"
      >
        {isOpen ? (
          <PanelLeftClose className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
        ) : (
          <PanelLeftOpen className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
        )}
        <span className="text-xs font-medium tracking-wide pr-1">
          UI Panel
        </span>
      </button>

      {/* 左サイドバー */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 left-0 bottom-0 w-96 max-w-[90vw] z-30 bg-slate-950/90 border-r border-slate-800/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden select-none"
          >
            {/* UI ヘッダー */}
            <div className="p-4 pt-16 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                  spherical-circle-packing-unfolding
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Spherical Packing to Map Projections
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={props.onUndo}
                  disabled={undoStack.length === 0}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="元に戻す (Undo, Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={props.onRedo}
                  disabled={redoStack.length === 0}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="やり直す (Redo, Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    props.onParamChange("isDebugMode", !params.isDebugMode)
                  }
                  className={`p-1.5 rounded-lg border transition-colors ${
                    params.isDebugMode
                      ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                  }`}
                  title="HUDデバッグ表示 (Shortcut: D)"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* スクロールエリア */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* セクション 1: 投影・モーフィング */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("projection")}
                  className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <span>1. 投影・モーフィング展開</span>
                  {openSections.projection ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {openSections.projection && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 mt-2">
                    <ProjectionSection
                      onParamChange={props.onParamChange}
                    />
                  </div>
                )}
              </div>

              {/* セクション 2: サークルパッキング */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("packing")}
                  className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <span>2. サークルパッキング幾何構造</span>
                  {openSections.packing ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {openSections.packing && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 mt-2">
                    <PackingSection
                      onParamChange={props.onParamChange}
                      onRecomputePacking={props.onRecomputePacking}
                    />
                  </div>
                )}
              </div>

              {/* セクション 3: 配色 & 質感 */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("material")}
                  className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <span>3. カラーパレット & 質感マテリアル</span>
                  {openSections.material ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {openSections.material && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 mt-2">
                    <MaterialSection
                      onParamChange={props.onParamChange}
                      onApplyPalette={props.onApplyPalette}
                      onPickRandomPalette={props.onPickRandomPalette}
                      onGenerateGradientTheme={
                        props.onGenerateGradientTheme
                      }
                    />
                  </div>
                )}
              </div>

              {/* セクション 4: オートメーション */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("automation")}
                  className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <span>4. オートメーション & ランダマイズ</span>
                  {openSections.automation ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {openSections.automation && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 mt-2">
                    <AutomationSection
                      onRandomizeAll={props.onRandomizeAll}
                      onStartNLoopRecord={props.onStartNLoopRecord}
                    />
                  </div>
                )}
              </div>

              {/* セクション 5: エクスポート & 録画 */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("export")}
                  className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-200 hover:bg-slate-800/40 transition-colors"
                >
                  <span>5. エクスポート & 録画 (MP4/SVG)</span>
                  {openSections.export ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {openSections.export && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 mt-2">
                    <ExportSection
                      onExportHighRes={props.onExportHighRes}
                      onExportSvg={props.onExportSvg}
                      onStartRecord={props.onStartRecord}
                      onStopRecord={props.onStopRecord}
                      onExportJson={props.onExportJson}
                      onImportJson={props.onImportJson}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
