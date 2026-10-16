"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const skylineImage = "https://images.unsplash.com/photo-1691743441282-72dbe8f91dcc?auto=format&fit=crop&fm=jpg&q=72&w=1200";
const rydahTaxiUrl = "https://rydahtaxi.com";

const entryServices = [
  { label: "Home Services", icon: "wrench", href: "/providers?group=home" },
  { label: "Vehicle Services", icon: "car", href: rydahTaxiUrl },
  { label: "Property Investment", icon: "home", href: "/property-investment" },
] as const;

function ServiceIcon({ icon }: { icon: (typeof entryServices)[number]["icon"] }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (icon === "wrench") {
    return <svg {...common}><path d="M14.7 6.3a4.2 4.2 0 0 0-5.5 5.5L3 18l3 3 6.2-6.2a4.2 4.2 0 0 0 5.5-5.5l-2.5 2.5-3-3 2.5-2.5Z" /></svg>;
  }
  if (icon === "car") {
    return <svg {...common}><path d="M5 17h14l1-6-2-4H6l-2 4 1 6Z" /><path d="M7 17v2M17 17v2M7.5 13h.01M16.5 13h.01M6 7l1-2h10l1 2" /></svg>;
  }
  if (icon === "home") {
    return <svg {...common}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></svg>;
  }
  return <svg {...common}><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2" /></svg>;
}

