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
