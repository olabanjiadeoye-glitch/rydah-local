"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clearSession,
  getStoredSession,
  restGet,
  restInsert,
  restPatch,
  restRpc,
  invokeFunction,
  type AuthSession,
} from "@/lib/supabase";
import { containsOffPlatformContact, offPlatformContactMessage } from "@/lib/anti-bypass";
import { getCurrentDeviceLocation } from "@/lib/device-location";
import { RYDAH_DEFAULT_SERVICE_AREA, RYDAH_SERVICE_AREAS, nearestServiceArea } from "@/lib/locations";

type ProviderRow = {
  id: string;
  user_id: string | null;
  business_name: string;
  service_category: string;
  location: string;
  description: string | null;
  rating: number | string;
  jobs_completed: number;
  starting_price: number | null;
  is_verified: boolean;
  is_available: boolean;
};

type ProviderVerificationRow = {
  biometric_status: string | null;
  biometric_job_id: string | null;
};

type PlatformSettingRow = {
  value_numeric: number | string | null;
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
};

type JobStatus = "open" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled";
type QuoteStatus = "not_sent" | "pending" | "accepted" | "rejected";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  description: string;
  is_urgent: boolean;
  status: JobStatus;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_source: string;
  created_at: string;
  quoted_amount: number | null;
  quote_status: QuoteStatus;
  quote_accepted_at: string | null;
  payment_status: string;
  arrival_verified_at: string | null;
  arrival_face_verified_at: string | null;
};

const categories = ["Electrician", "Plumber", "AC Technician", "Generator", "Cleaning", "Mechanic"];
const locations = RYDAH_SERVICE_AREAS;

