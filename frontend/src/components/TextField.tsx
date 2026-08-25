import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | undefined;
  helperText?: string | undefined;
}

/** Labeled input with inline error (announced via role="alert"), helper
 *  text, visible focus ring, and an eye toggle when used for passwords. */
export default function TextField({
  id,
  label,
  error,
  helperText,
  type = "text",
  className = "",
  ...rest
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  const describedBy =
    [error ? `${id}-error` : null, !error && helperText ? `${id}-helper` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-[12px] font-medium text-on-surface-variant">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border bg-surface px-2.5 py-1.5 text-body-sm text-on-surface outline-none transition-colors duration-200 placeholder:text-outline focus:ring-2 ${
            isPassword ? "pr-11" : ""
          } ${
            error
              ? "border-error focus:border-error focus:ring-error/30"
              : "border-outline-variant focus:border-primary focus:ring-primary/25"
          } ${className}`}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-outline transition-colors duration-200 hover:text-primary"
          >
            <span className="material-symbols-outlined text-[18px]">
              {revealed ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-[12px] leading-4 text-error">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-[12px] leading-4 text-outline">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
