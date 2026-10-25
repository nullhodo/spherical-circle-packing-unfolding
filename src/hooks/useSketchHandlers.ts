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

  /**
   * 既存のサークルパッキング配置（円の位置・半径）を完全維持したまま、
   * 指定したパレットの色のみを円に再割り当て（リカラー）する
   */
  const recolorExistingCircles = useCallback(
    (palette: Palette) => {
      const colors = palette.colors;
      if (colors.length === 0) return;
      const usableColors =
        paramsRef.current.isExclusiveBackground && colors.length > 1
          ? colors.slice(1)
          : colors;
      const fallback = colors[0];

      setCircles((prevCircles) =>
        prevCircles.map((circle) => {
          const primaryChoice =
            usableColors[
              Math.floor(Math.random() * usableColors.length)
            ] || fallback;
          const secondaryChoice =
            usableColors[
              Math.floor(Math.random() * usableColors.length)
            ] || primaryChoice;
          return {
            ...circle,
            primaryColor: primaryChoice.rgb,
            primaryHex: primaryChoice.hex,
            secondaryColor: secondaryChoice.rgb,
          };
        }),
      );
    },
    [setCircles],
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
      // 円の幾何配置（サークルパッキング構造）は維持し、色のみを新パレットで更新
      recolorExistingCircles(newPalette);
      showToast(`パレット変更: ${newPalette.title}`, "info");
    },
    [
      recordHistory,
      setActivePalette,
      setParams,
      recolorExistingCircles,
      showToast,
    ],
  );

  const handlePickRandomPalette = useCallback(() => {
    const currentIdx = paramsRef.current.activePaletteIndex;
    const currentTitle = activePaletteRef.current?.title;

    // 現在選択中のパレット（インデックスおよびタイトル）と異なるパレットを候補にする
    const availableIndices = colourPalettes
      .map((pal, i) => ({ pal, i }))
      .filter(
        ({ pal, i }) => i !== currentIdx && pal.title !== currentTitle,
      )
      .map(({ i }) => i);

    const targetPool =
      availableIndices.length > 0
        ? availableIndices
        : colourPalettes.map((_, i) => i).filter((i) => i !== currentIdx);

    const randomIndex =
      targetPool.length > 0
        ? targetPool[Math.floor(Math.random() * targetPool.length)]
        : 0;

    handleApplyPalette(randomIndex);
  }, [handleApplyPalette]);

  /**
   * パレット内の特定の色を背景色として設定
   * クリックした色を確実に背景色とし、ランダム再抽選せずに該当色のみ元の背景色とスワップする
   */
  const handleSetBackgroundColor = useCallback(
    (colorIndex: number, targetHex?: string) => {
      recordHistory();
      const currentPal = activePaletteRef.current;
      if (!currentPal || currentPal.colors.length === 0) {
        return;
      }

      // targetHex が渡されていれば hex で厳密に検索し、インデックスのズレを完全防止
      let foundIndex = -1;
      if (targetHex) {
        foundIndex = currentPal.colors.findIndex(
          (c) => c.hex.toLowerCase() === targetHex.toLowerCase(),
        );
      }
      if (foundIndex === -1) {
        foundIndex = colorIndex;
      }

      if (foundIndex < 0 || foundIndex >= currentPal.colors.length) {
        return;
      }

      // 既に背景色 (先頭インデックス) の場合は何もしない
      if (foundIndex === 0 && paramsRef.current.isExclusiveBackground) {
        return;
      }

      const prevBgColor = currentPal.colors[0];
      const colors = [...currentPal.colors];
      const [chosen] = colors.splice(foundIndex, 1);
      colors.unshift(chosen);

      const updatedPalette: Palette = {
        ...currentPal,
        colors,
      };

      setActivePalette(updatedPalette);
      if (!paramsRef.current.isExclusiveBackground) {
        setParams((prev) => ({ ...prev, isExclusiveBackground: true }));
      }

      // 円の色のスワップ:
      // 新しい背景色と同じ色だった円のみ、直前の背景色 (prevBgColor) に置き換える。
      // 他の円の色は一切変えないことで、ガチャガチャとランダムに変わるのを完全に防止！
      const chosenHexLower = chosen.hex.toLowerCase();
      setCircles((prevCircles) =>
        prevCircles.map((circle) => {
          const isPrimarySameAsNewBg =
            circle.primaryHex?.toLowerCase() === chosenHexLower ||
            (circle.primaryColor[0] === chosen.rgb[0] &&
              circle.primaryColor[1] === chosen.rgb[1] &&
              circle.primaryColor[2] === chosen.rgb[2]);

          const isSecondarySameAsNewBg =
            circle.secondaryColor[0] === chosen.rgb[0] &&
            circle.secondaryColor[1] === chosen.rgb[1] &&
            circle.secondaryColor[2] === chosen.rgb[2];

          if (!isPrimarySameAsNewBg && !isSecondarySameAsNewBg) {
            return circle;
          }

          return {
            ...circle,
            primaryColor: isPrimarySameAsNewBg
              ? prevBgColor.rgb
              : circle.primaryColor,
            primaryHex: isPrimarySameAsNewBg
              ? prevBgColor.hex
              : circle.primaryHex,
            secondaryColor: isSecondarySameAsNewBg
              ? prevBgColor.rgb
              : circle.secondaryColor,
          };
        }),
      );

      showToast(`背景色を設定: ${chosen.name || chosen.hex}`, "info");
    },
    [recordHistory, setActivePalette, setParams, setCircles, showToast],
  );

  /**
   * 現在のパレット内の色から、現在の背景色とは異なる色を1色選んで背景色として再設定
   * 円のパッキング幾何配置は保持し、新背景色と同色の円のみ元の背景色とスワップする
   */
  const handleRandomizeBackgroundColor = useCallback(() => {
    const currentPal = activePaletteRef.current;
    if (!currentPal || currentPal.colors.length <= 1) return;

    // 現在の背景色HEX
    const currentBgHex = (
      paramsRef.current.isExclusiveBackground &&
      currentPal.colors.length > 0
        ? currentPal.colors[0].hex
        : ""
    ).toLowerCase();

    // 現在の背景色HEXと異なる色を候補インデックスとして収集
    const candidateIndices: number[] = [];
    currentPal.colors.forEach((c, idx) => {
      if (paramsRef.current.isExclusiveBackground && idx === 0) return;
      if (c.hex.toLowerCase() !== currentBgHex) {
        candidateIndices.push(idx);
      }
    });

    // 候補があればその中からランダム選択、なければ先頭以外から選択
    const chosenIndex =
      candidateIndices.length > 0
        ? candidateIndices[
            Math.floor(Math.random() * candidateIndices.length)
          ]
        : 1;

    handleSetBackgroundColor(chosenIndex);
  }, [handleSetBackgroundColor]);

  const handleGenerateGradientTheme = useCallback(
    (baseHexColor: string) => {
      recordHistory();
      const customPal = generateGradientPaletteFromBaseColor(baseHexColor);
      setActivePalette(customPal);
      recolorExistingCircles(customPal);
      showToast(`カスタムグラデーション生成 (${baseHexColor})`, "success");
    },
    [recordHistory, setActivePalette, recolorExistingCircles, showToast],
  );

  const handleShufflePaletteColors = useCallback(() => {
    recordHistory();
    const currentPal = activePaletteRef.current;
    if (!currentPal || currentPal.colors.length <= 2) {
      showToast("シャッフルするには3色以上必要です", "info");
      return;
    }

    const colors = [...currentPal.colors];
    const nonBg = colors.slice(1);
    const originalOrderHexes = nonBg
      .map((c) => c.hex.toLowerCase())
      .join(",");

    // 元の並び順と異なる並びになるまでシャッフル（最大10回）
    let attempts = 0;
    while (attempts < 10) {
      for (let i = nonBg.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nonBg[i], nonBg[j]] = [nonBg[j], nonBg[i]];
      }
      if (
        nonBg.map((c) => c.hex.toLowerCase()).join(",") !==
        originalOrderHexes
      ) {
        break;
      }
      attempts++;
    }

    // 万が一同じ並びのままなら、先頭と末尾を強制スワップ
    if (
      nonBg.length > 1 &&
      nonBg.map((c) => c.hex.toLowerCase()).join(",") ===
        originalOrderHexes
    ) {
      const temp = nonBg[0];
      nonBg[0] = nonBg[nonBg.length - 1];
      nonBg[nonBg.length - 1] = temp;
    }

    const updatedPalette: Palette = {
      ...currentPal,
      colors: [colors[0], ...nonBg],
    };
    setActivePalette(updatedPalette);
    recolorExistingCircles(updatedPalette);
    showToast("パレット配色をシャッフルしました", "info");
  }, [recordHistory, setActivePalette, recolorExistingCircles, showToast]);

  const randomizeSelectedParameters = useCallback(() => {
    recordHistory();
    const nextUpdates: Partial<SketchParams> = {};
    let nextPalette = activePaletteRef.current;

    if (randomTargets.palette) {
      const currentIdx = paramsRef.current.activePaletteIndex;
      const currentTitle = activePaletteRef.current?.title;
      const availableIndices = colourPalettes
        .map((pal, i) => ({ pal, i }))
        .filter(
          ({ pal, i }) => i !== currentIdx && pal.title !== currentTitle,
        )
        .map(({ i }) => i);

      const targetPool =
        availableIndices.length > 0
          ? availableIndices
          : colourPalettes
              .map((_, i) => i)
              .filter((i) => i !== currentIdx);

      const randIdx =
        targetPool.length > 0
          ? targetPool[Math.floor(Math.random() * targetPool.length)]
          : Math.floor(Math.random() * colourPalettes.length);

      nextPalette = colourPalettes[randIdx];
      setActivePalette(nextPalette);
      nextUpdates.activePaletteIndex = randIdx;
    }

    if (
      randomTargets.paletteShuffle &&
      nextPalette &&
      nextPalette.colors.length > 2
    ) {
      const colors = [...nextPalette.colors];
      const nonBg = colors.slice(1);
      const originalOrderHexes = nonBg
        .map((c) => c.hex.toLowerCase())
        .join(",");

      let attempts = 0;
      while (attempts < 10) {
        for (let i = nonBg.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nonBg[i], nonBg[j]] = [nonBg[j], nonBg[i]];
        }
        if (
          nonBg.map((c) => c.hex.toLowerCase()).join(",") !==
          originalOrderHexes
        ) {
          break;
        }
        attempts++;
      }

      if (
        nonBg.length > 1 &&
        nonBg.map((c) => c.hex.toLowerCase()).join(",") ===
          originalOrderHexes
      ) {
        const temp = nonBg[0];
        nonBg[0] = nonBg[nonBg.length - 1];
        nonBg[nonBg.length - 1] = temp;
      }

      nextPalette = { ...nextPalette, colors: [colors[0], ...nonBg] };
      setActivePalette(nextPalette);
    }

    if (randomTargets.projectionMethod) {
      const randProj =
        PROJECTION_OPTIONS[
          Math.floor(Math.random() * PROJECTION_OPTIONS.length)
        ].value;
      nextUpdates.projectionMethod = randProj;
    }

    if (randomTargets.morphTransitionMode) {
      const modes: ("direct" | "cylinder" | "unroll")[] = [
        "direct",
        "cylinder",
        "unroll",
      ];
      nextUpdates.morphTransitionMode =
        modes[Math.floor(Math.random() * modes.length)];
    }

    if (randomTargets.projectionScale) {
      nextUpdates.projectionScale = Number.parseFloat(
        (Math.random() * 1.5 + 0.6).toFixed(2),
      );
    }

    if (randomTargets.rotationSpeed) {
      nextUpdates.rotationSpeed = Number.parseFloat(
        (Math.random() * 2.0 + 0.5).toFixed(1),
      );
    }

    if (randomTargets.morphSpeed) {
      nextUpdates.morphSpeed = Number.parseFloat(
        (Math.random() * 2.0 + 0.5).toFixed(1),
      );
    }

    let needRecompute = false;

    if (randomTargets.maxCircles) {
      nextUpdates.maxCircles = Math.floor(Math.random() * 450) + 150;
      needRecompute = true;
    }

    if (randomTargets.minRadius || randomTargets.maxRadius) {
      const randMin = Number.parseFloat(
        (Math.random() * 0.04 + 0.005).toFixed(3),
      );
      const randMax = Number.parseFloat(
        (Math.random() * 0.3 + 0.15).toFixed(2),
      );
      if (randomTargets.minRadius) nextUpdates.minRadius = randMin;
      if (randomTargets.maxRadius)
        nextUpdates.maxRadius = Math.max(randMin + 0.03, randMax);
      needRecompute = true;
    }

    if (randomTargets.circleSegments) {
      const segs = [32, 64, 128];
      nextUpdates.circleSegments =
        segs[Math.floor(Math.random() * segs.length)];
    }

    if (randomTargets.domeRings) {
      const rings = [2, 4, 6, 8];
      nextUpdates.domeRings =
        rings[Math.floor(Math.random() * rings.length)];
    }

    if (randomTargets.showStroke) {
      nextUpdates.showStroke = Math.random() > 0.5;
    }

    if (randomTargets.strokeWeight) {
      nextUpdates.strokeWeight = Number.parseFloat(
        (Math.random() * 2.5 + 0.8).toFixed(1),
      );
    }

    if (randomTargets.showGrid) {
      nextUpdates.showGrid = Math.random() > 0.4;
    }

    if (
      randomTargets.isExclusiveBackground &&
      nextPalette &&
      nextPalette.colors.length > 1
    ) {
      const currentBgHex = (
        paramsRef.current.isExclusiveBackground &&
        activePaletteRef.current?.colors[0]?.hex
          ? activePaletteRef.current.colors[0].hex
          : ""
      ).toLowerCase();

      const colors = [...nextPalette.colors];
      const candidateIndices: number[] = [];
      colors.forEach((c, idx) => {
        // パレットが変わっていない場合は先頭（元の背景色）は除外
        if (!randomTargets.palette && idx === 0) return;
        if (c.hex.toLowerCase() !== currentBgHex) {
          candidateIndices.push(idx);
        }
      });

      const pickIdx =
        candidateIndices.length > 0
          ? candidateIndices[
              Math.floor(Math.random() * candidateIndices.length)
            ]
          : 1;

      const [chosen] = colors.splice(pickIdx, 1);
      colors.unshift(chosen);
      nextPalette = { ...nextPalette, colors };
      setActivePalette(nextPalette);
      nextUpdates.isExclusiveBackground = true;
    }

    setParams((prev) => ({ ...prev, ...nextUpdates }));
    if (needRecompute) {
      recomputePacking(nextUpdates, nextPalette);
    } else if (
      (randomTargets.palette ||
        randomTargets.paletteShuffle ||
        randomTargets.isExclusiveBackground) &&
      nextPalette
    ) {
      recolorExistingCircles(nextPalette);
    }
    showToast("選択パラメータをランダム設定しました", "success");
  }, [
    recordHistory,
    randomTargets,
    setActivePalette,
    setParams,
    recomputePacking,
    recolorExistingCircles,
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
    handleShufflePaletteColors,
    handleRandomizeBackgroundColor,
    handleSetBackgroundColor,
    handleGenerateGradientTheme,
    randomizeSelectedParameters,
    handleUndo,
    handleRedo,
    handleImportJson,
  };
}
