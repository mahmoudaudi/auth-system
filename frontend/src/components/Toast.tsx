import { useEffect, useState } from "react";
import type { ToastType } from "./ToastContext";

const ICONS: Record<ToastType, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning",
  info: "info",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-[#00523F] text-white",
  error: "bg-[#DC2626] text-white",
  warning: "bg-[#F59E0B] text-[#1F2937]",
  info: "bg-[#1F2937] text-white",
};

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
}

export default function Toast({ type, message, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all duration-300 ease-out ${STYLES[type]} ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-4 opacity-0"
      }`}
    >
      <span className="material-symbols-outlined text-[22px] shrink-0">
        {ICONS[type]}
      </span>
      <span className="flex-1 text-sm font-medium leading-snug">{message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/15"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
