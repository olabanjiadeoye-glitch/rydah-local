import { NextRequest, NextResponse } from "next/server";

const SYSTEM_GUIDANCE = `You are Rydah Care, the customer-care assistant for Rydah Local, a Nigerian local-services marketplace targeting Lagos, Abuja, Ibadan, Warri and Port Harcourt.

Current product rules you must follow:
- Rydah connects customers with verified local service providers.
- Target launch cities are Lagos, Abuja, Ibadan, Warri and Port Harcourt. Booking availability still depends on verified provider supply in the selected service area.
- Current core launch services include Electrician, Plumber, AC Technician, Generator, Cleaning and Mechanic. Providers can register interest in additional genuine professions for review.
- Customers should keep bookings, quotes and payments inside Rydah. Never encourage exchanging WhatsApp, phone, email or external-payment details to bypass Rydah.
- Rydah currently charges providers a 15% platform commission on jobs. The agreed job price is the customer total; there is currently no extra customer Rydah fee.
- Paystack is the preferred secure payment method. Cash is only available for eligible jobs up to ₦5,000, and provider commission remains owed to Rydah on cash jobs.
- Before work starts, customers can use the Arrival PIN safety check. Where the provider has completed biometric enrolment, Rydah can also require a camera face match.
- Rydah is not an emergency service. For danger, fire, violence, medical emergencies or immediate threats, tell the customer to contact the appropriate emergency service.
- Never ask a customer for a password, one-time password, full card number, CVV, PIN, API key, NIN, passport number or other secret in chat.
- Do not promise refunds, compensation, provider availability or identity verification unless the app shows it. Explain the next step instead.
- For account-specific disputes, payment problems, identity concerns or complaints that need staff review, direct the user to Support or admin@rydahlocal.online.
- Keep replies concise, practical and friendly. Use Nigerian naira formatting where relevant.`;

type AssistantBody = {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

function localAnswer(message: string) {
  const q = message.toLowerCase();

  if (/emergency|fire|ambulance|police|danger|attack|bleeding|unconscious/.test(q)) {
    return "Rydah Local is not an emergency service. If anyone is in immediate danger or needs urgent medical, fire or police help, contact the appropriate emergency service now. For a non-emergency repair, I can help you post an urgent Rydah job.";
  }
  if (/pay|payment|paystack|cash|card|commission|fee/.test(q)) {
    return "Paystack is Rydah’s preferred secure payment route. The provider quote is the customer’s agreed job price, and Rydah currently deducts a 15% commission from provider earnings. Cash is only available on eligible jobs up to ₦5,000. Keep payment inside the Rydah flow so your booking and payment record remain protected.";
  }
  if (/safe|safety|verify|verified|arrival|pin|face|identity/.test(q)) {
    return "Use providers showing the Rydah Verified badge. After a quote is accepted and the provider arrives, use the one-time Arrival PIN before work starts. Where biometric enrolment is available, Rydah can also compare the provider’s live camera image with the verified identity record.";
  }
  if (/provider|professional|electrician|plumber|clean|mechanic|generator|ac/.test(q)) {
    return "I can help you find a provider. Tap “Find a Provider” to browse verified professionals, or “Post a Job” and Rydah will match an available verified provider for your service and area.";
  }
  if (/profession|trade|not listed|join|become|work on rydah|service provider/.test(q)) {
    return "Service providers can create a Provider account and complete verification. If your profession is not one of the launch categories, use “Add Your Profession” in the provider area to register your trade and service area for Rydah review.";
  }
  if (/cancel|cancellation/.test(q)) {
    return "Customers can cancel eligible jobs before work starts from My Jobs. Once work has started, contact Rydah Support if you need help resolving a problem.";
  }
  if (/support|human|complaint|dispute|refund|problem/.test(q)) {
    return "For something that needs a person to review your account, payment or complaint, open Support or email admin@rydahlocal.online. Don’t send passwords, OTPs, card PINs or identity numbers in chat.";
  }
  if (/where|area|location|lagos|lekki|ikeja|victoria|abuja|wuse|garki|maitama|gwarinpa|jabi|kubwa|lugbe|ibadan|bodija|dugbe|challenge|akobo|mokola|apata|ring road/.test(q)) {
    return "Rydah Local targets Lagos, Abuja, Ibadan, Warri and Port Harcourt. Core service areas are available in each city, while actual booking availability depends on biometrically verified providers being active in the selected area.";
  }

  return "I can help with finding a provider, posting a job, payments, safety checks, cancellations, provider registration or support. Tell me what you need done and your area in Lagos, Abuja, Ibadan, Warri or Port Harcourt, and I’ll point you to the right Rydah step.";
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssistantBody;
    const message = String(body.message || "").trim().slice(0, 800);
    if (!message) return NextResponse.json({ error: "Enter a question for Rydah Care." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: localAnswer(message), mode: "guided" });
    }

    const recentHistory = (body.history || []).slice(-6).map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 800),
    }));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: SYSTEM_GUIDANCE,
        input: [...recentHistory, { role: "user", content: message }],
        max_output_tokens: 350,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return NextResponse.json({ reply: localAnswer(message), mode: "guided" });
    }

    const payload = await response.json();
    const reply = extractResponseText(payload) || localAnswer(message);
    return NextResponse.json({ reply, mode: "ai" });
  } catch {
    return NextResponse.json({ reply: "I can still help with providers, jobs, payments, safety or support. Please try your question again in a shorter sentence.", mode: "guided" });
  }
}
