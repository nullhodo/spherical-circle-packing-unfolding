import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import type React from "react";
import { recordingStateAtom } from "../state/sketchStore";

export const RecordingOverlay: React.FC = () => {
  const [recordingState] = useAtom(recordingStateAtom);

  if (!recordingState.isRecording) return null;

  const minutes = Math.floor(recordingState.elapsedSeconds / 60);
  const seconds = recordingState.elapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-5 right-5 z-40 bg-rose-950/80 border border-rose-500/50 backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg shadow-rose-950/50 select-none"
      >
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
            Recording In Progress
          </span>
          <span className="font-mono text-sm font-bold text-rose-100">
            {timeFormatted}
          </span>
        </div>
        {recordingState.currentLoop && recordingState.totalLoops && (
          <span className="text-xs text-rose-300 border-l border-rose-500/30 pl-3">
            Loop: {recordingState.currentLoop}/{recordingState.totalLoops}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
