"use client";

import { useEffect, useState } from "react";
import { getStoredSession, restGet, restRpc, type AuthSession, invokeFunction } from "@/lib/supabase";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  status: string;
  quote_status: string;
  arrival_verified_at: string | null;
  arrival_face_verified_at: string | null;
  arrival_face_result: string | null;
  providers: { business_name: string; is_verified: boolean } | null;
};

type FaceResult = {
  ok?: boolean;
  status?: "verified" | "failed";
  confidence?: number | null;
  result_text?: string;
  provider_name?: string;
  code?: string;
  error?: string;
};

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the camera image."));
    reader.readAsDataURL(file);
  });
}

async function callArrivalFaceBackend(session: AuthSession, jobId: string, faceImage: string) {
  const response = await invokeFunction("arrival-face-verification", { action: "verify_arrival_face", job_id: jobId, face_image: faceImage, consent: true }, session.access_token);

  const result = (await response.json().catch(() => ({}))) as FaceResult;
  if (!response.ok) throw new Error(result.error || "Unable to verify the provider camera image.");
  return result;
}

export default function ArrivalCheckPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState("");
  const [pins, setPins] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(currentSession);
    void load(currentSession);
  }, []);

  async function load(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const rows = await restGet<JobRow[]>(
        `jobs?select=id,provider_id,service_category,location,status,quote_status,arrival_verified_at,arrival_face_verified_at,arrival_face_result,providers(business_name,is_verified)&status=eq.accepted&quote_status=eq.accepted&order=created_at.desc`,
        currentSession.access_token,
      );
      setJobs(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load arrival checks.");
    } finally {
      setLoading(false);
    }
  }

  async function issuePin(job: JobRow) {
    if (!session) return;
    setBusyJobId(job.id);
    setError("");
    setMessage("");
    try {
      const pin = await restRpc<string>("issue_arrival_code", { p_job_id: job.id }, session.access_token);
      setPins((current) => ({ ...current, [job.id]: pin }));
      setMessage("Arrival PIN created. Only show it to the assigned provider who is physically with you. It expires in 30 minutes.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the Arrival PIN.");
    } finally {
      setBusyJobId("");
    }
  }

  async function verifyFace(job: JobRow) {
    if (!session) return;
    const photo = photos[job.id];
    if (!photo) {
      setError("Take a clear camera photo of the provider first.");
      return;
    }
    if (!consents[job.id]) {
      setError("The provider must confirm consent to the camera face match.");
      return;
    }

    setBusyJobId(job.id);
    setError("");
    setMessage("Comparing the camera image with the provider's verified Rydah identity…");
    try {
      const image = await fileToDataUrl(photo);
      const result = await callArrivalFaceBackend(session, job.id, image);
      setMessage(result.result_text || "Provider camera face match completed.");
      setPhotos((current) => ({ ...current, [job.id]: null }));
      setConsents((current) => ({ ...current, [job.id]: false }));
      await load(session);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to complete the camera face match.");
      await load(session);
    } finally {
      setBusyJobId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Arrival Safety Check</h1>
          </div>
          <a href="/my-jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">My Jobs</a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-6">
          <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">BEFORE WORK STARTS</p>
          <h2 className="mt-2 text-3xl font-black">Confirm the right provider arrived</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Use the one-time Arrival PIN first. For providers enrolled in Rydah biometric verification, you can then use your phone camera to compare the person at your door with the provider's verified identity.</p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading arrival checks…</div>
        ) : jobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-7">
            <h3 className="text-xl font-black">No arrival check is needed right now</h3>
            <p className="mt-2 text-zinc-400">A job will appear here after the provider has accepted it and you have accepted the quote.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {jobs.map((job) => {
              const busy = busyJobId === job.id;
              const pin = pins[job.id] || "";
              const providerName = job.providers?.business_name || "Assigned provider";
              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black">{providerName}</h3>
                        {job.providers?.is_verified && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">✓ RYDAH VERIFIED</span>}
                      </div>
                      <p className="mt-2 text-zinc-400">{job.service_category} • {job.location}</p>
                    </div>
                    <span className="rounded-full bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#D4AF37]">ARRIVAL CHECK</span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                    <p className="text-sm font-black text-[#D4AF37]">1. ONE-TIME ARRIVAL PIN</p>
                    {job.arrival_verified_at ? (
                      <p className="mt-3 font-bold text-emerald-300">✓ Arrival PIN verified</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">Generate this only when the provider is physically with you. The provider enters it on their own Rydah dashboard.</p>
                        <button disabled={busy} onClick={() => void issuePin(job)} className="mt-4 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">{pin ? "Generate New PIN" : "Generate Arrival PIN"}</button>
                        {pin && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
                            <p className="text-xs font-black tracking-[0.2em] text-zinc-500">SHOW THIS TO THE PROVIDER</p>
                            <p className="mt-2 text-4xl font-black tracking-[0.25em] text-[#D4AF37]">{pin}</p>
                            <p className="mt-3 text-xs text-zinc-500">Expires in 30 minutes. Do not send it before the provider arrives.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                    <p className="text-sm font-black text-[#D4AF37]">2. CAMERA FACE MATCH</p>
                    {job.arrival_face_verified_at ? (
                      <>
                        <p className="mt-3 font-bold text-emerald-300">✓ Provider face matched</p>
                        {job.arrival_face_result && <p className="mt-2 text-sm text-zinc-400">{job.arrival_face_result}</p>}
                      </>
                    ) : !job.arrival_verified_at ? (
                      <p className="mt-2 text-sm text-zinc-500">Complete the Arrival PIN first. The camera check unlocks afterwards.</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">Hand the phone to the provider and take a clear front-facing camera image. Rydah sends it securely for comparison with the provider's verified reference. Rydah stores the match result, not this camera image.</p>
                        <label className="mt-4 block">
                          <span className="text-sm font-bold">Provider camera image</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(event) => setPhotos((current) => ({ ...current, [job.id]: event.target.files?.[0] ?? null }))} className="mt-2 block w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-sm text-zinc-300" />
                        </label>
                        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300">
                          <input type="checkbox" checked={Boolean(consents[job.id])} onChange={(event) => setConsents((current) => ({ ...current, [job.id]: event.target.checked }))} className="mt-1" />
                          <span>Provider: I consent to this camera image being used only to compare me with my verified Rydah identity for this job arrival.</span>
                        </label>
                        <button disabled={busy || !photos[job.id] || !consents[job.id]} onClick={() => void verifyFace(job)} className="mt-4 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-40">{busy ? "Checking…" : "Verify Provider Face"}</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}