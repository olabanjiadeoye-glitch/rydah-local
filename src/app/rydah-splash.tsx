"use client";

import { useEffect, useState } from "react";

export default function RydahSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 900 : 4700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="rydah-splash" role="status" aria-label="Rydah Local loading">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="stage">
        <div className="emblem-wrap">
          <svg className="emblem" viewBox="0 0 420 420" aria-hidden="true">
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7b4d05" />
                <stop offset="0.18" stopColor="#f7d56a" />
                <stop offset="0.42" stopColor="#b67a0b" />
                <stop offset="0.68" stopColor="#fff0a6" />
                <stop offset="1" stopColor="#b16a04" />
              </linearGradient>
              <linearGradient id="goldBright" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff3ad" />
                <stop offset="0.48" stopColor="#e2ad2d" />
                <stop offset="1" stopColor="#8a5100" />
              </linearGradient>
              <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#000" floodOpacity="0.72" />
              </filter>
            </defs>

            <g className="logo-rise" filter="url(#shadow)">
              <path className="r-body" d="M82 62h162c74 0 116 36 116 99 0 43-22 75-62 89l71 110h-83l-63-100h-61v100H82V62Zm80 64v75h75c27 0 43-13 43-38 0-24-16-37-43-37h-75Z" fill="#0b0b0b" stroke="url(#gold)" strokeWidth="15" strokeLinejoin="round" />

              <g className="house">
                <path d="M155 154 210 107l55 47v50H155v-50Z" fill="#111" stroke="url(#goldBright)" strokeWidth="8" strokeLinejoin="round" />
                <path d="M178 150h64" stroke="#dba72c" strokeWidth="6" strokeLinecap="round" />
                <rect x="201" y="129" width="19" height="19" rx="2" fill="#e7b83b" />
              </g>

              <g className="tools" stroke="url(#goldBright)" fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
                <g className="tool tool-one">
                  <path d="M111 136v78" />
                  <path d="M94 137h34l-7-16h-20l-7 16Z" fill="url(#gold)" stroke="url(#goldBright)" />
                </g>
                <g className="tool tool-two">
                  <path d="M111 225c-18 10-22 28-12 42l-23 39 19 11 23-40c18 0 31-13 33-29l-17 9-15-9-1-17 16-9c-7-4-15-4-23 3Z" />
                </g>
                <g className="tool tool-three">
                  <path d="M138 198v87" />
                  <path d="M132 190h12l6 15h-24l6-15Z" fill="url(#gold)" />
                  <path d="M128 286h20" />
                </g>
              </g>

              <g className="route-group">
                <path className="route-glow" d="M74 344c65-7 82-91 145-91 49 0 57 51 104 51 31 0 53-15 72-39" fill="none" stroke="#7d5208" strokeWidth="31" strokeLinecap="round" opacity=".72" />
                <path className="route" d="M74 344c65-7 82-91 145-91 49 0 57 51 104 51 31 0 53-15 72-39" fill="none" stroke="url(#goldBright)" strokeWidth="22" strokeLinecap="round" />
                <path className="road" d="M74 344c65-7 82-91 145-91 49 0 57 51 104 51 31 0 53-15 72-39" fill="none" stroke="#101010" strokeWidth="13" strokeLinecap="round" />
                <path className="road-dash" d="M83 339c58-13 80-81 136-81 45 0 58 51 103 51 31 0 53-15 67-37" fill="none" stroke="#e4b132" strokeWidth="3" strokeDasharray="14 16" strokeLinecap="round" />
              </g>

              <g className="pin" filter="url(#glow)">
                <path d="M226 196c0-31 23-54 53-54 31 0 54 23 54 54 0 39-54 88-54 88s-53-49-53-88Z" fill="url(#goldBright)" stroke="#5b3500" strokeWidth="5" />
                <circle cx="279" cy="196" r="19" fill="#111" stroke="#f3cf68" strokeWidth="4" />
              </g>
            </g>
          </svg>
          <div className="light-sweep" />
        </div>

        <div className="brand-lockup">
          <div className="wordmark"><span>RYDAH</span><i />LOCAL</div>
          <div className="tagline">Move Smart. Move Rydah.</div>
        </div>

        <div className="loading-line"><span /></div>
      </div>

      <style jsx>{`
        .rydah-splash {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: radial-gradient(circle at 50% 34%, #1c1608 0%, #080808 38%, #020202 72%);
          color: white;
          animation: splashExit .7s ease 4s forwards;
        }
        .stage { width: min(86vw, 430px); display: flex; flex-direction: column; align-items: center; perspective: 1000px; }
        .emblem-wrap { position: relative; width: min(74vw, 340px); aspect-ratio: 1; transform-style: preserve-3d; animation: stageFloat 4s cubic-bezier(.2,.8,.2,1) both; }
        .emblem { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 0 18px rgba(217,164,42,.16)); }
        .logo-rise { transform-origin: 50% 55%; animation: logoRise 2.05s cubic-bezier(.18,.89,.32,1.25) both; }
        .r-body { stroke-dasharray: 1380; stroke-dashoffset: 1380; animation: drawGold 1.4s ease-out .12s forwards; }
        .house { opacity: 0; transform: translateY(-15px); transform-origin: center; animation: toolIn .55s ease-out 1.08s forwards; }
        .tool { opacity: 0; transform: translateX(-18px) scale(.8); transform-origin: center; }
        .tool-one { animation: toolIn .4s ease-out 1.22s forwards; }
        .tool-two { animation: toolIn .4s ease-out 1.43s forwards; }
        .tool-three { animation: toolIn .4s ease-out 1.64s forwards; }
        .route-group { opacity: 0; animation: fadeIn .35s ease 1.72s forwards; }
        .route, .road, .route-glow { stroke-dasharray: 560; stroke-dashoffset: 560; animation: roadDraw .9s ease-out 1.72s forwards; }
        .road-dash { stroke-dasharray: 14 16; stroke-dashoffset: 260; animation: roadMotion 1.2s linear 2.25s infinite; }
        .pin { opacity: 0; transform-origin: 279px 220px; animation: pinPop .62s cubic-bezier(.17,.89,.32,1.45) 2.05s forwards, pinPulse 1.35s ease-in-out 2.75s infinite; }
        .light-sweep { position: absolute; inset: 9% 6%; pointer-events: none; background: linear-gradient(112deg, transparent 37%, rgba(255,243,185,.02) 43%, rgba(255,240,160,.82) 50%, rgba(255,213,86,.06) 56%, transparent 63%); transform: translateX(-150%) skewX(-12deg); mix-blend-mode: screen; animation: shine 1.05s ease 2.45s forwards; }
        .brand-lockup { margin-top: -12px; text-align: center; opacity: 0; transform: translateY(18px); animation: brandIn .7s ease-out 2.7s forwards; }
        .wordmark { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: clamp(28px,7vw,40px); font-weight: 900; letter-spacing: .055em; color: #d8a52b; text-shadow: 0 1px 0 #fff0a1, 0 3px 0 #744300, 0 0 20px rgba(212,175,55,.25); }
        .wordmark span { color: #f0c95a; }
        .wordmark i { display: inline-block; width: 2px; height: 31px; background: linear-gradient(#fff0a3,#8a5300); box-shadow: 0 0 9px rgba(245,197,75,.5); }
        .tagline { margin-top: 8px; color: #dcc06e; font-size: clamp(13px,3.5vw,17px); font-weight: 650; font-style: italic; letter-spacing: .06em; opacity: 0; animation: fadeIn .55s ease 3.12s forwards; }
        .loading-line { width: min(66vw,280px); height: 2px; margin-top: 28px; overflow: hidden; background: rgba(212,175,55,.12); border-radius: 999px; opacity: 0; animation: fadeIn .4s ease 3.25s forwards; }
        .loading-line span { display: block; width: 100%; height: 100%; transform-origin: left; background: linear-gradient(90deg,#714600,#f2cd62,#fff1a4); animation: load 1.1s ease 3.28s both; }
        .ambient { position: absolute; border-radius: 999px; filter: blur(70px); opacity: .2; }
        .ambient-one { width: 38vw; height: 38vw; max-width: 460px; max-height: 460px; background: #8d5f00; left: -12vw; bottom: -12vw; animation: ambient 4s ease-in-out infinite alternate; }
        .ambient-two { width: 30vw; height: 30vw; max-width: 360px; max-height: 360px; background: #d4af37; right: -14vw; top: -10vw; animation: ambient 4.2s ease-in-out .4s infinite alternate-reverse; }
        @keyframes logoRise { 0% { opacity:0; transform: translateY(42px) rotateX(22deg) rotateY(-15deg) scale(.74); } 58% { opacity:1; transform: translateY(-4px) rotateX(-4deg) rotateY(5deg) scale(1.035); } 100% { opacity:1; transform: translateY(0) rotateX(0) rotateY(0) scale(1); } }
        @keyframes drawGold { to { stroke-dashoffset:0; } }
        @keyframes toolIn { to { opacity:1; transform: translate(0) scale(1); } }
        @keyframes fadeIn { to { opacity:1; } }
        @keyframes roadDraw { to { stroke-dashoffset:0; } }
        @keyframes roadMotion { to { stroke-dashoffset: -60; } }
        @keyframes pinPop { 0% { opacity:0; transform: translateY(-22px) scale(.5); } 70% { opacity:1; transform: translateY(4px) scale(1.08); } 100% { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes pinPulse { 0%,100% { filter: drop-shadow(0 0 3px rgba(236,193,73,.3)); } 50% { filter: drop-shadow(0 0 15px rgba(255,215,95,.8)); } }
        @keyframes shine { 0% { transform:translateX(-150%) skewX(-12deg); } 100% { transform:translateX(150%) skewX(-12deg); } }
        @keyframes brandIn { to { opacity:1; transform:translateY(0); } }
        @keyframes load { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes stageFloat { 0% { transform: rotateX(8deg) rotateY(-4deg); } 55% { transform: rotateX(-2deg) rotateY(3deg); } 100% { transform: rotateX(0) rotateY(0); } }
        @keyframes ambient { from { transform:scale(.82) translate(0,0); } to { transform:scale(1.1) translate(4vw,-2vw); } }
        @keyframes splashExit { to { opacity:0; visibility:hidden; transform:scale(1.025); } }
        @media (prefers-reduced-motion: reduce) {
          .rydah-splash, .emblem-wrap, .logo-rise, .r-body, .house, .tool, .route-group, .route, .road, .route-glow, .road-dash, .pin, .light-sweep, .brand-lockup, .tagline, .loading-line, .loading-line span, .ambient { animation: none !important; }
          .rydah-splash { opacity:1; }
          .brand-lockup, .tagline, .loading-line, .house, .tool, .route-group, .pin { opacity:1; }
          .r-body, .route, .road, .route-glow { stroke-dashoffset:0; }
        }
      `}</style>
    </div>
  );
}
