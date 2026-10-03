import { AnimatePresence, motion } from "framer-motion";
import { useAtom } from "jotai";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import type React from "react";
import { toastsAtom } from "../state/sketchStore";

export const ToastNotification: React.FC = () => {
  const [toasts] = useAtom(toastsAtom);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgClass =
            "bg-slate-900/90 border-slate-700/80 text-slate-100";
          let icon = <Info className="w-4 h-4 text-sky-400 shrink-0" />;

          if (toast.variant === "success") {
            bgClass =
              "bg-emerald-950/90 border-emerald-500/50 text-emerald-100";
            icon = (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            );
          } else if (toast.variant === "danger") {
            bgClass = "bg-rose-950/90 border-rose-500/50 text-rose-100";
            icon = (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            );
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-xl text-xs font-medium tracking-wide ${bgClass}`}
            >
              {icon}
              <span>{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
