"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getStoredSession,
  invokeFunction,
  restGet,
  restInsert,
  restPatch,
  type AuthSession,
} from "@/lib/supabase";
import { containsOffPlatformContact, offPlatformContactMessage } from "@/lib/anti-bypass";
import { getCurrentDeviceLocation } from "@/lib/device-location";
import {
  displayServiceArea,
  RYDAH_DEFAULT_SERVICE_AREA,
  RYDAH_SERVICE_AREAS,
  RYDAH_TARGET_CITIES,
  nearestServiceArea,
  serviceAreasForCity,
} from "@/lib/locations";

type ProviderRow = {
  id: string;
  user_id: string | null;
  business_name: string;
  service_category: string;
  location: string;
  description: string | null;
  starting_price: number | null;
  is_verified: boolean;
  is_available: boolean;
};

type ProviderBillingState = {
  mode: "test" | "live";
  provider_id: string | null;
  registration_fee_naira: number;
  monthly_fee_naira: number;
  registration_status: "unpaid" | "pending" | "paid" | "failed" | "waived";
  registration_paid_at: string | null;
  mandate_status: "not_started" | "pending" | "active" | "failed" | "revoked";
  subscription_status: "inactive" | "pending" | "active" | "past_due" | "non_renewing" | "cancelled";
  subscription_started_at: string | null;
  last_subscription_paid_at: string | null;
  next_payment_at: string | null;
  billing_ready: boolean;
  promo_code: string | null;
  promo_market_key: string | null;
  promo_slot_number: number | null;
  promo_claimed_at: string | null;
  promo_free_until: string | null;
  promo_active: boolean;
  promo_days_remaining: number;
  subscription_due_now: boolean;
};

type ProviderPromoMarket = {
  market_key: string;
  city_name: string;
  region_name: string;
  slot_limit: number;
  claimed_count: number;
  remaining: number;
};

type BiometricStatus = "not_started" | "pending" | "verified" | "failed" | "review_required";

type VerificationRow = {
  id: string;
  provider_id: string;
  legal_name: string;
  phone: string;
  years_experience: number;
  service_address: string;
  id_type: "NIN" | "International Passport";
  id_last4: string;
  status: "draft" | "pending" | "approved" | "rejected";
  admin_notes: string | null;
  biometric_status: BiometricStatus;
  biometric_result_text: string | null;
  biometric_verified_at: string | null;
  biometric_liveness_session_id?: string | null;
};

type IdentityResponse = {
  ok?: boolean;
  status?: BiometricStatus;
  result_text?: string;
  error?: string;
  environment?: string;
  liveness_configured?: boolean;
  session_id?: string;
  session_token?: string;
};

type BillingResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
  message?: string;
  authorization_url?: string;
  redirect_url?: string;
  billing?: ProviderBillingState;
  promo_markets?: ProviderPromoMarket[];
  claim?: {
    claimed?: boolean;
    city_name?: string;
    region_name?: string;
    slot_number?: number;
    slot_limit?: number;
    remaining?: number;
    free_until?: string;
  };
};

const categories = ["Electrician", "Plumber", "AC Technician", "Generator", "Cleaning", "Mechanic"];
const idTypes: VerificationRow["id_type"][] = ["NIN", "International Passport"];

const steps = [
  { number: 1, title: "Registration", short: "Free / pay once" },
  { number: 2, title: "Your service", short: "Set profile" },
  { number: 3, title: "Membership", short: "Free / bank" },
  { number: 4, title: "Verify identity", short: "ID + face" },
  { number: 5, title: "Ready", short: "Go online" },
] as const;

function naira(value: number | null | undefined) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the photo."));
    reader.readAsDataURL(file);
  });
}

