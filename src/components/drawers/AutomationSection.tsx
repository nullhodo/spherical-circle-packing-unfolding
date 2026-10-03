import { useAtom } from "jotai";
import { Dices, PlayCircle, Repeat } from "lucide-react";
import type React from "react";
import {
  cycleIntervalMsAtom,
  isAutoCycleActiveAtom,
  randomTargetsAtom,
  targetLoopsCountAtom,
} from "../../state/sketchStore";

interface Props {
  onRandomizeAll: () => void;
  onStartNLoopRecord: () => void;
}

export const AutomationSection: React.FC<Props> = ({
  onRandomizeAll,
  onStartNLoopRecord,
}) => {
  const [randomTargets, setRandomTargets] = useAtom(randomTargetsAtom);
  const [isAutoCycle, setIsAutoCycle] = useAtom(isAutoCycleActiveAtom);
  const [intervalMs, setIntervalMs] = useAtom(cycleIntervalMsAtom);
  const [targetLoops, setTargetLoops] = useAtom(targetLoopsCountAtom);

  return (
    <div className="space-y-4 text-xs">
      {/* 一括ランダムボタン */}
      <button
        type="button"
        onClick={onRandomizeAll}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all shadow-md shadow-violet-900/30"
      >
        <Dices className="w-3.5 h-3.5" />
        <span>選択要素をランダム化</span>
      </button>

      {/* ランダム対象チェックボックス群 */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 block mb-1">
          ランダム対象
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={randomTargets.palette}
            onChange={(e) =>
              setRandomTargets((prev) => ({
                ...prev,
                palette: e.target.checked,
              }))
            }
            className="rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span>配色パレット (Palette)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={randomTargets.projection}
            onChange={(e) =>
              setRandomTargets((prev) => ({
                ...prev,
                projection: e.target.checked,
              }))
            }
            className="rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span>地図投影法 (Projection)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={randomTargets.counts}
            onChange={(e) =>
              setRandomTargets((prev) => ({
                ...prev,
                counts: e.target.checked,
              }))
            }
            className="rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span>円数 & 半径範囲 (Counts & Radii)</span>
        </label>
      </div>

      {/* 定期オートサイクル */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={isAutoCycle}
            onChange={(e) => setIsAutoCycle(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <Repeat className="w-3.5 h-3.5 text-sky-400" />
          <span>定期オートサイクル進行</span>
        </label>

        {isAutoCycle && (
          <div>
            <div className="flex items-center justify-between text-slate-300 mb-1.5 font-medium">
              <span>サイクル間隔</span>
              <span className="font-mono text-slate-400">
                {intervalMs} ms
              </span>
            </div>
            <input
              type="range"
              min="1500"
              max="10000"
              step="500"
              value={intervalMs}
              onChange={(e) =>
                setIntervalMs(Number.parseInt(e.target.value, 10))
              }
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
        )}

        {/* Nループ自動録画 */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 block">
            Nループ自動動画録画
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">ループ回数:</span>
            <input
              type="number"
              min="1"
              max="10"
              value={targetLoops}
              onChange={(e) =>
                setTargetLoops(
                  Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                )
              }
              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-center font-mono text-xs"
            />
            <button
              type="button"
              onClick={onStartNLoopRecord}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-rose-100 font-medium transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Nループ録画開始</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            指定回数サイクル遷移後、自動でMP4保存と設定JSON書き出しを実行します
          </p>
        </div>
      </div>
    </div>
  );
};
