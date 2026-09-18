"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getStoredSession,
  restGet,
  restInsert,
  restPatch,
  type AuthSession,
} from "@/lib/supabase";

type ProviderRow = {
  id: string;
  business_name: string;
  service_category: string;
  location: string;
  is_verified: boolean;
};

type BiometricStatus = "not_started" | "pending" | "verified" | "failed" | "review_required";

type VerificationRow = {
  id: string;
  provider_id: string;
  legal_name: string;
  phone: string;
  years_experience: number;
  service_address: string;
  id_type: "NIN" | "Drivers Licence" | "International Passport" | "Voters Card";
  id_last4: string;
  status: "draft" | "pending" | "approved" | "rejected";
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  biometric_status: BiometricStatus;
  biometric_provider: string | null;
  biometric_result_text: string | null;
  biometric_verified_at: string | null;
};

type IdentityResponse = {
  ok?: boolean;
  status?: BiometricStatus;
  result_text?: string;
  error?: string;
  setup_required?: boolean;
  environment?: string;
  configured?: boolean;
  liveness_configured?: boolean;
  public_merchant_id_configured?: boolean;
  session_id?: string;
  session_token?: string;
};

const idTypes: VerificationRow["id_type"][] = [
  "NIN",
  "Drivers Licence",
  "International Passport",
  "Voters Card",
];

function statusStyle(status: VerificationRow["status"]) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-400";
  if (status === "rejected") return "bg-red-500/15 text-red-300";
  if (status === "pending") return "bg-[#D4AF37]/15 text-[#D4AF37]";
  return "bg-zinc-800 text-zinc-400";
}

function biometricStyle(status: BiometricStatus) {
  if (status === "verified") return "bg-emerald-500/15 text-emerald-400";
  if (status === "failed") return "bg-red-500/15 text-red-300";
  if (status === "pending" || status === "review_required") return "bg-[#D4AF37]/15 text-[#D4AF37]";
  return "bg-zinc-800 text-zinc-400";
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selfie image."));
    reader.readAsDataURL(file);
  });
}

