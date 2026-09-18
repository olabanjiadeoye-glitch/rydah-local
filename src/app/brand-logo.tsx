type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/rydah-icon.svg"
        alt=""
        aria-hidden="true"
        className={compact ? "h-8 w-8 shrink-0 rounded-lg" : "h-10 w-10 shrink-0 rounded-xl"}
      />
      <span className="leading-none">
        <span className={`block font-black tracking-[0.08em] text-white ${compact ? "text-sm" : "text-base"}`}>RYDAH</span>
        <span className={`mt-1 block font-black tracking-[0.22em] text-[#D4AF37] ${compact ? "text-[8px]" : "text-[9px]"}`}>LOCAL</span>
      </span>
    </span>
  );
}
