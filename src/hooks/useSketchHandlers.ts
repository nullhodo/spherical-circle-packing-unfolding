import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { colourPalettes } from "../constants/palettes";
import { PROJECTION_OPTIONS } from "../constants/projections";
import { computeSphericalCirclePacking } from "../core/math/packing";
import {
  activePaletteAtom,
  circlesAtom,
  historyRedoAtom,
  historyUndoAtom,
  liveMorphProgress,
  randomTargetsAtom,
  sketchParamsAtom,
  toastsAtom,
} from "../state/sketchStore";
import type { Palette, SketchParams } from "../types/sketch";
import { generateGradientPaletteFromBaseColor } from "../utils/color";

export function useSketchHandlers() {
  const [params, setParams] = useAtom(sketchParamsAtom);
  const [activePalette, setActivePalette] = useAtom(activePaletteAtom);
  const [, setCircles] = useAtom(circlesAtom);
  const [randomTargets] = useAtom(randomTargetsAtom);
  const [undoStack, setUndoStack] = useAtom(historyUndoAtom);
  const [redoStack, setRedoStack] = useAtom(historyRedoAtom);
  const [, setToasts] = useAtom(toastsAtom);

  const paramsRef = useRef(params);
  const activePaletteRef = useRef(activePalette);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    activePaletteRef.current = activePalette;
  }, [activePalette]);

  const showToast = useCallback(
    (message: string, variant: "info" | "success" | "danger" = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    [setToasts],
  );

  const recordHistory = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-29), paramsRef.current]);
    setRedoStack([]);
  }, [setUndoStack, setRedoStack]);

  const recomputePacking = useCallback(
    (customParams?: Partial<SketchParams>, customPalette?: Palette) => {
      const p = { ...paramsRef.current, ...customParams };
      const pal = customPalette || activePaletteRef.current;
      const newCircles = computeSphericalCirclePacking({
        maxCircles: p.maxCircles,
        minRadius: p.minRadius,
        maxRadius: p.maxRadius,
        palette: pal,
        isExclusiveBackground: p.isExclusiveBackground,
        algorithm: p.packingAlgorithm,
      });
      setCircles(newCircles);
    },
    [setCircles],
  );

  const handleParamChange = useCallback(
    <K extends keyof SketchParams>(
      key: K,
      value: SketchParams[K],
      skipHistory = false,
    ) => {
      if (!skipHistory) {
        recordHistory();
      }
      if (key === "morphProgress") {
        liveMorphProgress.value = value as number;
      }
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "isAutoMorph" && !value) {
          next.morphProgress = liveMorphProgress.value;
        }
        return next;
      });

      // アルゴリズム変更時は即時再計算
      if (key === "packingAlgorithm") {
        recomputePacking({ [key]: value });
      }
    },
    [recordHistory, setParams, recomputePacking],
  );

  const handleApplyPalette = useCallback(
    (paletteIndex: number) => {
      recordHistory();
      const newPalette = colourPalettes[paletteIndex] || colourPalettes[0];
      setActivePalette(newPalette);
      setParams((prev) => ({
        ...prev,
        activePaletteIndex: paletteIndex,
      }));
      recomputePacking({ activePaletteIndex: paletteIndex }, newPalette);
      showToast(`パレット変更: ${newPalette.title}`, "info");
    },
    [
      recordHistory,
      setActivePalette,
      setParams,
      recomputePacking,
      showToast,
    ],
  );

  const handlePickRandomPalette = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * colourPalettes.length);
    handleApplyPalette(randomIndex);
  }, [handleApplyPalette]);

  /**
   * 現在のパレット内の色からランダムに1色を背景色として再設定
   * 円のパッキング幾何配置はそのまま保持し、色のみを瞬時に再割り当てする
   */
  const handleRandomizeBackgroundColor = useCallback(() => {
    recordHistory();
    const currentPal = activePaletteRef.current;
    if (!currentPal || currentPal.colors.length <= 1) return;

    const colors = [...currentPal.colors];
    // 現在の背景色 (インデックス 0) 以外のインデックスからランダムに選ぶ
    const pickIdx = 1 + Math.floor(Math.random() * (colors.length - 1));
    const [chosen] = colors.splice(pickIdx, 1);
    colors.unshift(chosen);

    const updatedPalette: Palette = {
      ...currentPal,
      colors,
    };

    setActivePalette(updatedPalette);
    if (!paramsRef.current.isExclusiveBackground) {
      setParams((prev) => ({ ...prev, isExclusiveBackground: true }));
    }

    const usableColors = colors.slice(1);
    setCircles((prevCircles) =>
      prevCircles.map((circle) => {
        const primaryChoice =
          usableColors[Math.floor(Math.random() * usableColors.length)] ||
          colors[0];
        const secondaryChoice =
          usableColors[Math.floor(Math.random() * usableColors.length)] ||
          primaryChoice;
        return {
          ...circle,
          primaryColor: primaryChoice.rgb,
          secondaryColor: secondaryChoice.rgb,
          primaryHex: primaryChoice.hex,
        };
      }),
    );

    showToast(
      `背景色をパレットから再設定: ${chosen.name || chosen.hex}`,
      "info",
    );
  }, [recordHistory, setActivePalette, setParams, setCircles, showToast]);

  /**
   * パレット内の特定インデックスの色を背景色として設定
   */
  const handleSetBackgroundColor = useCallback(
    (colorIndex: number) => {
      recordHistory();
      const currentPal = activePaletteRef.current;
      if (
        !currentPal ||
        colorIndex < 0 ||
        colorIndex >= currentPal.colors.length
      ) {
        return;
      }

      const colors = [...currentPal.colors];
      const [chosen] = colors.splice(colorIndex, 1);
      colors.unshift(chosen);

      const updatedPalette: Palette = {
        ...currentPal,
        colors,
      };

      setActivePalette(updatedPalette);
      if (!paramsRef.current.isExclusiveBackground) {
        setParams((prev) => ({ ...prev, isExclusiveBackground: true }));
      }

      const usableColors = colors.length > 1 ? colors.slice(1) : colors;
      setCircles((prevCircles) =>
        prevCircles.map((circle) => {
          const primaryChoice =
            usableColors[
              Math.floor(Math.random() * usableColors.length)
            ] || colors[0];
          const secondaryChoice =
            usableColors[
              Math.floor(Math.random() * usableColors.length)
            ] || primaryChoice;
          return {
            ...circle,
            primaryColor: primaryChoice.rgb,
            secondaryColor: secondaryChoice.rgb,
            primaryHex: primaryChoice.hex,
          };
        }),
      );

      showToast(
        `背景色をパレットから設定: ${chosen.name || chosen.hex}`,
        "info",
      );
    },
    [recordHistory, setActivePalette, setParams, setCircles, showToast],
  );

  const handleGenerateGradientTheme = useCallback(
    (baseHexColor: string) => {
      recordHistory();
      const customPal = generateGradientPaletteFromBaseColor(baseHexColor);
      setActivePalette(customPal);
      recomputePacking(undefined, customPal);
      showToast(`カスタムグラデーション生成 (${baseHexColor})`, "success");
    },
    [recordHistory, setActivePalette, recomputePacking, showToast],
  );

  const randomizeSelectedParameters = useCallback(() => {
    recordHistory();
    const nextUpdates: Partial<SketchParams> = {};
    let nextPalette = activePaletteRef.current;

    if (randomTargets.palette) {
      const randIdx = Math.floor(Math.random() * colourPalettes.length);
      nextPalette = colourPalettes[randIdx];
      setActivePalette(nextPalette);
      nextUpdates.activePaletteIndex = randIdx;
    }

    if (randomTargets.projection) {
      const randProj =
        PROJECTION_OPTIONS[
          Math.floor(Math.random() * PROJECTION_OPTIONS.length)
        ].value;
      nextUpdates.projectionMethod = randProj;
    }

    if (randomTargets.counts) {
      const randMaxCircles = Math.floor(Math.random() * 450) + 150;
      const randMin = Number.parseFloat(
        (Math.random() * 0.05 + 0.02).toFixed(2),
      );
      const randMax = Number.parseFloat(
        (Math.random() * 0.25 + 0.15).toFixed(2),
      );
      nextUpdates.maxCircles = randMaxCircles;
      nextUpdates.minRadius = randMin;
      nextUpdates.maxRadius = Math.max(randMin + 0.04, randMax);
    }

    setParams((prev) => ({ ...prev, ...nextUpdates }));
    recomputePacking(nextUpdates, nextPalette);
    showToast("パラメータをランダム設定しました", "success");
  }, [
    recordHistory,
    randomTargets,
    setActivePalette,
    setParams,
    recomputePacking,
    showToast,
  ]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, paramsRef.current]);
    setParams(previous);
    const pal =
      colourPalettes[previous.activePaletteIndex] ||
      activePaletteRef.current;
    setActivePalette(pal);
    recomputePacking(previous, pal);
    showToast("操作を元に戻しました (Undo)", "info");
  }, [
    undoStack,
    setUndoStack,
    setRedoStack,
    setParams,
    setActivePalette,
    recomputePacking,
    showToast,
  ]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, paramsRef.current]);
    setParams(next);
    const pal =
      colourPalettes[next.activePaletteIndex] || activePaletteRef.current;
    setActivePalette(pal);
    recomputePacking(next, pal);
    showToast("操作をやり直しました (Redo)", "info");
  }, [
    redoStack,
    setRedoStack,
    setUndoStack,
    setParams,
    setActivePalette,
    recomputePacking,
    showToast,
  ]);

  const handleImportJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed.parameters) {
            recordHistory();
            setParams(parsed.parameters);
            if (parsed.activePalette) {
              setActivePalette(parsed.activePalette);
            }
            recomputePacking(parsed.parameters, parsed.activePalette);
            showToast("JSONから設定を復元しました", "success");
          } else {
            showToast("無効なJSONフォーマットです", "danger");
          }
        } catch (err) {
          console.error(err);
          showToast("JSONの読み込みに失敗しました", "danger");
        }
      };
      reader.readAsText(file);
    },
    [
      recordHistory,
      setParams,
      setActivePalette,
      recomputePacking,
      showToast,
    ],
  );

  return {
    params,
    activePalette,
    undoStack,
    redoStack,
    showToast,
    recordHistory,
    handleParamChange,
    recomputePacking,
    handleApplyPalette,
    handlePickRandomPalette,
    handleRandomizeBackgroundColor,
    handleSetBackgroundColor,
    handleGenerateGradientTheme,
    randomizeSelectedParameters,
    handleUndo,
    handleRedo,
    handleImportJson,
  };
}
