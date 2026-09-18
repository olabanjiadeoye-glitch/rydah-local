"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getStoredSession, invokeFunction, restGet, restRpc, type AuthSession } from "@/lib/supabase";

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
  providers: {
    business_name: string;
    is_verified: boolean;
    biometric_verified: boolean;
  } | null;
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

async function callArrivalFaceBackend(session: AuthSession, jobId: string, faceImage: string) {
  const response = await invokeFunction(
    "arrival-face-verification",
    {
      action: "verify_arrival_face",
      job_id: jobId,
      face_image: faceImage,
      consent: true,
    },
    session.access_token,
  );

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
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [cameraJobId, setCameraJobId] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(currentSession);
    void load(currentSession);

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraJobId || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setCameraError("The camera opened but the preview could not start. Close it and try again.");
    });
  }, [cameraJobId]);

  async function load(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const rows = await restGet<JobRow[]>(
        "jobs?select=id,provider_id,service_category,location,status,quote_status,arrival_verified_at,arrival_face_verified_at,arrival_face_result,providers(business_name,is_verified,biometric_verified)&status=eq.accepted&quote_status=eq.accepted&order=created_at.desc",
        currentSession.access_token,
      );
      setJobs(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load arrival checks.");
    } finally {
      setLoading(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraJobId("");
  }

  async function startCamera(job: JobRow, facing: "user" | "environment" = cameraFacing) {
    setError("");
    setMessage("");
    setCameraError("");

    if (!job.providers?.biometric_verified) {
      setError("This provider has not completed biometric enrolment, so camera matching is not available.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera access is not supported in this browser. Open Rydah in Chrome or the Rydah Android app.");
      return;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      setCameraFacing(facing);
      setCameraJobId(job.id);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Camera permission was blocked. Allow camera access for Rydah, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraError("No suitable front camera was found on this device.");
      } else {
        setCameraError("Unable to open the camera. Check camera permission and try again.");
      }
    }
  }

  async function flipCamera(job: JobRow) {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    await startCamera(job, nextFacing);
  }

  function captureFace(job: JobRow) {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraError("The camera is not ready yet. Wait a moment and try Capture again.");
      return;
    }

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture the camera image. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const image = canvas.toDataURL("image/jpeg", 0.84);
    setCapturedImages((current) => ({ ...current, [job.id]: image }));
    setCameraError("");
    stopCamera();
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
    const image = capturedImages[job.id];
    if (!image) {
      setError("Open the camera and capture the provider first.");
      return;
    }
    if (!consents[job.id]) {
      setError("The provider must confirm consent to the camera face match.");
      return;
    }

    setBusyJobId(job.id);
    setError("");
    setMessage("Comparing this fresh camera image with the provider's verified Rydah identity…");

    try {
      const result = await callArrivalFaceBackend(session, job.id, image);
      setMessage(result.result_text || "Provider camera face match completed.");
      setCapturedImages((current) => {
        const next = { ...current };
        delete next[job.id];
        return next;
      });
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
          <Link href="/my-jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">My Jobs</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-6 sm:py-8">
        <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-6">
          <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">BEFORE WORK STARTS</p>
          <h2 className="mt-2 text-3xl font-black">Confirm the right provider arrived</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
            First verify the one-time Arrival PIN. Then, for biometrically enrolled providers, open your phone camera and capture a fresh face image while the provider is physically present. Rydah compares it with that provider&apos;s verified identity.
          </p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading arrival checks…</div>
        ) : jobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">
            <h3 className="text-xl font-black">No arrival check is needed right now</h3>
            <p className="mt-2 text-zinc-400">A job will appear here after the provider has accepted it and you have accepted the quote.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {jobs.map((job) => {
              const busy = busyJobId === job.id;
              const pin = pins[job.id] || "";
              const providerName = job.providers?.business_name || "Assigned provider";
              const biometricReady = Boolean(job.providers?.biometric_verified);
              const image = capturedImages[job.id] || "";
              const cameraOpen = cameraJobId === job.id;

              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black">{providerName}</h3>
                        {biometricReady ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">✓ BIOMETRIC VERIFIED</span>
                        ) : job.providers?.is_verified ? (
                          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-300">ID REVIEWED • BIOMETRIC REQUIRED</span>
                        ) : null}
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
                    <p className="text-sm font-black text-[#D4AF37]">2. LIVE CAMERA FACE MATCH</p>

                    {job.arrival_face_verified_at ? (
                      <>
                        <p className="mt-3 font-bold text-emerald-300">✓ Provider face matched</p>
                        {job.arrival_face_result && <p className="mt-2 text-sm text-zinc-400">{job.arrival_face_result}</p>}
                      </>
                    ) : !job.arrival_verified_at ? (
                      <p className="mt-2 text-sm text-zinc-500">Complete the Arrival PIN first. The camera check unlocks afterwards.</p>
                    ) : !biometricReady ? (
                      <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="font-bold text-amber-200">Camera match unavailable</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">This provider has not completed Rydah biometric enrolment. Work should remain blocked until the provider completes the required verification.</p>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          Ask the provider to face the phone in good light with glasses, masks or hats removed where practical. Open the front camera and capture a fresh image while the provider is physically present.
                        </p>

                        {cameraOpen && (
                          <div className="mt-4 overflow-hidden rounded-3xl border border-[#D4AF37]/30 bg-black">
                            <div className="relative aspect-[3/4] w-full">
                              <video
                                ref={videoRef}
                                muted
                                playsInline
                                autoPlay
                                className={`h-full w-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                              />
                              <div className="pointer-events-none absolute inset-6 rounded-[42%] border-2 border-[#D4AF37]/70" />
                              <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-bold text-white drop-shadow">
                                Centre the provider&apos;s face inside the guide
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 p-4">
                              <button
                                type="button"
                                onClick={() => captureFace(job)}
                                className="rounded-xl bg-[#D4AF37] px-3 py-3 text-sm font-black text-black"
                              >
                                Capture
                              </button>
                              <button
                                type="button"
                                onClick={() => void flipCamera(job)}
                                className="rounded-xl border border-[#D4AF37]/30 px-3 py-3 text-sm font-bold text-[#E5C65A]"
                              >
                                Flip Camera
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="rounded-xl border border-white/15 px-3 py-3 text-sm font-bold text-zinc-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {cameraError && (
                          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
                            {cameraError}
                          </div>
                        )}

                        {image ? (
                          <div className="mt-4">
                            <p className="text-sm font-bold">Fresh camera capture</p>
                            <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black">
                              <Image src={image} alt="Fresh provider camera capture" width={1200} height={900} unoptimized className="max-h-[360px] w-full object-contain" />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCapturedImages((current) => {
                                  const next = { ...current };
                                  delete next[job.id];
                                  return next;
                                });
                                void startCamera(job);
                              }}
                              className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-300"
                            >
                              Retake Photo
                            </button>
                          </div>
                        ) : !cameraOpen ? (
                          <button
                            type="button"
                            onClick={() => void startCamera(job)}
                            className="mt-4 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black"
                          >
                            Open Front Camera
                          </button>
                        ) : null}

                        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            checked={Boolean(consents[job.id])}
                            onChange={(event) => setConsents((current) => ({ ...current, [job.id]: event.target.checked }))}
                            className="mt-1"
                          />
                          <span>Provider: I consent to this fresh camera image being used only to compare me with my verified Rydah identity for this job arrival.</span>
                        </label>

                        <button
                          disabled={busy || !image || !consents[job.id]}
                          onClick={() => void verifyFace(job)}
                          className="mt-4 w-full rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-40"
                        >
                          {busy ? "Checking…" : "Verify Provider Face"}
                        </button>

                        <p className="mt-3 text-xs leading-5 text-zinc-500">
                          Rydah sends this capture securely for comparison and stores the match result and audit details, not the camera image itself. This check is an additional safety control and does not replace normal judgment.
                        </p>
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
