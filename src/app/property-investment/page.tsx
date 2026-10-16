import Link from "next/link";

export const metadata = {
  title: "Property Investment | Rydah Local",
  description: "Property Investment is coming soon to Rydah Local.",
};

export default function PropertyInvestmentPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-5 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-[#D4AF37]/50 bg-gradient-to-b from-[#211b0c] to-black p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,.45)]">
        <div className="mb-6 text-sm font-black uppercase tracking-[0.3em] text-[#E9C34F]">Rydah Local</div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">Welcome to Property Investment</h1>
        <p className="mt-7 text-3xl font-black tracking-wide text-[#F0C84E] sm:text-4xl">COMING SOON!!!</p>
        <Link href="/" className="mt-9 inline-flex rounded-xl border border-[#D4AF37]/60 px-6 py-3 font-bold text-[#F0C84E] transition hover:bg-[#D4AF37]/10">Back to Home</Link>
      </section>
    </main>
  );
}
