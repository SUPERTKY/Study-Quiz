const passwordVariableByMode = {
  startup: "PASSWORD",
  admin: "ADMIN_PASSWORD",
};

const getPasswordVariableName = (mode) => passwordVariableByMode[mode] ?? null;

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const passwordVariableName = getPasswordVariableName(payload?.mode);
  if (!passwordVariableName) {
    return Response.json({ ok: false, error: "INVALID_AUTH_MODE" }, { status: 400 });
  }

  const expectedPassword = env[passwordVariableName] ?? "";
  if (!expectedPassword) {
    return Response.json({ ok: false, error: `${passwordVariableName}_NOT_CONFIGURED` }, { status: 500 });
  }

  if (payload?.password !== expectedPassword) {
    return Response.json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
