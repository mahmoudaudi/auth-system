import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider dialog for forms (default) or narrower for confirmations. */
  size?: "sm" | "md";
}

export default function Modal({ title, onClose, children, size = "md" }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-heading/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`card max-h-[90vh] w-full overflow-y-auto p-5 shadow-xl sm:p-6 ${
          size === "sm" ? "max-w-sm" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-headline-md font-semibold text-heading">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="cursor-pointer rounded-lg p-1 text-outline transition-colors duration-200 hover:bg-surface-muted hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
