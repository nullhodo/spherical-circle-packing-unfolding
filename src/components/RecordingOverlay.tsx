import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { SquareIcon } from "lucide-react";
import type React from "react";
import { recordingStateAtom } from "../state/sketchStore";

interface Props {
  onStopRecord?: () => void;
}

export const RecordingOverlay: React.FC<Props> = ({ onStopRecord }) => {
  const [recordingState] = useAtom(recordingStateAtom);

  if (!recordingState.isRecording) return null;

  const isLoop = recordingState.isLoopMode;
  const currentLoop = recordingState.currentLoop || 1;
  const totalLoops = recordingState.totalLoops || 1;
  const loopIntervalMs = recordingState.loopIntervalMs || 4000;
  const totalEstimatedSec = Math.round(
    (totalLoops * loopIntervalMs) / 1000,
  );

  const formatTimer = (secs: number) => {
    const mins = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${mins}:${s}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentLoop / totalLoops) * 100)),
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-4 right-4 z-50 pointer-events-auto bg-gray-950/80 text-white rounded-lg p-3 shadow-2xl border border-red-500/40 backdrop-blur-xl min-w-[240px] max-w-sm select-none"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="text-xs font-bold tracking-wider text-red-400">
              {isLoop ? "Nループ自動録画中" : "動画録画中 (REC)"}
            </span>
          </div>

          {onStopRecord && (
            <button
              type="button"
              onClick={onStopRecord}
              title="録画を停止して保存します (Sキー)"
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
            >
              <SquareIcon className="w-3 h-3 fill-white" />
              <span>停止</span>
            </button>
          )}
        </div>

        {/* Nループ詳細進捗 */}
        {isLoop ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-gray-300 font-medium text-[11px]">
              <span>進捗:</span>
              <span className="font-bold text-white">
                ループ {currentLoop} / {totalLoops} ({progressPercent}%)
              </span>
            </div>

            {/* プログレスバー */}
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700">
              <div
                className="bg-gradient-to-r from-red-500 to-rose-400 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-400 pt-0.5">
              <span>
                経過: {formatTimer(recordingState.elapsedSeconds)}
              </span>
              <span>予定: ~{formatTimer(totalEstimatedSec)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span className="text-[11px]">経過時間:</span>
            <span className="font-mono font-bold text-white text-sm">
              {formatTimer(recordingState.elapsedSeconds)}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
