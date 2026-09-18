import { NextResponse } from "next/server";

const PACKAGE_NAME = "online.rydahlocal.app";

function normalizeFingerprint(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .match(/.{1,2}/g)
    ?.join(":") ?? "";
}

export function GET() {
  const raw = process.env.ANDROID_APP_SHA256_FINGERPRINT ?? "";
  const fingerprint = normalizeFingerprint(raw);

  if (!fingerprint || fingerprint.split(":").length !== 32) {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
