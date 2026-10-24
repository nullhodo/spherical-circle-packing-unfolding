import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import {
  CircleDotIcon,
  GlobeIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import {
  isRandomTargetsModalOpenAtom,
  randomTargetsAtom,
} from "../../state/sketchStore";
import type { RandomTargets } from "../../types/sketch";

interface TargetGroup {
  title: string;
  icon: React.ReactNode;
  items: {
    key: keyof RandomTargets;
    label: string;
    desc: string;
  }[];
}

export const RandomTargetsDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(isRandomTargetsModalOpenAtom);
  const [randomTargets, setRandomTargets] = useAtom(randomTargetsAtom);

  const toggleTarget = (key: keyof RandomTargets) => {
    setRandomTargets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAll = (enable: boolean) => {
    setRandomTargets({
      palette: enable,
      paletteShuffle: enable,
      projectionMethod: enable,
      morphTransitionMode: enable,
      projectionScale: enable,
      rotationSpeed: enable,
      morphSpeed: enable,
      maxCircles: enable,
      minRadius: enable,
      maxRadius: enable,
      showStroke: enable,
      strokeWeight: enable,
      circleSegments: enable,
      domeRings: enable,
      showGrid: enable,
      isExclusiveBackground: enable,
    });
  };

  const selectGroup = (keys: (keyof RandomTargets)[], enable: boolean) => {
    setRandomTargets((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = enable;
      }
      return next;
    });
  };

  const targetGroups: TargetGroup[] = [
    {
      title: "地図投影 & モーフィング",
      icon: <GlobeIcon className="w-3.5 h-3.5" />,
      items: [
        {
          key: "projectionMethod",
          label: "地図投影法",
          desc: "メルカトル、正距方位、モルワイデ等の図法変更",
        },
        {
          key: "morphTransitionMode",
          label: "展開アニメーション方式",
          desc: "円筒アンロール、両開き、ダイレクトの開き方",
        },
        {
          key: "projectionScale",
          label: "展開後スケール倍率",
          desc: "展開後の拡大率 (0.5〜2.5x)",
        },
        {
          key: "rotationSpeed",
          label: "自転速度",
          desc: "球体の経度自転スピード",
        },
        {
          key: "morphSpeed",
          label: "モーフィング速度",
          desc: "自動展開の往復スピード",
        },
        {
          key: "showGrid",
          label: "経緯線グリッド表示",
          desc: "緯線・経線の網目表示のON/OFF",
        },
      ],
    },
    {
      title: "サークルパッキング構造",
      icon: <CircleDotIcon className="w-3.5 h-3.5" />,
      items: [
        {
          key: "maxCircles",
          label: "最大目標円数",
          desc: "球面に配置する円の総数 (50〜1200)",
        },
        {
          key: "minRadius",
          label: "最小角半径",
          desc: "極小円の限界サイズ (0.001〜0.15rad)",
        },
        {
          key: "maxRadius",
          label: "最大角半径",
          desc: "基底大円の最大サイズ (0.1〜0.6rad)",
        },
        {
          key: "circleSegments",
          label: "円の分割精度",
          desc: "メッシュ頂点数 (16〜256)",
        },
        {
          key: "domeRings",
          label: "球面フィット精度",
          desc: "同心リング分割段数 (1〜16)",
        },
      ],
    },
    {
      title: "カラー & マテリアル",
      icon: <PaletteIcon className="w-3.5 h-3.5" />,
      items: [
        {
          key: "palette",
          label: "カラーパレット選定",
          desc: "プリセット配色からのランダム選定",
        },
        {
          key: "paletteShuffle",
          label: "パレット内配色シャッフル",
          desc: "選択パレット内の各円の色の割り当て変更",
        },
        {
          key: "isExclusiveBackground",
          label: "背景色の独立設定",
          desc: "パレットから背景色をランダム選定",
        },
        {
          key: "showStroke",
          label: "円の輪郭線描画",
          desc: "輪郭線 (ストローク) のON/OFF",
        },
        {
          key: "strokeWeight",
          label: "輪郭線の太さ",
          desc: "ストローク幅 (0.5〜5.0px)",
        },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -20, opacity: 0, scale: 0.96 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: -20, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="w-80 h-full bg-white/65 backdrop-blur-xl border border-white/50 rounded-md shadow-2xl flex flex-col text-gray-900 overflow-hidden pointer-events-auto"
        >
          {/* ヘッダー */}
          <div className="p-3.5 border-b border-gray-200/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
            <div className="flex items-center gap-2 font-bold text-xs text-gray-900">
              <SlidersHorizontalIcon className="w-4 h-4 text-gray-700" />
              ランダム対象の選択
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-gray-200/50 transition cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto custom-scrollbar text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
              <span className="text-gray-600 text-[11px] font-semibold">
                一括操作
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  className="px-2 py-0.5 bg-white/70 border border-gray-300/80 hover:bg-white/95 text-gray-800 rounded text-[11px] font-medium transition cursor-pointer shadow-xs"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={() => selectAll(false)}
                  className="px-2 py-0.5 bg-white/70 border border-gray-300/80 hover:bg-white/95 text-gray-800 rounded text-[11px] font-medium transition cursor-pointer shadow-xs"
                >
                  全解除
                </button>
              </div>
            </div>

            {targetGroups.map((group) => {
              const groupKeys = group.items.map((i) => i.key);

              return (
                <div
                  key={group.title}
                  className="space-y-2 bg-white/40 border border-gray-200/60 rounded-md p-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-gray-200/50">
                    <div className="flex items-center gap-1.5 font-bold text-gray-800 text-[11px]">
                      {group.icon}
                      {group.title}
                    </div>
                    <div className="flex gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => selectGroup(groupKeys, true)}
                        className="text-gray-500 hover:text-gray-900 transition underline cursor-pointer"
                      >
                        全選
                      </button>
                      <button
                        type="button"
                        onClick={() => selectGroup(groupKeys, false)}
                        className="text-gray-500 hover:text-gray-900 transition underline cursor-pointer"
                      >
                        解除
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const checked = randomTargets[item.key];
                      return (
                        <label
                          key={item.key}
                          className={`flex items-start gap-2 p-1.5 rounded transition cursor-pointer ${
                            checked
                              ? "bg-white/80 border border-gray-300/60 shadow-2xs"
                              : "hover:bg-white/40 border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTarget(item.key)}
                            className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-0 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={`block font-medium text-[11px] ${
                                checked ? "text-gray-900" : "text-gray-600"
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="block text-[10px] text-gray-500 leading-tight">
                              {item.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