export default function HomeWelcome() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [activeIndicator, setActiveIndicator] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function enterRydah() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 260);
  }

  function signIn() {
    router.push("/sign-in");
  }

  function openService(href: string) {
    if (href.startsWith("https://")) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  }

  useEffect(() => {
    if (!visible) document.body.style.overflow = "";
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setActiveIndicator((current) => (current + 1) % 3);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <section
      className={`fixed inset-0 z-[300] overflow-y-auto bg-black text-white transition-opacity duration-300 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      aria-label="Welcome to Rydah Local"
    >
      <div className="relative min-h-[100svh] overflow-hidden">
        <a
          href={rydahTaxiUrl}
          aria-label="Open RydahTaxi"
          className="rydah-taxi-3d fixed right-4 top-[34%] z-[320] flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-2 border-[#F6D85F] bg-gradient-to-br from-[#302815]/95 via-[#080808]/95 to-black text-[#FFE27A] shadow-[inset_0_2px_0_rgba(255,255,255,.24),inset_0_-6px_10px_rgba(0,0,0,.7),0_9px_0_#725207,0_14px_24px_rgba(0,0,0,.68),0_0_28px_rgba(246,216,95,.55)] backdrop-blur-md transition active:translate-y-1"
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 17h14l1-6-2-4H6l-2 4 1 6Z" />
            <path d="M7 17v2M17 17v2M7.5 13h.01M16.5 13h.01M6 7l1-2h10l1 2" />
          </svg>
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.1em]">Taxi</span>
        </a>
        <style jsx>{`
          .rydah-taxi-3d {
            transform: perspective(280px) rotateY(-7deg) rotateX(3deg);
            transform-origin: center;
            animation: rydahTaxiBlink 1.7s ease-in-out infinite;
          }
          @keyframes rydahTaxiBlink {
            0%, 100% { filter: brightness(1); box-shadow: inset 0 2px 0 rgba(255,255,255,.24), inset 0 -6px 10px rgba(0,0,0,.7), 0 9px 0 #725207, 0 14px 24px rgba(0,0,0,.68), 0 0 20px rgba(246,216,95,.42); }
            50% { filter: brightness(1.28); box-shadow: inset 0 2px 0 rgba(255,255,255,.34), inset 0 -6px 10px rgba(0,0,0,.62), 0 9px 0 #8b6508, 0 16px 28px rgba(0,0,0,.72), 0 0 40px rgba(255,221,93,.92); }
          }
          @media (prefers-reduced-motion: reduce) { .rydah-taxi-3d { animation: none; } }
        `}</style>
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center"
          style={{ backgroundImage: `url('${skylineImage}')` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/95" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.18),transparent_34%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden="true" />

        {/* Decorative Nigerian-flag parachute; never blocks taps or navigation. */}
        <div className="rydah-parachute pointer-events-none absolute left-[3%] top-0 z-[1] w-[62px] opacity-0 sm:w-[76px]" aria-hidden="true">
          <svg viewBox="0 0 120 148" width="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rydah-green-canopy" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#39D77C" /><stop offset=".5" stopColor="#008751" /><stop offset="1" stopColor="#00482C" /></linearGradient>
              <linearGradient id="rydah-white-canopy" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFFFFF" /><stop offset=".55" stopColor="#E9F1ED" /><stop offset="1" stopColor="#9CAEA5" /></linearGradient>
              <clipPath id="rydah-parachute-canopy"><path d="M6 57C7 24 29 7 60 7s53 17 54 50c-15-8-24-8-36 0-12-8-24-8-36 0-12-8-22-8-36 0Z" /></clipPath>
            </defs>
            <g clipPath="url(#rydah-parachute-canopy)">
              <path fill="url(#rydah-green-canopy)" d="M0 0h40v66H0z" />
              <path fill="url(#rydah-white-canopy)" d="M40 0h40v66H40z" />
              <path fill="url(#rydah-green-canopy)" d="M80 0h40v66H80z" />
            </g>
            <path d="M6 57C7 24 29 7 60 7s53 17 54 50c-15-8-24-8-36 0-12-8-24-8-36 0-12-8-22-8-36 0Z" stroke="#E7F6E8" strokeWidth="2.5" />
            <path d="M6 57 43 116M42 57l9 59M78 57l-9 59M114 57l-37 59" stroke="#F5F5F5" strokeWidth="1.8" />
            {/* Worker in PPE suspended beneath the parachute */}
            <path d="M50 105q10-9 20 0v5H50z" fill="#F2C94C" stroke="#493914" strokeWidth="1.5" />
            <path d="M54 103v-3q6-7 12 0v3" fill="#F2C94C" stroke="#493914" strokeWidth="1.3" />
            <circle cx="60" cy="112" r="5.2" fill="#B97B51" />
            <path d="M52 118h16l3 15H49z" fill="#F3B92C" stroke="#FCE58A" strokeWidth="1.5" />
            <path d="M56 118v14M64 118v14" stroke="#D9E3E9" strokeWidth="2.4" />
            <path d="M50 122l-6 10M70 122l6 10" stroke="#F3B92C" strokeWidth="4" strokeLinecap="round" />
            <path d="M55 133l-3 11M65 133l3 11" stroke="#263443" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M48 145h8M64 145h8" stroke="#15191F" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <style jsx>{`
          .rydah-parachute {
            animation: rydahParachuteDescent 11s linear infinite;
            transform-style: preserve-3d;
            filter: drop-shadow(5px 9px 9px rgba(0,0,0,.55)) drop-shadow(-2px -2px 3px rgba(255,255,255,.3));
          }
          @keyframes rydahParachuteDescent {
            0% { opacity: 0; transform: perspective(460px) translate3d(-18px,-170px,0) rotateY(-22deg) rotateZ(-9deg); }
            5% { opacity: .95; }
            25% { transform: perspective(460px) translate3d(18px,20vh,16px) rotateY(18deg) rotateZ(7deg); }
            50% { transform: perspective(460px) translate3d(-8px,49vh,28px) rotateY(-15deg) rotateZ(-6deg); }
            75% { opacity: .95; transform: perspective(460px) translate3d(24px,78vh,12px) rotateY(14deg) rotateZ(6deg); }
            96% { opacity: .95; }
            100% { opacity: 0; transform: perspective(460px) translate3d(-8px,115vh,0) rotateY(-20deg) rotateZ(-8deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .rydah-parachute { animation: none; display: none; }
          }
        `}</style>
        <div className="relative mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(26px,env(safe-area-inset-top))]">
          <div className="flex flex-1 flex-col items-center justify-between gap-5">
            <div className="w-full text-center">
              <div className="mx-auto w-[128px] sm:w-[144px]">
                <div className="rounded-[2rem] border border-[#F3D56B]/60 bg-black/75 p-2 shadow-[0_0_32px_rgba(212,175,55,0.30)] backdrop-blur-sm">
                  <Image src="/rydah-icon.svg" alt="Rydah Local" width={144} height={144} priority unoptimized className="h-auto w-full rounded-[1.55rem]" />
                </div>
              </div>

              <div className="mt-3">
                <p className="bg-gradient-to-b from-[#FFF1A8] via-[#E3B43E] to-[#A36A08] bg-clip-text text-5xl font-black leading-none tracking-[0.04em] text-transparent drop-shadow-[0_2px_10px_rgba(212,175,55,0.25)]">RYDAH</p>
                <p className="mt-1 text-xl font-semibold tracking-[0.42em] text-[#F1D477]">LOCAL</p>
              </div>

              <p className="mx-auto mt-4 max-w-[300px] text-xs font-bold uppercase leading-5 tracking-[0.18em] text-zinc-100">
                Local work. Real people.<br />Brighter tomorrows.
              </p>
            </div>

            <div className="w-full">
              <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.17em] text-[#EBC956]">
                <span>📍 Nigeria</span>
                <span>5 planned cities</span>
              </div>

              <div className="rounded-[2rem] border border-[#D4AF37]/25 bg-black/72 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <h1 className="mx-auto max-w-[310px] text-center text-2xl font-black leading-tight sm:text-[1.7rem]">
                  Find trusted local service providers in your city
                </h1>

                <button
                  type="button"
                  onClick={enterRydah}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#D9A918] via-[#F4CE55] to-[#E5B933] px-5 py-4 text-base font-black text-black shadow-[0_12px_30px_rgba(212,175,55,0.24)] transition active:scale-[0.99]"
                >
                  Get Started <span aria-hidden="true" className="text-2xl leading-none">→</span>
                </button>

                <button
                  type="button"
                  onClick={signIn}
                  className="mt-3 w-full rounded-2xl border border-[#D4AF37]/65 bg-black/45 px-5 py-3.5 text-base font-black text-white transition hover:bg-white/5 active:scale-[0.99]"
                >
                  Sign In
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {entryServices.map((service) => (
                  <button
                    key={service.label}
                    type="button"
                    onClick={() => openService(service.href)}
                    className="min-w-0 rounded-xl px-1 py-1.5 transition hover:bg-white/5 active:scale-95"
                    aria-label={`Open ${service.label}`}
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center text-[#EAC64C]">
                      <ServiceIcon icon={service.icon} />
                    </div>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-zinc-100 sm:text-[11px]">{service.label}</p>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                      activeIndicator === index
                        ? "w-8 bg-[#E5B93A] shadow-[0_0_12px_rgba(229,185,58,0.45)]"
                        : "w-6 bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
