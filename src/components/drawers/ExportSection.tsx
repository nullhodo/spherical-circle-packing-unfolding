import { useAtom } from "jotai";
import {
  Download,
  FileCode,
  FileImage,
  Square,
  Video,
} from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { recordingStateAtom } from "../../state/sketchStore";

interface Props {
  onExportHighRes: () => void;
  onExportSvg: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

export const ExportSection: React.FC<Props> = ({
  onExportHighRes,
  onExportSvg,
  onStartRecord,
  onStopRecord,
  onExportJson,
  onImportJson,
}) => {
  const [recordingState] = useAtom(recordingStateAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 text-xs">
      {/* 高解像度レンダリング */}
      <button
        type="button"
        onClick={onExportHighRes}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm"
      >
        <FileImage className="w-3.5 h-3.5" />
        <span>高解像度 PNG 出力 (2880×2880px)</span>
      </button>

      {/* ベクターSVG出力 */}
      <button
        type="button"
        onClick={onExportSvg}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-teal-600/80 hover:bg-teal-500 text-white font-medium transition-colors shadow-sm"
      >
        <FileCode className="w-3.5 h-3.5" />
        <span>ベクター SVG 出力</span>
      </button>

      {/* 動画録画 (MP4 / WebCodecs) */}
      <div className="pt-2 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 block mb-2">
          動画キャプチャ (H.264 MP4 / WebM)
        </span>
        {!recordingState.isRecording ? (
          <button
            type="button"
            onClick={onStartRecord}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-medium transition-colors shadow-sm"
          >
            <Video className="w-3.5 h-3.5" />
            <span>MP4 録画開始 (Shortcut: R)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopRecord}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/50 font-medium transition-colors animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>録画停止・MP4保存 (Shortcut: S)</span>
          </button>
        )}
      </div>

      {/* JSON設定の保存と読み込み */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 block">
          プリセット JSON 設定
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>JSON 保存</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>JSON 読込</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportJson(file);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
      </div>
    </div>
  );
};