function ProviderSetupProgress({ currentStep }: { currentStep: number }) {
  const percent = ((currentStep - 1) / (steps.length - 1)) * 100;
  return (
    <div className="rounded-3xl border border-white/10 bg-[#121212] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">PROVIDER SETUP</p>
          <p className="mt-1 text-sm font-bold text-zinc-300">Step {currentStep} of {steps.length}</p>
        </div>
        <span className="rounded-full bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#D4AF37]">
          {steps[currentStep - 1].title}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-[#D4AF37] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-1">
        {steps.map((step) => (
          <div key={step.number} className="text-center">
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                step.number < currentStep
                  ? "bg-emerald-500/20 text-emerald-300"
                  : step.number === currentStep
                    ? "bg-[#D4AF37] text-black"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {step.number < currentStep ? "✓" : step.number}
            </div>
            <p className="mt-1 hidden text-[10px] font-bold text-zinc-500 sm:block">{step.short}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProviderOnboardingPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [billing, setBilling] = useState<ProviderBillingState | null>(null);
  const [promoMarkets, setPromoMarkets] = useState<ProviderPromoMarket[]>([]);
  const [promoCity, setPromoCity] = useState<string>("Lagos");
  const [verification, setVerification] = useState<VerificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [identityEnvironment, setIdentityEnvironment] = useState("sandbox");
  const [livenessConfigured, setLivenessConfigured] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Electrician");
  const [location, setLocation] = useState(RYDAH_DEFAULT_SERVICE_AREA);
  const [startingPrice, setStartingPrice] = useState("");
  const [description, setDescription] = useState("");
  const [gpsMessage, setGpsMessage] = useState("");

  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsExperience, setYearsExperience] = useState("1");
  const [serviceAddress, setServiceAddress] = useState("");
  const [idType, setIdType] = useState<VerificationRow["id_type"]>("NIN");
  const [idLast4, setIdLast4] = useState("");
  const [fullIdNumber, setFullIdNumber] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [faceConsent, setFaceConsent] = useState(false);

  const registrationDone = Boolean(
    billing && ["paid", "waived"].includes(billing.registration_status),
  );
  const profileDone = Boolean(provider);
  const subscriptionDone = Boolean(billing?.billing_ready);
  const biometricDone = verification?.biometric_status === "verified";
  const verificationDone = Boolean(provider?.is_verified && biometricDone);
  const ready = registrationDone && profileDone && subscriptionDone && verificationDone;

  const currentStep = useMemo(() => {
    if (!registrationDone) return 1;
    if (!profileDone) return 2;
    if (!subscriptionDone) return 3;
    if (!verificationDone) return 4;
    return 5;
  }, [registrationDone, profileDone, subscriptionDone, verificationDone]);

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(current);

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const billingReturn = params.get("billing");
        if (billingReturn === "registration") {
          const result = await billingAction(current, "verify_registration");
          if (result.status === "paid") {
            setMessage("Registration payment confirmed. Next, tell customers what service you provide.");
          }
        } else if (billingReturn === "mandate") {
          const result = await billingAction(current, "verify_mandate");
          setMessage(
            result.message ||
              (result.status === "active"
                ? "Monthly payment is active."
                : "Your bank approval is still being completed."),
          );
        }
        if (billingReturn) {
          window.history.replaceState({}, "", "/provider-onboarding");
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to confirm your latest setup step.");
      }

      await loadAll(current);
    })();
  // Intentional one-time browser auth/data bootstrap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function billingAction(
    current: AuthSession,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    const response = await invokeFunction("provider-billing", { action, ...extra }, current.access_token);
    const result = (await response.json().catch(() => ({}))) as BillingResponse;
    if (result.promo_markets) setPromoMarkets(result.promo_markets);
    if (!response.ok) throw new Error(result.error || result.message || "Unable to update provider billing.");
    if (result.billing) setBilling(result.billing);
    return result;
  }

  async function callIdentity(current: AuthSession, payload: Record<string, unknown>) {
    const response = await invokeFunction("identity-verification", payload, current.access_token);
    const result = (await response.json().catch(() => ({}))) as IdentityResponse;
    if (!response.ok) throw new Error(result.error || "Unable to complete identity verification.");
    return result;
  }

  async function loadAll(current: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const [billingResult, providerRows] = await Promise.all([
        billingAction(current, "status"),
        restGet<ProviderRow[]>(
          `providers?user_id=eq.${current.user.id}&select=*&limit=1`,
          current.access_token,
        ),
      ]);

      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);
      if (billingResult.billing) setBilling(billingResult.billing);

      if (!currentProvider) {
        setVerification(null);
        return;
      }

      const [verificationRows, identityStatus] = await Promise.all([
        restGet<VerificationRow[]>(
          `provider_verifications?provider_id=eq.${currentProvider.id}&select=*&limit=1`,
          current.access_token,
        ),
        callIdentity(current, { action: "status" }).catch(() => null),
      ]);

      const currentVerification = verificationRows[0] ?? null;
      setVerification(currentVerification);

      if (identityStatus) {
        setIdentityEnvironment(identityStatus.environment || "sandbox");
        setLivenessConfigured(Boolean(identityStatus.liveness_configured));
      }

      if (currentVerification) {
        setLegalName(currentVerification.legal_name || "");
        setPhone(currentVerification.phone || "");
        setYearsExperience(String(currentVerification.years_experience ?? 1));
        setServiceAddress(currentVerification.service_address || "");
        setIdType(currentVerification.id_type === "International Passport" ? "International Passport" : "NIN");
        setIdLast4(currentVerification.id_last4 || "");
      }

      if (
        billingResult.billing?.billing_ready &&
        currentProvider.is_verified &&
        currentVerification?.biometric_status === "verified" &&
        currentProvider.is_available
      ) {
        window.location.replace("/provider-work");
      }
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unable to load provider setup.";
      if (detail.toLowerCase().includes("provider account is required")) {
        window.location.replace("/providers");
        return;
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  async function claimFoundingPromo() {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await billingAction(session, "claim_promo", { city: promoCity });
      const city = result.claim?.city_name;
      if (city && RYDAH_TARGET_CITIES.includes(city as (typeof RYDAH_TARGET_CITIES)[number])) {
        const firstArea = serviceAreasForCity(city as (typeof RYDAH_TARGET_CITIES)[number])[0];
        if (firstArea) setLocation(firstArea);
      }
      setMessage(
        result.message ||
          "Founding 100 place confirmed. Registration is free and your first 3 months are free.",
      );
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to claim a Founding 100 place.");
    } finally {
      setBusy(false);
    }
  }

  async function startRegistrationPayment() {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await billingAction(session, "initialize_registration");
      if (result.authorization_url) {
        window.location.assign(result.authorization_url);
        return;
      }
      setMessage("Registration is already paid.");
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start registration payment.");
    } finally {
      setBusy(false);
    }
  }

  async function detectGpsArea() {
    setGpsBusy(true);
    setError("");
    setGpsMessage("");
    try {
      const coordinates = await getCurrentDeviceLocation();
      const nearest = nearestServiceArea(
        coordinates.latitude,
        coordinates.longitude,
        RYDAH_SERVICE_AREAS,
      );
      if (!nearest || nearest.distanceKm > 60) {
        throw new Error("We could not match your phone location to a current Rydah service area. Choose your area from the list.");
      }
      setLocation(nearest.area);
      setGpsMessage(`Area detected: ${displayServiceArea(nearest.area)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to detect your service area.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !registrationDone) return;
    if (containsOffPlatformContact(description)) {
      setError(offPlatformContactMessage);
      return;
    }

    const price = Number(startingPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid starting price.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const rows = await restInsert<ProviderRow[]>(
        "providers",
        {
          user_id: session.user.id,
          business_name: businessName.trim(),
          service_category: category,
          location,
          description: description.trim(),
          starting_price: Math.round(price),
          is_available: false,
          is_verified: false,
        },
        session.access_token,
      );

      if (!rows[0]) throw new Error("Your provider profile was not returned by Rydah.");
      setMessage(
        billing?.promo_active
          ? `Profile saved. Your Founding 100 free access is active until ${new Date(String(billing.promo_free_until)).toLocaleDateString("en-GB")}.`
          : `Profile saved. Now connect your bank for the ${naira(billing?.monthly_fee_naira)} monthly provider payment.`,
      );
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your provider profile.");
    } finally {
      setBusy(false);
    }
  }

  async function startMonthlyPayment() {
    if (!session || !provider) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await billingAction(session, "initialize_mandate");
      if (result.redirect_url) {
        window.location.assign(result.redirect_url);
        return;
      }
      setMessage("Your monthly payment is already active.");
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to connect your bank.");
    } finally {
      setBusy(false);
    }
  }

  async function checkBankApproval() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const result = await billingAction(session, "verify_mandate");
      setMessage(
        result.message ||
          (result.status === "active"
            ? "Monthly payment is active."
            : "Your bank approval is still being completed."),
      );
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to check bank approval.");
    } finally {
      setBusy(false);
    }
  }

  async function submitIdentityDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !provider) return;

    setBusy(true);
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
      const rows = verification
        ? await restPatch<VerificationRow[]>(
            "provider_verifications",
            `id=eq.${verification.id}`,
            payload,
            session.access_token,
          )
        : await restInsert<VerificationRow[]>(
            "provider_verifications",
            payload,
            session.access_token,
          );

      if (!rows[0]) throw new Error("Rydah could not confirm your identity details.");
      setMessage("Details saved. One last identity step: verify your face.");
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save identity details.");
    } finally {
      setBusy(false);
    }
  }

  function setImmersiveVerification(active: boolean) {
    window.dispatchEvent(
      new CustomEvent("rydah:immersive-verification", { detail: { active } }),
    );
  }

  async function completeLiveFaceVerification(sessionId: string) {
    const activeSession = session ?? getStoredSession();
    if (!activeSession || !sessionId) return;
    if (!fullIdNumber.trim()) {
      setError("Enter your full ID number first.");
      return;
    }
    if (!faceConsent) {
      setError("Tick the consent box before continuing.");
      return;
    }

    setFaceBusy(true);
    setError("");
    setMessage("Finishing your secure identity check…");

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        const result = await callIdentity(activeSession, {
          action: "complete_live_verification",
          id_number: fullIdNumber,
          session_id: sessionId,
          consent: true,
        });
        setMessage(result.result_text || "Face verification completed.");
        setFullIdNumber("");
        setFaceConsent(false);
        await loadAll(activeSession);
        setFaceBusy(false);
        return;
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : "Unable to finish face verification.";
        if (detail.includes("still being finalized") && attempt < 6) {
          setMessage("Your camera check is complete. Finishing securely…");
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          continue;
        }
        setError(detail);
        setMessage("");
        setFaceBusy(false);
        await loadAll(activeSession);
        return;
      }
    }

    setFaceBusy(false);
  }

  async function startLiveFaceVerification() {
    if (!session || !provider || !verification) return;
    if (!fullIdNumber.trim()) {
      setError("Enter your full ID number first.");
      return;
    }
    if (!faceConsent) {
      setError("Tick the consent box before continuing.");
      return;
    }

    setFaceBusy(true);
    setImmersiveVerification(true);
    setError("");
    setMessage("Opening your secure camera check…");

    try {
      const credentials = await callIdentity(session, { action: "liveness_session" });
      if (!credentials.session_id || !credentials.session_token) {
        throw new Error("The secure camera session could not be started.");
      }

      const livenessModule = await import("youverify-liveness-web");
      const YouverifyLiveness = livenessModule.default;
      const [firstName, ...rest] = verification.legal_name.trim().split(/\s+/);
      const liveSessionId = credentials.session_id;

      const liveness = new YouverifyLiveness({
        presentation: "modal",
        sessionId: credentials.session_id,
        sessionToken: credentials.session_token,
        entityId: provider.id,
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
          setMessage("Camera check passed. Finishing your verification…");
          window.setTimeout(() => void completeLiveFaceVerification(liveSessionId), 1200);
        },
        onFailure: (data: { error?: { message?: string; key?: string } }) => {
          setImmersiveVerification(false);
          setMessage("");
          setError(String(data?.error?.message || data?.error?.key || "Face check failed. Please try again."));
          setFaceBusy(false);
        },
        onClose: () => {
          setImmersiveVerification(false);
          setFaceBusy(false);
        },
      });

      liveness.start();
    } catch (caught) {
      setImmersiveVerification(false);
      setFaceBusy(false);
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to start the camera check.");
    }
  }

  async function runSandboxFaceMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !verification) return;
    const sampleNin = idType === "NIN" && fullIdNumber.replace(/\s+/g, "") === "11111111111";
    if (!selfie && !sampleNin) {
      setError("Choose a clear test photo first.");
      return;
    }
    if (!faceConsent) {
      setError("Tick the consent box before continuing.");
      return;
    }

    setFaceBusy(true);
    setError("");
    setMessage("Running the test identity check…");
    try {
      const selfieData = selfie ? await fileToDataUrl(selfie) : "";
      const result = await callIdentity(session, {
        action: "verify_face_id",
        id_number: fullIdNumber,
        selfie: selfieData,
        use_sandbox_sample: sampleNin,
        consent: true,
      });
      setMessage(result.result_text || "Test verification completed.");
      setFullIdNumber("");
      setSelfie(null);
      setFaceConsent(false);
      await loadAll(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run the test verification.");
      setMessage("");
    } finally {
      setFaceBusy(false);
    }
  }

  async function goOnline() {
    if (!session || !provider || !ready) return;
    setBusy(true);
    setError("");
    try {
      const rows = await restPatch<ProviderRow[]>(
        "providers",
        `id=eq.${provider.id}`,
        { is_available: true },
        session.access_token,
      );
      if (!rows[0]) throw new Error("Rydah could not switch your provider profile online.");
      window.location.assign("/provider-work");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to go online.");
      setBusy(false);
    }
  }


  if (loading) {
    return (
      <main className="min-h-screen bg-[#080808] px-5 py-6 sm:py-8 text-white">
        <div className="mx-auto max-w-xl">
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">
            Loading your setup…
          </div>
        </div>
      </main>
    );
  }

  const identityDetailsNeedWork = !verification || verification.status === "rejected";

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-5">
          <Link href="/" className="font-black tracking-[0.18em] text-[#D4AF37]">RYDAH LOCAL</Link>
          <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-400">
            Save & Exit
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-7 pb-16">
        <ProviderSetupProgress currentStep={currentStep} />

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm leading-6 text-red-200">
            {error}
          </div>
        )}

        {billing?.promo_code === "founding_100" && (
          <div className="mt-5 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-300">FOUNDING 100 PROVIDER</p>
                <h2 className="mt-1 text-xl font-black">Registration free • first 3 months free</h2>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-300">
                SLOT #{billing.promo_slot_number}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {billing.promo_active
                ? `You have ${billing.promo_days_remaining} day${billing.promo_days_remaining === 1 ? "" : "s"} remaining. Your free period ends ${new Date(String(billing.promo_free_until)).toLocaleDateString("en-GB")}. After that, the normal ${naira(billing.monthly_fee_naira)}/month provider subscription is required.`
                : `Your 3-month free period has ended. Your registration remains waived; activate the ${naira(billing.monthly_fee_naira)}/month subscription to continue receiving jobs.`}
            </p>
          </div>
        )}

        {currentStep === 1 && billing && (
          <div className="mt-6 rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#17130a] to-[#101010] p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">STEP 1</p>
            <h1 className="mt-2 text-3xl font-black">Activate your provider account</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              The first 100 providers can secure free registration plus 3 months of free provider access. Promotional places are reserved by launch market.
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-emerald-300">FOUNDING 100 OFFER</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-300">
                    Lagos has 40 places. Abuja/FCT, Ibadan/Oyo, Warri/Delta and Port Harcourt/Rivers have 15 places each.
                  </p>
                </div>
                <span className="rounded-full bg-black/30 px-3 py-2 text-xs font-black text-emerald-200">100 TOTAL</span>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold text-zinc-300">Your main launch city</span>
                <select
                  value={promoCity}
                  onChange={(event) => setPromoCity(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
                >
                  {promoMarkets.map((market) => (
                    <option key={market.market_key} value={market.city_name}>
                      {market.city_name} — {market.remaining} of {market.slot_limit} places left
                    </option>
                  ))}
                </select>
              </label>

              {promoMarkets.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {promoMarkets.map((market) => (
                    <div key={market.market_key} className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
                      <p className="text-xs font-black">{market.city_name}</p>
                      <p className={`mt-1 text-xs font-bold ${market.remaining > 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {market.remaining} left
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={busy || promoMarkets.length === 0 || (promoMarkets.find((market) => market.city_name === promoCity)?.remaining ?? 0) <= 0}
                onClick={() => void claimFoundingPromo()}
                className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Claiming…" : "Claim My Free 3-Month Founding Place"}
              </button>
              <p className="mt-3 text-xs leading-5 text-zinc-400">
                If your city allocation is full, normal {naira(billing.registration_fee_naira)} registration and {naira(billing.monthly_fee_naira)}/month membership apply immediately.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-zinc-400">Standard registration fee</span>
                <span className="text-2xl font-black">{naira(billing.registration_fee_naira)}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                This applies when no Founding 100 place remains in your selected launch market. It is separate from the {naira(billing.monthly_fee_naira)} monthly provider membership.
              </p>
            </div>

            {billing.mode === "test" && (
              <p className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-5 text-blue-200">
                Test mode is active. You can test this step without taking live money.
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void startRegistrationPayment()}
              className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 text-base font-black text-black disabled:opacity-50"
            >
              {busy ? "Opening secure payment…" : `Pay ${naira(billing.registration_fee_naira)} & Continue`}
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <form onSubmit={createProfile} className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">STEP 2</p>
            <h1 className="mt-2 text-3xl font-black">Tell customers what you do</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Keep it simple. You can update these details later.
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-bold">Business or display name</span>
              <input
                required
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="e.g. Ade Electrical Services"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Main service</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
              >
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Main service area</span>
              <select
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setGpsMessage("");
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
              >
                {RYDAH_TARGET_CITIES.map((city) => (
                  <optgroup key={city} label={city}>
                    {serviceAreasForCity(city).map((area) => (
                      <option key={area} value={area}>{displayServiceArea(area)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                disabled={gpsBusy}
                onClick={() => void detectGpsArea()}
                className="mt-3 rounded-xl border border-[#D4AF37]/35 px-4 py-3 text-sm font-black text-[#E5C65A] disabled:opacity-40"
              >
                {gpsBusy ? "Finding your area…" : "📍 Use My Phone Location"}
              </button>
              {gpsMessage && <span className="mt-2 block text-xs text-emerald-300">{gpsMessage}</span>}
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Starting price</span>
              <div className="relative mt-2">
                <span className="absolute left-4 top-4 font-black text-[#D4AF37]">₦</span>
                <input
                  required
                  min="1"
                  inputMode="numeric"
                  type="number"
                  value={startingPrice}
                  onChange={(event) => setStartingPrice(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] py-4 pl-9 pr-4 outline-none"
                />
              </div>
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Short description</span>
              <textarea
                required
                minLength={20}
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Briefly describe the jobs you handle and your experience."
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
              />
              <span className="mt-2 block text-xs text-zinc-500">
                Keep phone numbers, WhatsApp and external links out of your profile.
              </span>
            </label>

            <button
              disabled={busy}
              className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save & Continue"}
            </button>
          </form>
        )}

        {currentStep === 3 && billing && provider && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">STEP 3</p>
            <h1 className="mt-2 text-3xl font-black">Connect your bank</h1>
            {billing.subscription_due_now && billing.promo_code === "founding_100" && (
              <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                Your Founding 100 three-month free period has ended. Your registration fee stays waived; activate the monthly subscription now to return to the marketplace.
              </div>
            )}
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Approve a secure bank instruction so Rydah can collect {naira(billing.monthly_fee_naira)} once each month while you use the provider marketplace.
            </p>

            <div className="mt-6 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5">
              <p className="text-sm font-black text-[#D4AF37]">{naira(billing.monthly_fee_naira)} / month</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                You approve this with your bank through Paystack. Rydah does not ask you to type your full bank credentials into this page.
              </p>
            </div>

            {billing.mandate_status === "pending" && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                Your bank approval is still pending. You can check again below.
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void startMonthlyPayment()}
              className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50"
            >
              {busy ? "Please wait…" : billing.mandate_status === "pending" ? "Open Bank Approval Again" : "Connect Bank & Continue"}
            </button>

            {billing.mandate_status === "pending" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkBankApproval()}
                className="mt-3 w-full rounded-2xl border border-[#D4AF37]/40 px-5 py-4 font-black text-[#E5C65A] disabled:opacity-50"
              >
                Check Bank Approval
              </button>
            )}
          </div>
        )}

        {currentStep === 4 && provider && (
          <div className="mt-6">
            {identityDetailsNeedWork ? (
              <form onSubmit={submitIdentityDetails} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">STEP 4</p>
                <h1 className="mt-2 text-3xl font-black">Verify who you are</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  We use these details to protect customers and genuine providers from impersonation.
                </p>

                {verification?.status === "rejected" && verification.admin_notes && (
                  <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-200">
                    Please update this before resubmitting: {verification.admin_notes}
                  </div>
                )}

                <label className="mt-6 block">
                  <span className="text-sm font-bold">Legal name</span>
                  <input
                    required
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    placeholder="As shown on your ID"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold">Phone number</span>
                  <input
                    required
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="080..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold">Years of experience</span>
                  <input
                    required
                    min="0"
                    max="60"
                    inputMode="numeric"
                    type="number"
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold">Service address / base</span>
                  <input
                    required
                    value={serviceAddress}
                    onChange={(event) => setServiceAddress(event.target.value)}
                    placeholder="Your business or operating base"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold">ID type</span>
                  <select
                    value={idType}
                    onChange={(event) => setIdType(event.target.value as VerificationRow["id_type"])}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                  >
                    {idTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <span className="mt-2 block text-xs text-zinc-500">
                    NIN and International Passport provide the smoothest automated face check at launch.
                  </span>
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-bold">Last 4 characters of ID</span>
                  <input
                    required
                    minLength={4}
                    maxLength={4}
                    pattern="[A-Za-z0-9]{4}"
                    value={idLast4}
                    onChange={(event) => setIdLast4(event.target.value)}
                    placeholder="1234"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 uppercase outline-none placeholder:text-zinc-600"
                  />
                </label>

                <button
                  disabled={busy}
                  className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Details & Continue"}
                </button>
              </form>
            ) : verification?.biometric_status !== "verified" ? (
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">STEP 4 • FINAL CHECK</p>
                <h1 className="mt-2 text-3xl font-black">Verify your face</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Enter your full {verification?.id_type || "ID"} number for this check only, then use your phone camera. Rydah keeps the result and last four characters, not your full ID number or camera image.
                </p>

                {verification?.biometric_result_text && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                    {verification.biometric_result_text}
                  </div>
                )}

                <label className="mt-6 block">
                  <span className="text-sm font-bold">Full {verification?.id_type || "ID"} number</span>
                  <input
                    required
                    value={fullIdNumber}
                    onChange={(event) => setFullIdNumber(event.target.value)}
                    autoComplete="off"
                    placeholder={verification?.id_type === "NIN" ? "Enter full NIN" : "Enter passport number"}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
                  />
                </label>

                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={faceConsent}
                    onChange={(event) => setFaceConsent(event.target.checked)}
                    className="mt-1 h-5 w-5"
                  />
                  <span>I agree to use my phone camera for a live identity check.</span>
                </label>

                {livenessConfigured ? (
                  <>
                    <button
                      type="button"
                      disabled={faceBusy || !fullIdNumber.trim() || !faceConsent}
                      onClick={() => void startLiveFaceVerification()}
                      className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-40"
                    >
                      {faceBusy ? "Checking…" : "Open Camera & Verify"}
                    </button>

                    {verification?.biometric_status === "pending" && verification.biometric_liveness_session_id && (
                      <button
                        type="button"
                        disabled={faceBusy || !fullIdNumber.trim() || !faceConsent}
                        onClick={() => void completeLiveFaceVerification(verification.biometric_liveness_session_id || "")}
                        className="mt-3 w-full rounded-2xl border border-[#D4AF37]/40 px-5 py-4 font-black text-[#E5C65A] disabled:opacity-40"
                      >
                        Check Latest Result
                      </button>
                    )}
                  </>
                ) : identityEnvironment === "sandbox" ? (
                  <form onSubmit={runSandboxFaceMatch} className="mt-6">
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-5 text-blue-200">
                      Rydah is currently using the identity test environment. This test control disappears when live camera verification is enabled.
                    </div>
                    <label className="mt-4 block">
                      <span className="text-sm font-bold">Test face photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => setSelfie(event.target.files?.[0] ?? null)}
                        className="mt-2 block w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-sm text-zinc-300"
                      />
                    </label>
                    <button
                      disabled={faceBusy || !fullIdNumber.trim() || !faceConsent}
                      className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-40"
                    >
                      {faceBusy ? "Checking…" : "Run Test Verification"}
                    </button>
                  </form>
                ) : (
                  <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
                    Secure camera verification is temporarily unavailable. Your progress is saved; return here when the service is connected.
                  </div>
                )}
              </div>
            ) : !provider.is_verified ? (
              <div className="rounded-3xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5 sm:p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">✓</div>
                <h1 className="mt-4 text-3xl font-black">Face check complete</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Your identity check passed. Rydah is completing the final provider review. You do not need to repeat any previous step.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => session && void loadAll(session)}
                  className="mt-6 w-full rounded-2xl border border-[#D4AF37]/40 px-5 py-4 font-black text-[#E5C65A] disabled:opacity-50"
                >
                  Check Review Status
                </button>
              </div>
            ) : null}
          </div>
        )}

        {currentStep === 5 && provider && billing && (
          <div className="mt-6 rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 to-[#101010] p-5 sm:p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300">✓</div>
            <p className="mt-5 text-xs font-black tracking-[0.18em] text-emerald-300">SETUP COMPLETE</p>
            <h1 className="mt-2 text-4xl font-black">You’re ready for Rydah jobs</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-300">
              Registration is paid, your {naira(billing.monthly_fee_naira)} monthly payment is active, and your identity is verified.
            </p>

            <div className="mt-6 grid gap-2 text-left text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">✓ Registration paid</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">✓ Provider profile created</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">✓ Monthly bank payment active</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">✓ Identity & face verified</div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void goOnline()}
              className="mt-7 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 text-lg font-black text-black disabled:opacity-50"
            >
              {busy ? "Going online…" : "GO ONLINE"}
            </button>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Going online means customers can see you as available for suitable Rydah jobs.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
