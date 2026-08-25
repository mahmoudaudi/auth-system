import { useState } from "react";
import type { ReactNode } from "react";
import avatar from "../assets/auth/avatar.png";
import rightPanel from "../assets/auth/right-panel.svg";
import chandelier from "../assets/auth/chandelier.png";
import plant from "../assets/auth/plant.png";

/** Figma design: forest-green login panel with avatar + decorative art panel.
 *  `compact` (register) hides the avatar and tightens the top padding.
 *  The art panel has a pull-cord: click it to switch the lamp on/off. */
export default function AuthLayout({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const [lampOn, setLampOn] = useState(false);
  const [pulling, setPulling] = useState(false);

  function toggleLamp() {
    setPulling(true);
    window.setTimeout(() => setPulling(false), 220);
    setLampOn((v) => !v);
  }

  return (
    <div className="auth-page grid min-h-screen overflow-hidden lg:h-screen lg:grid-cols-[minmax(570px,56.6%)_1fr]">
      {/* Login panel */}
      <section
        className={`auth-panel relative z-[2] flex justify-center px-6 pb-8 sm:px-12 ${
          compact
            ? "items-center pt-20"
            : "min-h-screen items-center sm:min-h-0 sm:items-start sm:pt-44 lg:pt-[clamp(160px,23vh,240px)]"
        }`}
      >
        <div className={`relative w-full max-w-[420px] ${compact ? "my-auto" : ""}`}>
          {!compact && (
            <img
              src={avatar}
              alt=""
              draggable={false}
              className="mx-auto mb-4 block w-16 sm:absolute sm:left-1/2 sm:top-6 sm:mx-0 sm:mb-0 sm:block sm:-translate-x-1/2 lg:top-[clamp(48px,7vh,80px)] lg:w-20 sm:w-[72px]"
            />
          )}
          {children}
        </div>
      </section>

      {/* Art panel */}
      <section
        className="auth-art relative hidden overflow-hidden lg:block"
        aria-hidden="true"
      >
        {/* Yellow shape — always dim; only the pool behind the character is lit */}
        <img
          src={rightPanel}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full brightness-[0.5] saturate-[0.75]"
        />

        {/* Pool of light on the floor behind the character — only when lamp is on */}
        <div
          className={`absolute bottom-[12%] left-[40%] z-[2] h-[190px] w-[min(340px,62%)] -translate-x-1/2 rounded-full transition-opacity duration-700 ${
            lampOn ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,220,110,0.55) 0%, rgba(255,196,42,0.25) 45%, rgba(255,196,42,0) 72%)",
            filter: "blur(8px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Light — glow at the bulb + beam flowing out of it, fade in as ONE unit */}
        <div
          className={`transition-opacity duration-700 ${
            lampOn ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="auth-lamp-glow left-[37%] top-[92px] h-[62px] w-[62px]" />
          <div className="auth-chandelier-light left-[37%] top-[98px] h-[calc(52%-98px)] w-[150px]" />
        </div>

        {/* Pendant lamp — slightly dimmed while off */}
        <img
          src={chandelier}
          alt=""
          draggable={false}
          className={`absolute left-[37%] top-[-24px] z-[3] w-[88px] -translate-x-1/2 transition-[filter] duration-700 2xl:w-[100px] ${
            lampOn ? "" : "brightness-[0.82] saturate-[0.85]"
          }`}
        />

        {/* Pull cord — click to toggle the lamp */}
        <button
          type="button"
          onClick={toggleLamp}
          aria-label={lampOn ? "Turn off the light" : "Turn on the light"}
          aria-pressed={lampOn}
          className="group absolute left-[calc(37%+58px)] top-0 z-[4] flex cursor-pointer flex-col items-center"
        >
          <span className="block h-24 w-[3px] origin-top rounded-full bg-[#0E4034] transition-transform duration-200 group-hover:bg-[#0B332A] group-active:scale-y-110" />
          <span
            className={`block h-3.5 w-3.5 rounded-full bg-[#0E4034] shadow transition-all duration-200 ${
              pulling ? "translate-y-2" : ""
            } group-hover:bg-[#0B332A]`}
          />
        </button>

        {/* Sitting character — dim in the dark, lit when the lamp is on */}
        <img
          src={plant}
          alt=""
          draggable={false}
          className={`absolute bottom-[20%] left-[40%] z-[2] w-[min(220px,40%)] -translate-x-1/2 transition-[filter] duration-700 2xl:w-[min(260px,44%)] ${
            lampOn
              ? "brightness-105 contrast-105"
              : "brightness-[0.38] saturate-[0.55]"
          }`}
        />
      </section>
    </div>
  );
}
