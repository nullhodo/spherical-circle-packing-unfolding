import { useEffect } from "react";

interface ShortcutHandlers {
  onStartRecord: () => void;
  onStopRecord: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePanel: () => void;
  onToggleDebug: () => void;
  onToggleAutoMorph: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        return;
      }

      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (isCtrlOrMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handlers.onRedo();
        } else {
          handlers.onUndo();
        }
      } else if (isCtrlOrMeta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handlers.onRedo();
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        handlers.onStartRecord();
      } else if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        handlers.onStopRecord();
      } else if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        handlers.onTogglePanel();
      } else if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        handlers.onToggleDebug();
      } else if (event.key === " ") {
        event.preventDefault();
        handlers.onToggleAutoMorph();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
