import { useAtom } from "jotai";
import {
  FileCodeIcon,
  FileDownIcon,
  SquareIcon,
  VideoIcon,
} from "lucide-react";
import type React from "react";
import {
  recordingStateAtom,
  targetLoopsCountAtom,
} from "../../state/sketchStore";

interface Props {
  onExportHighRes: () => void;
  onExportSvg: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onStartNLoopRecord: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

export const ExportSection: React.FC<Props> = ({
  onExportHighRes,
  onExportSvg,
  onStartRecord,
  onStopRecord,
  onStartNLoopRecord,
  onExportJson,
  onImportJson,
}) => {
  const [recordingState] = useAtom(recordingStateAtom);
  const [targetLoops, setTargetLoops] = useAtom(targetLoopsCountAtom);

  return (
    <div className="space-y-3 bg-white/50 backdrop-blur-md p-3.5 rounded-md border border-white/50 shadow-xs">
      <div className="font-bold text-gray-900 flex items-center gap-2 text-xs">
        <FileCodeIcon className="w-4 h-4 text-gray-700" />
        出力 &amp; 保存
      </div>

      {/* 画像出力 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onExportHighRes}
          title="縦横2880pxの高解像度PNG画像とJSON設定を出力します"
          className="bg-gray-900/90 hover:bg-gray-900 text-white py-2 rounded font-medium transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-xs active:scale-[0.99]"
        >
          高解像度PNG
        </button>
        <button
          type="button"
          onClick={onExportSvg}
          title="p5.js-svg を使用してベクターSVG画像を出力します"
          className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-2 rounded font-medium transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-xs"
        >
          SVG
        </button>
      </div>

      {/* 手動 MP4 録画 */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60">
        <button
          type="button"
          disabled={recordingState.isRecording}
          onClick={onStartRecord}
          title="mp4-muxer / WebCodecs で動画録画を開始します (Rキー)"
          className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-2 rounded font-medium transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
        >
          <VideoIcon className="w-4 h-4" />
          <span>手動録画 (R)</span>
        </button>
        <button
          type="button"
          disabled={!recordingState.isRecording}
          onClick={onStopRecord}
          title="録画を停止して動画とJSONを出力します (Sキー)"
          className="bg-white/70 hover:bg-white/95 disabled:opacity-40 text-gray-800 border border-gray-300/80 py-2 rounded font-medium transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          <SquareIcon className="w-4 h-4" />
          <span>録画停止 (S)</span>
        </button>
      </div>

      {/* Nループ指定 MP4 録画 */}
      <div className="space-y-2 pt-2 border-t border-gray-200/60">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-700 font-semibold">
            Nループ指定 MP4録画
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600 font-medium text-[11px]">
              ループ数:
            </span>
            <select
              value={targetLoops}
              onChange={(e) =>
                setTargetLoops(Number.parseInt(e.target.value, 10))
              }
              className="bg-white/70 border border-gray-300/80 text-gray-900 rounded px-1.5 py-0.5 text-xs focus:outline-none cursor-pointer"
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 回
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={recordingState.isRecording}
          onClick={onStartNLoopRecord}
          className="w-full bg-emerald-600/90 hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-40 text-white py-2 rounded font-medium transition flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:cursor-not-allowed shadow-xs"
        >
          <VideoIcon className="w-4 h-4" />
          <span>{targetLoops} ループ録画開始</span>
        </button>
      </div>

      {/* JSON設定 保存 / 復元 */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60">
        <button
          type="button"
          onClick={onExportJson}
          className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-1.5 rounded font-medium transition flex items-center justify-center gap-1 text-xs cursor-pointer shadow-xs"
        >
          <FileDownIcon className="w-3.5 h-3.5" />
          <span>JSON保存</span>
        </button>
        <label className="bg-white/70 hover:bg-white/95 text-gray-800 border border-gray-300/80 py-1.5 rounded font-medium transition flex items-center justify-center gap-1 text-xs cursor-pointer shadow-xs text-center">
          <FileCodeIcon className="w-3.5 h-3.5" />
          <span>JSON読込</span>
          <input
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
        </label>
      </div>
    </div>
  );
};
