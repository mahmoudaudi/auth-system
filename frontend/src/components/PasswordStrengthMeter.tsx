import { passwordChecks } from "../lib/validation";

const CHECK_COUNT = 4;

function strengthMeta(met: number) {
  if (met <= 1) return { label: "Weak", bar: "bg-error", text: "text-error" };
  if (met === 2 || met === 3)
    return { label: met === 2 ? "Fair" : "Good", bar: "bg-warning", text: "text-warning" };
  return { label: "Strong", bar: "bg-success", text: "text-success" };
}

/** Progressive strength line: fills 25% per satisfied requirement,
 *  red → amber → green. Hidden until the user starts typing.
 *  `onDark` adapts colors for dark/colored backgrounds (auth pages). */
export default function PasswordStrengthMeter({
  password,
  onDark = false,
}: {
  password: string;
  onDark?: boolean;
}) {
  if (password.length === 0) return null;

  const checks = passwordChecks(password);
  const met = Object.values(checks).filter(Boolean).length;
  const meta = strengthMeta(met);

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] ${onDark ? "text-white/60" : "text-on-surface-variant"}`}>
          Password strength
        </span>
        <span className={`text-[11px] font-semibold ${meta.text}`}>
          {meta.label} · {met}/{CHECK_COUNT}
        </span>
      </div>
      <div
        className={`mt-1 h-1 overflow-hidden rounded-full ${
          onDark ? "bg-white/20" : "bg-surface-border"
        }`}
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={CHECK_COUNT}
        aria-valuenow={met}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${meta.bar}`}
          style={{ width: `${(met / CHECK_COUNT) * 100}%` }}
        />
      </div>
    </div>
  );
}
