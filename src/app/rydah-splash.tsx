"use client";

import { useEffect, useState } from "react";

export default function RydahSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 800 : 3000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="rydah-splash" role="status" aria-label="Rydah Local loading">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="stage">
        <div className="emblem-wrap">
          <img className="emblem" src="/rydah-icon.svg" alt="" aria-hidden="true" />
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
          animation: splashExit .55s ease 2.55s forwards;
        }
        .stage {
          width: min(86vw, 430px);
          display: flex;
          flex-direction: column;
          align-items: center;
          perspective: 1000px;
        }
        .emblem-wrap {
          position: relative;
          width: min(66vw, 300px);
          aspect-ratio: 1;
          transform-style: preserve-3d;
          animation: logoRise 1.2s cubic-bezier(.18,.89,.32,1.18) both;
        }
        .emblem {
          width: 100%;
          height: 100%;
          display: block;
          filter: drop-shadow(0 0 20px rgba(212,175,55,.25));
          border-radius: 24%;
        }
        .light-sweep {
          position: absolute;
          inset: 7%;
          pointer-events: none;
          border-radius: 24%;
          background: linear-gradient(112deg, transparent 37%, rgba(255,243,185,.02) 43%, rgba(255,240,160,.72) 50%, rgba(255,213,86,.05) 56%, transparent 63%);
          transform: translateX(-150%) skewX(-12deg);
          mix-blend-mode: screen;
          animation: shine .85s ease 1.05s forwards;
        }
        .brand-lockup {
          margin-top: 18px;
          text-align: center;
          opacity: 0;
          transform: translateY(14px);
          animation: brandIn .55s ease-out 1.1s forwards;
        }
        .wordmark {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: clamp(28px,7vw,40px);
          font-weight: 900;
          letter-spacing: .055em;
          color: #d8a52b;
          text-shadow: 0 1px 0 #fff0a1, 0 3px 0 #744300, 0 0 20px rgba(212,175,55,.25);
        }
        .wordmark span { color: #f0c95a; }
        .wordmark i {
          display: inline-block;
          width: 2px;
          height: 31px;
          background: linear-gradient(#fff0a3,#8a5300);
          box-shadow: 0 0 9px rgba(245,197,75,.5);
        }
        .tagline {
          margin-top: 8px;
          color: #dcc06e;
          font-size: clamp(13px,3.5vw,17px);
          font-weight: 650;
          letter-spacing: .06em;
          opacity: 0;
          animation: fadeIn .5s ease 1.45s forwards;
        }
        .loading-line {
          width: min(66vw,280px);
          height: 2px;
          margin-top: 28px;
          overflow: hidden;
          background: rgba(212,175,55,.12);
          border-radius: 999px;
          opacity: 0;
          animation: fadeIn .35s ease 1.65s forwards;
        }
        .loading-line span {
          display: block;
          width: 100%;
          height: 100%;
          transform-origin: left;
          background: linear-gradient(90deg,#714600,#f2cd62,#fff1a4);
          animation: load .75s ease 1.7s both;
        }
        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: .2;
        }
        .ambient-one {
          width: 38vw;
          height: 38vw;
          max-width: 460px;
          max-height: 460px;
          background: #8d5f00;
          left: -12vw;
          bottom: -12vw;
        }
        .ambient-two {
          width: 30vw;
          height: 30vw;
          max-width: 360px;
          max-height: 360px;
          background: #d4af37;
          right: -14vw;
          top: -10vw;
        }
        @keyframes logoRise {
          0% { opacity:0; transform: translateY(34px) rotateX(16deg) scale(.78); }
          70% { opacity:1; transform: translateY(-3px) rotateX(-2deg) scale(1.025); }
          100% { opacity:1; transform: translateY(0) rotateX(0) scale(1); }
        }
        @keyframes shine {
          from { transform:translateX(-150%) skewX(-12deg); }
          to { transform:translateX(150%) skewX(-12deg); }
        }
        @keyframes brandIn { to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { to { opacity:1; } }
        @keyframes load { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes splashExit { to { opacity:0; visibility:hidden; transform:scale(1.015); } }
        @media (prefers-reduced-motion: reduce) {
          .rydah-splash, .emblem-wrap, .light-sweep, .brand-lockup, .tagline, .loading-line, .loading-line span {
            animation: none !important;
          }
          .brand-lockup, .tagline, .loading-line { opacity:1; transform:none; }
        }
      `}</style>
    </div>
  );
}
