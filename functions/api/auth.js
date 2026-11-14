const passwordVariableByMode = { startup: "PASSWORD", admin: "ADMIN_PASSWORD" };
const startupCookieName = "__Host-study_quiz_access";
const startupCookieLifetimeSeconds = 30 * 24 * 60 * 60;
const tokenVersion = 1;
const encoder = new TextEncoder();

const json = (body, init = {}) => Response.json(body, { ...init, headers: {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  ...init.headers,
} });

const toBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const sign = async (value, secret) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};

const constantTimeEqual = (left, right) => {
  const leftBytes = encoder.encode(String(left));
  const rightBytes = encoder.encode(String(right));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
};

const readCookie = (request, name) => {
  for (const entry of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = entry.indexOf("=");
    if (separator >= 0 && entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
};

const createStartupToken = async (password) => {
  const expiresAt = Math.floor(Date.now() / 1000) + startupCookieLifetimeSeconds;
  const payload = `${tokenVersion}.${expiresAt}`;
  return `${payload}.${await sign(payload, password)}`;
};

const hasValidStartupToken = async (request, password) => {
  if (!password) return false;
  const token = readCookie(request, startupCookieName);
  if (!token) return false;
  const [version, expiresAtText, signature, ...extra] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (extra.length || version !== String(tokenVersion) || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(signature, await sign(`${version}.${expiresAtText}`, password));
};

export async function onRequestGet({ request, env }) {
  if (typeof env.PASSWORD !== "string" || !env.PASSWORD) return json({ ok: false, error: "PASSWORD_NOT_CONFIGURED" }, { status: 500 });
  const authenticated = await hasValidStartupToken(request, env.PASSWORD);
  return json({ ok: true, authenticated }, { headers: { Vary: "Cookie" } });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); } catch { return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 }); }
  const passwordVariableName = passwordVariableByMode[payload?.mode];
  if (!passwordVariableName) return json({ ok: false, error: "INVALID_AUTH_MODE" }, { status: 400 });
  const expectedPassword = env[passwordVariableName] ?? "";
  if (!expectedPassword) return json({ ok: false, error: `${passwordVariableName}_NOT_CONFIGURED` }, { status: 500 });
  if (!constantTimeEqual(payload?.password ?? "", expectedPassword)) return json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 });
  if (payload.mode !== "startup") return json({ ok: true });
  const token = await createStartupToken(expectedPassword);
  const cookie = `${startupCookieName}=${token}; Path=/; Max-Age=${startupCookieLifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`;
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