async function callIdentityBackend(session: AuthSession, payload: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!supabaseUrl || !publishableKey) throw new Error("Identity verification service is not configured.");

  const response = await fetch(`${supabaseUrl}/functions/v1/identity-verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as IdentityResponse;
  if (!response.ok) throw new Error(result.error || "Unable to complete face verification.");
  return result;
}

export default function ProviderOnboardingPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [verification, setVerification] = useState<VerificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faceSaving, setFaceSaving] = useState(false);
  const [liveFaceSaving, setLiveFaceSaving] = useState(false);
  const [identityEnvironment, setIdentityEnvironment] = useState("sandbox");
  const [livenessConfigured, setLivenessConfigured] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsExperience, setYearsExperience] = useState("1");
  const [serviceAddress, setServiceAddress] = useState("");
  const [idType, setIdType] = useState<VerificationRow["id_type"]>("NIN");
  const [idLast4, setIdLast4] = useState("");
  const [fullIdNumber, setFullIdNumber] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [faceConsent, setFaceConsent] = useState(false);

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
      const providerRows = await restGet<ProviderRow[]>(
        `providers?user_id=eq.${currentSession.user.id}&select=id,business_name,service_category,location,is_verified&limit=1`,
        currentSession.access_token,
      );
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);

      if (!currentProvider) {
        setVerification(null);
        return;
      }

      const verificationRows = await restGet<VerificationRow[]>(
        `provider_verifications?provider_id=eq.${currentProvider.id}&select=*&limit=1`,
        currentSession.access_token,
      );
      const currentVerification = verificationRows[0] ?? null;
      setVerification(currentVerification);

      const identityStatus = await callIdentityBackend(currentSession, { action: "status" }).catch(() => null);
      if (identityStatus) {
        setIdentityEnvironment(identityStatus.environment || "sandbox");
        setLivenessConfigured(Boolean(identityStatus.liveness_configured));
      }

      if (currentVerification) {
        setLegalName(currentVerification.legal_name);
        setPhone(currentVerification.phone);
        setYearsExperience(String(currentVerification.years_experience));
        setServiceAddress(currentVerification.service_address);
        setIdType(currentVerification.id_type);
        setIdLast4(currentVerification.id_last4);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load verification details.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !provider) return;

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      provider_id: provider.id,
      legal_name: legalName.trim(),
      phone: phone.trim(),
      years_experience: Number(yearsExperience),
      service_address: serviceAddress.trim(),
      id_type: idType,
      id_last4: idLast4.trim().toUpperCase(),
      status: "pending" as const,
      submitted_at: new Date().toISOString(),
    };

    try {
      let rows: VerificationRow[];
      if (verification) {
        rows = await restPatch<VerificationRow[]>(
          "provider_verifications",
          `id=eq.${verification.id}`,
          payload,
          session.access_token,
        );
      } else {
        rows = await restInsert<VerificationRow[]>(
          "provider_verifications",
          payload,
          session.access_token,
        );
      }

      const updated = rows[0];
      if (!updated) throw new Error("Verification submission was not returned by the backend.");
      setVerification(updated);
      setMessage("Identity details submitted. Complete Face & ID Match below before admin approval.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit verification.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyFaceAndId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !verification) return;
    const sandboxTestNin = verification.id_type === "NIN" && fullIdNumber.replace(/\s+/g, "").trim() === "11111111111";
    if (!selfie && !sandboxTestNin) {
      setError("Take or choose a clear selfie first.");
      return;
    }
    if (!faceConsent) {
      setError("You must consent to the face and ID check before continuing.");
      return;
    }

    setFaceSaving(true);
    setError("");
    setMessage("Checking your face against your ID record…");

    try {
      const selfieData = selfie ? await fileToDataUrl(selfie) : "";
      const result = await callIdentityBackend(session, {
        action: "verify_face_id",
        id_number: fullIdNumber,
        selfie: selfieData,
        use_sandbox_sample: sandboxTestNin,
        consent: true,
      });
      setMessage(result.result_text || "Face and ID verification completed.");
      setFullIdNumber("");
      setSelfie(null);
      setFaceConsent(false);
      await load(session);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to complete face and ID verification.");
      await load(session);
    } finally {
      setFaceSaving(false);
    }
  }

  async function completeLiveFaceVerification(livenessSessionId: string) {
    if (!session) return;
    try {
      setMessage("Live presence confirmed. Matching the live face with the identity record…");
      const result = await callIdentityBackend(session, {
        action: "complete_live_verification",
        id_number: fullIdNumber,
        session_id: livenessSessionId,
        consent: true,
      });
      setMessage(result.result_text || "Live face and identity verification completed.");
      setFullIdNumber("");
      setSelfie(null);
      setFaceConsent(false);
      await load(session);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to complete live face verification.");
      await load(session);
    } finally {
      setLiveFaceSaving(false);
    }
  }

  function setImmersiveVerification(active: boolean) {
    window.dispatchEvent(new CustomEvent("rydah:immersive-verification", { detail: { active } }));
  }

  async function startLiveFaceVerification() {
    if (!session || !verification) return;
    if (!fullIdNumber.trim()) {
      setError("Enter the full ID number for this verification only.");
      return;
    }
    if (!faceConsent) {
      setError("You must consent to the live face and ID check before continuing.");
      return;
    }

    setLiveFaceSaving(true);
    setImmersiveVerification(true);
    setError("");
    setMessage("Preparing secure live camera verification…");

    try {
      const credentials = await callIdentityBackend(session, { action: "liveness_session" });
      if (!credentials.session_id || !credentials.session_token) {
        throw new Error("Live verification session could not be created.");
      }

      const module = await import("youverify-liveness-web");
      const YouverifyLiveness = module.default;
      const [firstName, ...rest] = verification.legal_name.trim().split(/\s+/);
      const livenessSessionId = credentials.session_id;

      const yvLiveness = new YouverifyLiveness({
        presentation: "modal",
        sessionId: credentials.session_id,
        sessionToken: credentials.session_token,
        entityId: provider?.id,
        sandboxEnvironment: (credentials.environment || identityEnvironment) !== "live",
        tasks: [
          { id: "motions", difficulty: "medium", maxNods: 2, maxBlinks: 2, timeout: 30000 },
          { id: "complete-the-circle", difficulty: "medium", timeout: 30000 },
        ],
        user: {
          firstName: firstName || "Provider",
          lastName: rest.join(" ") || undefined,
        },
        branding: {
          name: "Rydah",
          color: "#D4AF37",
          hideLogoOnMobile: true,
          showPoweredBy: true,
        },
        allowAudio: true,
        onSuccess: () => {
          setImmersiveVerification(false);
          window.setTimeout(() => {
            void completeLiveFaceVerification(livenessSessionId);
          }, 1200);
        },
        onFailure: (data: any) => {
          const detail = data?.error?.message || data?.error?.key || "Live face check failed. Please try again.";
          setImmersiveVerification(false);
          setMessage("");
          setError(String(detail));
          setLiveFaceSaving(false);
        },
        onClose: () => {
          setImmersiveVerification(false);
          window.setTimeout(() => {
            void completeLiveFaceVerification(livenessSessionId);
          }, 1500);
        },
      });

      yvLiveness.start();
    } catch (caught) {
      setImmersiveVerification(false);
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to start live face verification.");
      setLiveFaceSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading verification...</main>;
  }

  const biometricStatus: BiometricStatus = verification?.biometric_status ?? "not_started";
  const faceMatchSupported = verification?.id_type === "NIN" || verification?.id_type === "International Passport";

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Verification</h1>
          </div>
          <a href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Dashboard</a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {!provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
            <h2 className="text-2xl font-black">Create your provider profile first</h2>
            <p className="mt-3 text-zinc-400">Your business profile must exist before verification can be submitted.</p>
            <a href="/provider-dashboard" className="mt-6 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Go to Provider Dashboard</a>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Provider</p>
                  <h2 className="mt-1 text-2xl font-black">{provider.business_name}</h2>
                  <p className="mt-1 text-zinc-400">{provider.service_category} • {provider.location}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-xs font-black ${biometricStatus === "verified" ? "bg-emerald-500/15 text-emerald-400" : provider.is_verified ? "bg-amber-500/15 text-amber-300" : statusStyle(verification?.status ?? "draft")}`}>
                  {biometricStatus === "verified" ? "✓ BIOMETRIC VERIFIED" : provider.is_verified ? "ID REVIEWED • BIOMETRIC REQUIRED" : (verification?.status ?? "draft").toUpperCase()}
                </span>
              </div>
              {verification?.status === "rejected" && verification.admin_notes && (
                <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-200">
                  Review note: {verification.admin_notes}
                </div>
              )}
            </div>

            {provider.is_verified && biometricStatus === "verified" && (
              <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-7">
                <h3 className="text-2xl font-black text-emerald-400">Biometric verification complete</h3>
                <p className="mt-2 text-zinc-300">Your identity review and live face verification are complete. You are eligible for Rydah jobs subject to the other marketplace requirements.</p>
              </div>
            )}

            {provider.is_verified && biometricStatus !== "verified" && (
              <div className="mt-6 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-7">
                <h3 className="text-2xl font-black text-amber-300">Identity reviewed — biometric upgrade required</h3>
                <p className="mt-2 text-zinc-300">Your older provider review remains on record, but Rydah now requires successful live face and liveness verification before you can receive or work on new jobs.</p>
              </div>
            )}

            {!provider.is_verified && verification?.status === "pending" ? (
              <div className="mt-6 rounded-3xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-7">
                <h3 className="text-2xl font-black text-[#D4AF37]">Identity details submitted</h3>
                <p className="mt-2 text-zinc-300">Complete Face & ID Match below. Admin approval should only happen after the biometric check passes.</p>
              </div>
            ) : !provider.is_verified && (
              <form onSubmit={submitVerification} className="mt-6 grid gap-5 rounded-3xl border border-white/10 bg-[#121212] p-7 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">IDENTITY & EXPERIENCE</p>
                  <h3 className="mt-2 text-3xl font-black">Complete verification</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">Rydah stores only the final four characters of the selected ID at this stage. Do not enter the full ID number in this form.</p>
                </div>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold">Legal name</span>
                  <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="Full legal name" />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Phone</span>
                  <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="080..." />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Years of experience</span>
                  <input required min="0" max="60" type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold">Service address / base</span>
                  <input required value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="Business or operating address" />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">ID type</span>
                  <select value={idType} onChange={(e) => setIdType(e.target.value as VerificationRow["id_type"])} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                    {idTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Last 4 characters only</span>
                  <input required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" value={idLast4} onChange={(e) => setIdLast4(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 uppercase outline-none" placeholder="1234" />
                </label>

                <button disabled={saving} className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-60">
                  {saving ? "Submitting..." : verification?.status === "rejected" ? "Resubmit Verification" : "Submit Identity Details"}
                </button>
              </form>
            )}

            {verification && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">FACE & ID MATCH</p>
                    <h3 className="mt-2 text-3xl font-black">Verify the person behind the profile</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">The full ID number and selfie are sent securely to the identity-verification provider for this check. Rydah keeps only the ID last four characters and the result, not the full ID number or selfie.</p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-xs font-black ${biometricStyle(biometricStatus)}`}>
                    {biometricStatus.replaceAll("_", " ").toUpperCase()}
                  </span>
                </div>

                {verification.biometric_result_text && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">{verification.biometric_result_text}</div>
                )}

                {biometricStatus !== "verified" && (
                  faceMatchSupported ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-sm font-bold">Full {verification.id_type} number</span>
                        <input required value={fullIdNumber} onChange={(e) => setFullIdNumber(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder={verification.id_type === "NIN" ? "Enter full NIN" : "Enter passport number"} />
                        <span className="mt-2 block text-xs text-zinc-500">Used only for this verification request. Rydah keeps the final four characters and verification result, not the complete ID number.</span>
                      </label>

                      <div className="md:col-span-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                        <p className="text-sm font-black text-[#D4AF37]">LIVE FACE VERIFICATION</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">Rydah uses the device camera for a real-time liveness challenge such as blinking and head movement. The verification provider confirms live presence before the captured face is matched with the NIN or passport record.</p>
                        <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                          <span>✓ Android & iPhone camera</span>
                          <span>✓ Desktop webcam</span>
                          <span>✓ Anti-photo/replay check</span>
                        </div>
                      </div>

                      <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300">
                        <input type="checkbox" checked={faceConsent} onChange={(e) => setFaceConsent(e.target.checked)} className="mt-1" />
                        <span>I consent to Rydah and its identity-verification provider using a live camera session solely to verify liveness and match my face with my selected identity record.</span>
                      </label>

                      {livenessConfigured ? (
                        <>
                          <button type="button" disabled={liveFaceSaving || !fullIdNumber.trim() || !faceConsent} onClick={() => void startLiveFaceVerification()} className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-40">
                            {liveFaceSaving ? "Starting Secure Camera…" : "Open Live Camera & Verify"}
                          </button>
                          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
                            <strong className="text-white">When the camera opens:</strong> tap the screen to begin or continue when prompted, keep your face inside the guide, and follow the movement instructions. There is no shutter button — capture happens automatically during the liveness check. Tap <strong className="text-white">Finish</strong> when Youverify says verification is complete.
                          </div>
                        </>
                      ) : identityEnvironment === "sandbox" ? (
                        <form onSubmit={verifyFaceAndId} className="md:col-span-2 grid gap-4">
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                            Live liveness is built but the Youverify public merchant ID still needs to be connected. Sandbox fallback remains available only for testing.
                          </div>
                          <label className="block">
                            <span className="text-sm font-bold">Sandbox face image (test only)</span>
                            <input required={!(verification.id_type === "NIN" && fullIdNumber.replace(/\s+/g, "").trim() === "11111111111")} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-sm text-zinc-300" />
                          </label>
                          <button disabled={faceSaving || !fullIdNumber.trim() || (!selfie && !(verification.id_type === "NIN" && fullIdNumber.replace(/\s+/g, "").trim() === "11111111111")) || !faceConsent} className="rounded-2xl border border-[#D4AF37]/35 px-5 py-4 font-black text-[#D4AF37] disabled:opacity-40">
                            {faceSaving ? "Running Sandbox Check…" : "Run Sandbox Face Match"}
                          </button>
                        </form>
                      ) : (
                        <div className="md:col-span-2 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-200">
                          Live biometric verification is required for production. Provider work remains blocked until the live liveness service is connected.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4 text-sm text-[#E7C85A]">
                      Automated face-to-ID matching currently supports NIN and International Passport. Change the selected ID type and resubmit your identity details to use automated face matching.
                    </div>
                  )
                )}

                {biometricStatus === "verified" && verification.biometric_verified_at && (
                  <p className="mt-4 text-sm text-emerald-300">Verified {new Date(verification.biometric_verified_at).toLocaleString()}.</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
