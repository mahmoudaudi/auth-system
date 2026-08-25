/** Inline SVG logo for UserSys — shield + person mark. */
export default function Logo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="UserSys logo"
      className={className}
    >
      {/* Shield */}
      <path
        d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
        fill="currentColor"
        opacity={0.15}
      />
      <path
        d="M32 6L10 17v15c0 13.6 9.52 26.32 22 30.4C44.48 58.32 54 45.6 54 32V17L32 6z"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Person: head */}
      <circle cx={32} cy={27} r={7} fill="currentColor" />
      {/* Person: body */}
      <path
        d="M20 46c0-6.627 5.373-12 12-12s12 5.373 12 12"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
