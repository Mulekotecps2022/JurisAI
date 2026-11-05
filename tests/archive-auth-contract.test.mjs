import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("archive endpoint requires authenticated owner and never deletes a case", async () => {
  const route = await read("../src/app/api/processos/[caseId]/arquivamento/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /\.eq\("owner_user_id", auth\.user\.id\)/);
  assert.match(route, /\.update\(\{ archived_at:/);
  assert.doesNotMatch(route, /\.delete\(/);
});

test("confirmation endpoint exchanges a valid PKCE code and rejects missing codes", async () => {
  const callback = await read("../src/app/auth/confirm/route.ts");
  assert.match(callback, /searchParams\.get\("code"\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /error=missing_code/);
});

test("preview login uses one canonical callback origin", async () => {
  const login = await read("../src/app/login/page.tsx");
  assert.match(login, /NEXT_PUBLIC_APP_URL/);
  assert.match(login, /emailRedirectTo: callbackUrl\.toString\(\)/);
  assert.match(login, /shouldCreateUser: false/);
});

test("email confirmation supports token-hash links without a PKCE browser verifier", async () => {
  const callback = await read("../src/app/auth/confirm/route.ts");
  assert.match(callback, /searchParams\.get\("token_hash"\)/);
  assert.match(callback, /tokenType !== "email"/);
  assert.match(callback, /auth\.verifyOtp\(\{ token_hash: tokenHash!, type: "email" \}\)/);
  assert.match(callback, /auth\.exchangeCodeForSession\(code\)/);
  assert.match(callback, /candidateUrl\.origin === appUrl\.origin/);
});

test("email OTP form verifies eight-digit codes without creating public users", async () => {
  const login = await read("../src/app/login/page.tsx");
  assert.ok(login.includes("auth.verifyOtp({"));
  assert.ok(login.includes("token: otp"));
  assert.ok(login.includes('type: "email"'));
  assert.ok(login.includes("otp.length !== 8"));
  assert.ok(login.includes("pattern=\"[0-9]{8}\""));
  assert.ok(login.includes("shouldCreateUser: false"));
  assert.ok(login.includes("window.location.assign(safeNext)"));
});


test("person creation rejects repeated identical owner records and locks rapid resubmission", async () => {
  const route = await read("../src/app/api/pessoas/route.ts");
  const workspace = await read("../src/features/workspace/workspace.tsx");
  assert.ok(route.includes('.eq("created_by_user_id", user.id)'));
  assert.ok(route.includes('.eq("name", parsed.data.name)'));
  assert.ok(route.includes('if (isDuplicate) return errorResponse('));
  assert.ok(route.includes('409)'));
  assert.ok(workspace.includes('if(savingPersonRef.current) return;'));
  assert.ok(workspace.includes('disabled={savingPerson}'));
});
