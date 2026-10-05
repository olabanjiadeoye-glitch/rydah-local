"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const skylineImage = "https://images.unsplash.com/photo-1691743441282-72dbe8f91dcc?auto=format&fit=crop&fm=jpg&q=72&w=1200";
const rydahTaxiUrl = "https://rydal-taxi.well-chick-6808.chatgpt.site";

const entryServices = [
  { label: "Home Services", icon: "wrench", href: "/providers?group=home" },
  { label: "Vehicle Services", icon: "car", href: "/providers?group=vehicle" },
  { label: "Property Care", icon: "home", href: "/providers?group=property" },
  { label: "and More…", icon: "briefcase", href: "/providers" },
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
          className="fixed right-4 top-[34%] z-[320] flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-[#F2D368]/70 bg-black/85 text-[#F2D368] shadow-[0_0_0_1px_rgba(212,175,55,0.18),0_10px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(212,175,55,0.26)] backdrop-blur-md transition hover:scale-105 active:scale-95 motion-safe:animate-[pulse_2.8s_ease-in-out_infinite]"
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 17h14l1-6-2-4H6l-2 4 1 6Z" />
            <path d="M7 17v2M17 17v2M7.5 13h.01M16.5 13h.01M6 7l1-2h10l1 2" />
          </svg>
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em]">Taxi</span>
        </a>
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center"
          style={{ backgroundImage: `url('${skylineImage}')` }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] overflow-hidden" aria-hidden="true">
          <div className="rydah-river absolute inset-0" />
          <div className="rydah-river-glints absolute inset-0" />
          <div className="rydah-boat-track absolute inset-x-0 top-[36%] h-12">
            <div className="rydah-boat">
              <span className="rydah-wake" />
              <svg width="54" height="24" viewBox="0 0 108 48" fill="none" aria-hidden="true">
                <path d="M18 25h77l-9 13H31c-8 0-13-5-13-13Z" fill="#171717" stroke="#E5B93A" strokeWidth="2"/>
                <path d="M39 24V12h29l10 12" fill="#242424" stroke="#E5B93A" strokeWidth="2"/>
                <path d="M49 12V5h8v7M62 12V7h6v5" stroke="#E5B93A" strokeWidth="2"/>
                <path d="M45 18h10M60 18h10" stroke="#F6DE82" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </div>
        <style jsx>{`
          .rydah-river {
            background:
              linear-gradient(to bottom, rgba(4,8,10,.03), rgba(2,6,9,.24)),
              repeating-linear-gradient(178deg, transparent 0 22px, rgba(255,255,255,.055) 23px, transparent 25px 48px);
            background-size:100% 100%, 240px 96px;
            animation: rydahCurrent 12s ease-in-out infinite alternate;
            will-change:background-position;
          }
          .rydah-river-glints {
            background: radial-gradient(ellipse at 48% 32%, rgba(246,222,130,.11), transparent 42%);
            animation: rydahGlints 6s ease-in-out infinite alternate;
          }
          .rydah-boat { position:absolute; left:0; display:flex; align-items:center; filter:drop-shadow(0 4px 5px rgba(0,0,0,.6)); animation: rydahBoat 11s linear infinite; will-change:transform; }
          .rydah-wake { position:absolute; right:43px; top:27px; width:92px; height:9px; border-top:1px solid rgba(255,255,255,.32); border-radius:50%; filter:blur(.7px); animation: rydahWake 1.6s ease-in-out infinite alternate; }
          @keyframes rydahCurrent { from { background-position:0 0, -45px 0; } to { background-position:0 0, 45px 8px; } }
          @keyframes rydahGlints { from { opacity:.28; transform:translateY(1px); } to { opacity:.48; transform:translateY(-2px); } }
          @keyframes rydahBoat {
            0% { transform:translate3d(-140px,3px,0) rotate(-1deg); }
            25% { transform:translate3d(calc(25vw - 35px),0,0) rotate(.6deg); }
            50% { transform:translate3d(calc(50vw - 10px),3px,0) rotate(-.5deg); }
            75% { transform:translate3d(calc(75vw + 20px),0,0) rotate(.5deg); }
            100% { transform:translate3d(calc(100vw + 90px),2px,0) rotate(-1deg); }
          }
          @keyframes rydahWake { from { opacity:.18; transform:skewX(-24deg) scaleX(.75); } to { opacity:.42; transform:skewX(-24deg) scaleX(1.08); } }
          @media (prefers-reduced-motion: reduce) {
            .rydah-river,.rydah-river-glints,.rydah-boat,.rydah-wake { animation:none !important; }
            .rydah-boat { transform:translate3d(42vw,0,0); }
          }
        `}</style>
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/95" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.18),transparent_34%)]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden="true" />

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
                <span>5 launch cities</span>
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

              <div className="mt-5 grid grid-cols-4 gap-2 text-center">
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
