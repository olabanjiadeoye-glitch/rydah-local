import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261013010000_persist_arrival_pin_failed_attempts.sql", "utf8");
const ui = readFileSync("src/app/provider-dashboard/page.tsx", "utf8");

test("incorrect arrival PIN persists attempt and returns false without exception rollback", () => {
  const branch = sql.match(/if encode\(extensions\.digest\(clean_code, 'sha256'\), 'hex'\) <> j\.arrival_code_hash then([\s\S]*?)end if;/i)?.[1];
  assert.ok(branch, "incorrect PIN branch must exist");
  assert.match(branch, /set arrival_attempts\s*=\s*coalesce\(arrival_attempts, 0\) \+ 1/i);
  assert.match(branch, /return false\s*;/i);
  assert.doesNotMatch(branch, /raise exception/i);
});

test("provider security, expiry and lockout gates remain present", () => {
  for (const gate of ["p.user_id = actor", "p.is_verified = true", "p.biometric_verified = true", "private.provider_billing_active(p.id)", "j.arrival_code_expires_at < now()", "j.arrival_attempts >= 5", "for update"]) {
    assert.ok(sql.toLowerCase().includes(gate.toLowerCase()), "missing safeguard: " + gate);
  }
});

test("provider dashboard checks RPC false before showing success", () => {
  const start = ui.indexOf('const verified = await restRpc<boolean>("verify_job_arrival"');
  assert.ok(start >= 0, "RPC result must be captured");
  const end = ui.indexOf("setMessage(biometricArrivalRequired", start);
  assert.ok(end > start);
  const section = ui.slice(start, end);
  assert.match(section, /if \(!verified\)\s*\{[\s\S]*?setError\([\s\S]*?return;/);
});