function naira(value: number | null) {
  return value == null ? "Not set" : `₦${Number(value).toLocaleString()}`;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProviderDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [biometricArrivalRequired, setBiometricArrivalRequired] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState("not_started");
  const [biometricWorkRequired, setBiometricWorkRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});
  const [arrivalCodes, setArrivalCodes] = useState<Record<string, string>>({});
  const [billing, setBilling] = useState<ProviderBillingState | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Electrician");
  const [location, setLocation] = useState(RYDAH_DEFAULT_SERVICE_AREA);
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");

  const openJobs = useMemo(
    () => jobs.filter((job) => !["completed", "cancelled"].includes(job.status)).length,
    [jobs],
  );

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }
    setSession(currentSession);
    void (async () => {
      await loadDashboard(currentSession);
      const billingReturn = new URLSearchParams(window.location.search).get("billing");
      if (billingReturn === "registration") {
        await verifyRegistrationPayment(currentSession);
      } else if (billingReturn === "mandate") {
        await verifyDirectDebit(currentSession);
      }
      if (billingReturn) {
        window.history.replaceState({}, "", "/provider-dashboard");
      }
    })();
  // Intentional one-time browser auth/data bootstrap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callProviderBilling(currentSession: AuthSession, action: string) {
    const response = await invokeFunction("provider-billing", { action }, currentSession.access_token);
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      authorization_url?: string;
      redirect_url?: string;
      billing?: ProviderBillingState;
      status?: string;
    };
    if (!response.ok) throw new Error(payload.error || payload.message || "Provider billing request failed.");
    if (payload.billing) setBilling(payload.billing);
    return payload;
  }

  async function loadBilling(currentSession: AuthSession) {
    const payload = await callProviderBilling(currentSession, "status");
    return payload.billing ?? null;
  }

  async function startRegistrationPayment() {
    if (!session) return;
    setBillingBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = await callProviderBilling(session, "initialize_registration");
      if (payload.authorization_url) {
        window.location.assign(payload.authorization_url);
        return;
      }
      setMessage("Your provider registration fee is already confirmed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start provider registration payment.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function verifyRegistrationPayment(currentSession: AuthSession = session as AuthSession) {
    if (!currentSession) return;
    setBillingBusy(true);
    setError("");
    try {
      const payload = await callProviderBilling(currentSession, "verify_registration");
      if (payload.status === "paid") {
        setMessage("₦500 provider registration fee confirmed. Create your provider profile, then activate the ₦500/month Direct Debit subscription.");
      }
      await loadDashboard(currentSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify provider registration payment.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function startDirectDebit() {
    if (!session) return;
    setBillingBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = await callProviderBilling(session, "initialize_mandate");
      if (payload.redirect_url) {
        window.location.assign(payload.redirect_url);
        return;
      }
      setMessage("Your monthly Direct Debit subscription is already active.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start Direct Debit setup.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function verifyDirectDebit(currentSession: AuthSession = session as AuthSession) {
    if (!currentSession) return;
    setBillingBusy(true);
    setError("");
    try {
      const payload = await callProviderBilling(currentSession, "verify_mandate");
      setMessage(payload.message || (payload.status === "active"
        ? "₦500/month Direct Debit subscription is active."
        : "Direct Debit approval is still pending with your bank."));
      await loadDashboard(currentSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify Direct Debit setup.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function loadDashboard(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const billingState = await loadBilling(currentSession);
      const providerRows = await restGet<ProviderRow[]>(
        `providers?user_id=eq.${currentSession.user.id}&select=*`,
        currentSession.access_token,
      );
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);

      if (!currentProvider) {
        window.location.replace("/provider-onboarding");
        return;
      }

      const [verificationRows, biometricSettingRows] = await Promise.all([
        restGet<ProviderVerificationRow[]>(
          `provider_verifications?provider_id=eq.${currentProvider.id}&select=biometric_status,biometric_job_id&limit=1`,
          currentSession.access_token,
        ).catch(() => []),
        restGet<PlatformSettingRow[]>(
          "platform_settings?key=eq.biometric_verification_required&select=value_numeric&limit=1",
          currentSession.access_token,
        ).catch(() => []),
      ]);

      const verification = verificationRows[0];
      if (
        !billingState?.billing_ready ||
        !currentProvider.is_verified ||
        verification?.biometric_status !== "verified"
      ) {
        window.location.replace("/provider-onboarding");
        return;
      }

      const jobRows = await restRpc<JobRow[]>(
        "provider_job_feed",
        {},
        currentSession.access_token,
      );

      setJobs(jobRows);
      const biometricRequired = Number(biometricSettingRows[0]?.value_numeric || 0) === 1;
      setBiometricStatus(verification?.biometric_status || "not_started");
      setBiometricWorkRequired(biometricRequired);
      setBiometricArrivalRequired(Boolean(verification?.biometric_status === "verified" && verification?.biometric_job_id));
      setQuoteDrafts(Object.fromEntries(jobRows.map((job) => [job.id, job.quoted_amount ? String(job.quoted_amount) : ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load provider dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function updateProviderGps() {
    if (!session) return;

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
        throw new Error("Your GPS position appears outside Rydah's current Lagos, Abuja, Ibadan, Warri and Port Harcourt coverage. Choose your Nigerian service area manually.");
      }

      setLocation(nearest.area);
      setGpsMessage(`GPS matched your service area to ${nearest.area} • approx. ${nearest.distanceKm.toFixed(1)} km from the area centre • accuracy ${Math.round(coordinates.accuracy)} m.`);

      if (provider) {
        const updated = await restPatch<ProviderRow[]>(
          "providers",
          `id=eq.${provider.id}`,
          { location: nearest.area },
          session.access_token,
        );
        if (updated[0]) setProvider(updated[0]);
        setMessage(`Provider service area updated to ${nearest.area} from your device GPS.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to use your current location.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function createProviderProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    if (!billing || !["paid", "waived"].includes(billing.registration_status)) {
      setError("Pay the ₦500 Rydah provider registration fee before creating your provider profile.");
      return;
    }
    if (containsOffPlatformContact(description)) {
      setError(offPlatformContactMessage);
      return;
    }

    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const created = await restInsert<ProviderRow[]>(
        "providers",
        {
          user_id: session.user.id,
          business_name: businessName.trim(),
          service_category: category,
          location,
          description: description.trim(),
          starting_price: Number(startingPrice),
          is_available: false,
          is_verified: false,
        },
        session.access_token,
      );
      if (!created[0]) throw new Error("Provider profile was not returned by the backend.");
      setProvider(created[0]);
      setJobs([]);
      await loadBilling(session);
      setMessage("Provider profile created. Set up the ₦500/month Direct Debit subscription, then complete verification before taking jobs.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create provider profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleAvailability() {
    if (!session || !provider) return;
    if (!billing?.billing_ready && !provider.is_available) {
      setError("Your ₦500 monthly Direct Debit subscription must be active before you can go available.");
      return;
    }
    setSavingProfile(true);
    setError("");
    try {
      const updated = await restPatch<ProviderRow[]>(
        "providers",
        `id=eq.${provider.id}`,
        { is_available: !provider.is_available },
        session.access_token,
      );
      if (updated[0]) setProvider(updated[0]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change availability.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateJobStatus(job: JobRow, status: JobStatus) {
    if (!session) return;
    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      await restRpc<Record<string, unknown>>(
        "provider_set_job_status",
        { p_job_id: job.id, p_status: status },
        session.access_token,
      );
      setMessage(`Job marked as ${label(status)}.`);
      await loadDashboard(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update job.");
    } finally {
      setSavingJobId("");
    }
  }

  async function sendQuote(job: JobRow) {
    if (!session) return;
    const amount = Number(quoteDrafts[job.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid quote greater than ₦0.");
      return;
    }

    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      await restRpc<Record<string, unknown>>(
        "provider_send_job_quote",
        { p_job_id: job.id, p_amount: Math.round(amount) },
        session.access_token,
      );
      setMessage(`Quote of ${naira(Math.round(amount))} sent to the customer.`);
      await loadDashboard(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send quote.");
    } finally {
      setSavingJobId("");
    }
  }

  async function verifyArrivalPin(job: JobRow) {
    if (!session) return;
    const code = (arrivalCodes[job.id] || "").trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit Arrival PIN shown on the customer's Rydah account.");
      return;
    }

    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      await restRpc<boolean>("verify_job_arrival", { p_job_id: job.id, p_code: code }, session.access_token);
      setArrivalCodes((current) => ({ ...current, [job.id]: "" }));
      setMessage(biometricArrivalRequired
        ? "Arrival PIN verified. Ask the customer to complete the Rydah camera face match before you start work."
        : "Arrival PIN verified. The customer has confirmed you are at the correct job. You can now start work.");
      await loadDashboard(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify the Arrival PIN.");
    } finally {
      setSavingJobId("");
    }
  }

  function signOut() {
    clearSession();
    window.location.href = "/";
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-5 sm:p-6 text-zinc-400">Loading provider dashboard...</main>;
  }

  const role = session?.user.user_metadata?.role;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <a href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Marketplace</a>
            <button onClick={signOut} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Sign Out</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-6 sm:py-8">
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {role === "provider" && billing && (
          <div className="mb-6 rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#17130a] to-[#0d0d0d] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">PROVIDER BILLING</p>
                <h2 className="mt-2 text-2xl font-black">Keep your Rydah provider account active</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Provider membership is ₦{billing.registration_fee_naira.toLocaleString()} once for registration, then ₦{billing.monthly_fee_naira.toLocaleString()} every month by approved Nigerian bank Direct Debit.
                </p>
              </div>
              <span className={`rounded-full px-3 py-2 text-xs font-black ${billing.billing_ready ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                {billing.billing_ready ? "BILLING ACTIVE" : billing.mode === "test" ? "TEST BILLING" : "ACTION REQUIRED"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black text-zinc-500">REGISTRATION</p>
                <p className="mt-1 text-lg font-black">₦{billing.registration_fee_naira.toLocaleString()} one-time</p>
                <p className="mt-1 text-sm text-zinc-400">Status: {label(billing.registration_status)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black text-zinc-500">MONTHLY SUBSCRIPTION</p>
                <p className="mt-1 text-lg font-black">₦{billing.monthly_fee_naira.toLocaleString()} / month</p>
                <p className="mt-1 text-sm text-zinc-400">Direct Debit: {label(billing.subscription_status)}</p>
              </div>
            </div>

            {billing.mode === "test" && (
              <p className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-200">
                Rydah payments are currently in Paystack test mode. This setup validates the billing flow without taking live money.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {!["paid", "waived"].includes(billing.registration_status) ? (
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void startRegistrationPayment()}
                  className="rounded-2xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  {billingBusy ? "Please wait…" : `Pay ₦${billing.registration_fee_naira.toLocaleString()} Registration`}
                </button>
              ) : provider && billing.subscription_status !== "active" ? (
                <>
                  <button
                    type="button"
                    disabled={billingBusy}
                    onClick={() => void startDirectDebit()}
                    className="rounded-2xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                  >
                    {billingBusy ? "Please wait…" : "Set Up Monthly Direct Debit"}
                  </button>
                  {billing.mandate_status === "pending" && (
                    <button
                      type="button"
                      disabled={billingBusy}
                      onClick={() => void verifyDirectDebit()}
                      className="rounded-2xl border border-[#D4AF37]/40 px-5 py-3 text-sm font-black text-[#E5C65A] disabled:opacity-50"
                    >
                      Check Bank Approval
                    </button>
                  )}
                </>
              ) : billing.billing_ready ? (
                <p className="text-sm font-bold text-emerald-300">
                  ✓ Registration paid and monthly Direct Debit subscription active
                  {billing.next_payment_at ? ` • next billing: ${new Date(billing.next_payment_at).toLocaleDateString("en-GB")}` : ""}
                </p>
              ) : (
                <p className="text-sm font-bold text-zinc-400">Create your provider profile to continue to Direct Debit setup.</p>
              )}
            </div>
          </div>
        )}

        {role !== "provider" && !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">
            <h2 className="text-2xl font-black">This is a customer account</h2>
            <p className="mt-3 text-zinc-400">Use a provider account to access this dashboard.</p>
            <a href="/providers" className="mt-6 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Browse Providers</a>
          </div>
        ) : !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">WELCOME TO RYDAH</p>
            <h2 className="mt-2 text-3xl font-black">Set up your provider profile</h2>
            <form onSubmit={createProviderProfile} className="mt-7 grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm font-bold">Business name</span>
                <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Service category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">{categories.map((item) => <option key={item}>{item}</option>)}</select>
                <a href="/provider-interest" className="mt-2 inline-block text-xs font-bold text-[#D4AF37]">Profession not listed? Register it for review →</a>
              </label>
              <label className="block">
                <span className="text-sm font-bold">Location</span>
                <select
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setGpsMessage("");
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                >
                  {locations.map((item) => <option key={item}>{item}</option>)}
                </select>
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={() => void updateProviderGps()}
                  className="mt-2 rounded-xl border border-[#D4AF37]/35 px-3 py-2 text-xs font-black text-[#E5C65A] disabled:opacity-40"
                >
                  {gpsBusy ? "Finding GPS…" : "📍 Detect Service Area"}
                </button>
                {gpsMessage && <span className="mt-2 block text-xs leading-5 text-emerald-300">{gpsMessage}</span>}
              </label>
              <label className="block">
                <span className="text-sm font-bold">Starting price (₦)</span>
                <input required min="1" type="number" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-bold">About your service</span>
                <textarea required minLength={20} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                <span className="mt-2 block text-xs text-zinc-500">Do not include phone numbers, email addresses, WhatsApp details or external links. Customers should book through Rydah.</span>
              </label>
              <button
                disabled={savingProfile || !billing || !["paid", "waived"].includes(billing.registration_status)}
                className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50"
              >
                {!billing || !["paid", "waived"].includes(billing.registration_status) ? "Pay Registration Fee First" : "Create Provider Profile"}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{provider.business_name}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${biometricStatus === "verified" ? "bg-emerald-500/15 text-emerald-400" : provider.is_verified ? "bg-amber-500/15 text-amber-300" : "bg-zinc-800 text-zinc-400"}`}>{biometricStatus === "verified" ? "✓ BIOMETRIC VERIFIED" : provider.is_verified ? "ID REVIEWED • BIOMETRIC REQUIRED" : "VERIFICATION PENDING"}</span>
                    </div>
                    <p className="mt-2 text-zinc-400">{provider.service_category} • {provider.location}</p>
                    {provider.description && <p className="mt-4 text-sm leading-6 text-zinc-400">{provider.description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={gpsBusy}
                        onClick={() => void updateProviderGps()}
                        className="rounded-xl border border-[#D4AF37]/35 px-3 py-2 text-xs font-black text-[#E5C65A] disabled:opacity-40"
                      >
                        {gpsBusy ? "Finding GPS…" : "📍 Update Area from GPS"}
                      </button>
                      <a href="/provider-interest" className="text-sm font-bold text-[#D4AF37]">Offer another profession →</a>
                    </div>
                    {gpsMessage && <p className="mt-2 text-xs leading-5 text-emerald-300">{gpsMessage}</p>}
                  </div>
                  <button
                    disabled={savingProfile || (!provider.is_available && !billing?.billing_ready)}
                    onClick={() => void toggleAvailability()}
                    className={`rounded-2xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${provider.is_available ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}
                  >
                    {provider.is_available ? "● Available now" : billing?.billing_ready ? "○ Offline" : "Billing required"}
                  </button>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Starting price</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(provider.starting_price)}</p>
                <p className="mt-4 text-sm text-zinc-500">Active jobs: <span className="font-black text-white">{openJobs}</span></p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5 text-sm leading-6 text-zinc-300">
              <strong className="text-[#D4AF37]">Keep Rydah jobs on-platform.</strong> Customer phone, email and private job GPS coordinates are released only after the customer accepts your quote. Direct provider access to hidden contact or GPS fields is blocked by the Rydah backend, not just hidden on screen.
            </div>

            <div className="mt-6">
              <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">CUSTOMER REQUESTS</p>
              <h2 className="mt-1 text-3xl font-black">Jobs assigned to you</h2>

              {jobs.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No assigned jobs yet.</div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {jobs.map((job) => {
                    const busy = savingJobId === job.id;
                    const quoteEditable = ["open", "matched", "accepted"].includes(job.status) && job.payment_status !== "paid";
                    const contactReleased = job.quote_status === "accepted" && ["accepted", "in_progress", "completed"].includes(job.status);
                    const pinVerified = Boolean(job.arrival_verified_at);
                    const faceVerified = Boolean(job.arrival_face_verified_at);
                    const biometricReady = biometricStatus === "verified";
                    const canStart = job.status === "accepted" && job.quote_status === "accepted" && pinVerified && (!biometricWorkRequired || biometricReady) && (!biometricArrivalRequired || faceVerified);
                    const needsArrivalPin = job.status === "accepted" && job.quote_status === "accepted" && !pinVerified;
                    const needsArrivalFace = job.status === "accepted" && job.quote_status === "accepted" && pinVerified && biometricArrivalRequired && !faceVerified;
                    return (
                      <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-black">{job.service_category}</h3>
                              {job.is_urgent && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                              <span className="rounded-full bg-[#D4AF37]/10 px-3 py-1 text-xs font-black text-[#D4AF37]">{label(job.status)}</span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-500">{job.location} • {new Date(job.created_at).toLocaleString()}</p>
                          </div>
                        </div>

                        <p className="mt-4 leading-7 text-zinc-300">{job.description}</p>

                        <div className="mt-5 grid gap-3 rounded-2xl bg-[#1A1A1A] p-4 text-sm sm:grid-cols-3">
                          <div><p className="text-zinc-500">Customer</p><p className="mt-1 font-bold">{job.contact_name || "Not provided"}</p></div>
                          <div><p className="text-zinc-500">Phone</p><p className="mt-1 font-bold">{contactReleased ? (job.contact_phone || "Not provided") : "Released after quote acceptance"}</p></div>
                          <div><p className="text-zinc-500">Email</p><p className="mt-1 break-all font-bold">{contactReleased ? (job.contact_email || "Not provided") : "Released after quote acceptance"}</p></div>
                        </div>

                        {contactReleased && job.latitude != null && job.longitude != null && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="font-black text-emerald-300">📍 Customer GPS available</p>
                              <p className="mt-1 text-xs leading-5 text-zinc-400">
                                Shared for this accepted job only
                                {job.location_accuracy_m != null ? ` • accuracy about ${Math.round(job.location_accuracy_m)} m` : ""}.
                              </p>
                            </div>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${job.latitude},${job.longitude}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-xs font-black text-black"
                            >
                              Open GPS Directions
                            </a>
                          </div>
                        )}

                        {quoteEditable && (
                          <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="min-w-0 flex-1">
                                <span className="text-sm font-black text-[#D4AF37]">JOB QUOTE (₦)</span>
                                <input type="number" min="1" step="1" value={quoteDrafts[job.id] ?? ""} onChange={(e) => setQuoteDrafts((current) => ({ ...current, [job.id]: e.target.value }))} placeholder="Enter agreed amount" className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 outline-none" />
                              </label>
                              <button disabled={busy} onClick={() => void sendQuote(job)} className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">{job.quoted_amount ? "Update Quote" : "Send Quote"}</button>
                            </div>
                            <p className="mt-3 text-sm text-zinc-400">Current quote: <span className="font-black text-white">{naira(job.quoted_amount)}</span> • Customer status: <span className="font-black text-[#D4AF37]">{label(job.quote_status)}</span></p>
                            {job.quote_status === "pending" && <p className="mt-2 text-xs text-zinc-500">Wait for the customer to accept before starting work.</p>}
                            {job.quote_status === "rejected" && <p className="mt-2 text-xs text-amber-300">The customer rejected this quote. Enter a revised amount and send again.</p>}
                          </div>
                        )}

                        {needsArrivalPin && (
                          <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                            <p className="text-sm font-black text-[#D4AF37]">ARRIVAL PIN REQUIRED</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">When you are physically with the customer, ask them to open My Jobs or Safety Check and generate their one-time 6-digit Arrival PIN. Enter it below before starting work.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={arrivalCodes[job.id] ?? ""} onChange={(e) => setArrivalCodes((current) => ({ ...current, [job.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit PIN" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-center text-lg font-black tracking-[0.18em] outline-none" />
                              <button disabled={busy || (arrivalCodes[job.id] || "").length !== 6} onClick={() => void verifyArrivalPin(job)} className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">Verify Arrival</button>
                            </div>
                          </div>
                        )}

                        {job.status === "accepted" && job.quote_status === "accepted" && biometricWorkRequired && !biometricReady && (
                          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
                            <p className="text-sm font-black text-amber-300">BIOMETRIC VERIFICATION REQUIRED</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">Rydah now requires successful face and liveness verification before providers can accept or work on jobs. Complete verification before this job can start.</p>
                            <a href="/provider-onboarding" className="mt-4 inline-block rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black">Complete Biometric Verification</a>
                          </div>
                        )}

                        {needsArrivalFace && (
                          <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
                            <p className="text-sm font-black text-blue-300">CAMERA FACE MATCH REQUIRED</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">Arrival PIN passed. Ask the customer to open Safety Check and complete the provider camera face match. The Start Job button unlocks only after Rydah records a successful match.</p>
                          </div>
                        )}

                        {pinVerified && job.status === "accepted" && !needsArrivalFace && (!biometricWorkRequired || biometricReady) && (
                          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">✓ Arrival safety checks complete. You may start the job.</div>
                        )}

                        {pinVerified && job.status === "accepted" && biometricWorkRequired && !biometricReady && (
                          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">Arrival PIN verified, but work cannot start until biometric verification is successfully completed.</div>
                        )}

                        {faceVerified && (
                          <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">✓ Provider camera face matched for this arrival.</div>
                        )}

                        {!['completed', 'cancelled'].includes(job.status) && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {['open', 'matched'].includes(job.status) && <button disabled={busy} onClick={() => void updateJobStatus(job, 'accepted')} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-50">Accept Job</button>}
                            {job.status === 'accepted' && job.quote_status !== 'accepted' && <span className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400">Customer must accept your quote before work starts</span>}
                            {canStart && <button disabled={busy} onClick={() => void updateJobStatus(job, 'in_progress')} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-50">Start Job</button>}
                            {job.status === 'in_progress' && <button disabled={busy} onClick={() => void updateJobStatus(job, 'completed')} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black disabled:opacity-50">Mark Completed</button>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
