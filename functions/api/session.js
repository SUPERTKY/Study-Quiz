const sessionKey = "current";
const validSubjectKeys = new Set(["math", "japanese", "english", "science", "social"]);

const defaultSession = {
  hosted: false,
  selectedSubjectKey: "math",
  tournamentId: 0,
  round: 0,
  closingRound: false,
  eliminatedPlayerIds: [],
  waitingPlayers: [],
  matches: {},
};

let memorySession = defaultSession;

const json = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...init.headers,
    },
  });

const getSessionStore = (env) => env.GAME_SESSION_KV ?? env.GAME_SESSION;

const normalizeSession = (session) => ({
  hosted: session?.hosted === true,
  selectedSubjectKey: validSubjectKeys.has(session?.selectedSubjectKey) ? session.selectedSubjectKey : "math",
  tournamentId: Number.isInteger(session?.tournamentId) ? session.tournamentId : 0,
  round: Number.isInteger(session?.round) ? session.round : 0,
  closingRound: session?.closingRound === true,
  eliminatedPlayerIds: Array.isArray(session?.eliminatedPlayerIds) ? session.eliminatedPlayerIds.filter(Boolean) : [],
  waitingPlayers: Array.isArray(session?.waitingPlayers) ? session.waitingPlayers.filter((player) => player?.id) : [],
  matches: session?.matches && typeof session.matches === "object" ? session.matches : {},
});

const readSession = async (env) => {
  const store = getSessionStore(env);
  if (!store) {
    return memorySession;
  }

  const savedSession = await store.get(sessionKey, "json");
  return normalizeSession(savedSession);
};

const writeSession = async (env, session) => {
  const nextSession = normalizeSession(session);
  const store = getSessionStore(env);
  if (store) {
    await store.put(sessionKey, JSON.stringify(nextSession));
  } else {
    memorySession = nextSession;
  }
  return nextSession;
};

const randomId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const requireAdmin = (payload, env) => {
  const expectedPassword = env.ADMIN_PASSWORD ?? "";
  if (!expectedPassword) {
    return { ok: false, response: json({ ok: false, error: "ADMIN_PASSWORD_NOT_CONFIGURED" }, { status: 500 }) };
  }

  if (payload?.adminPassword !== expectedPassword) {
    return { ok: false, response: json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 }) };
  }

  return { ok: true };
};

export async function onRequestGet({ env }) {
  return json(await readSession(env));
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const action = payload?.action ?? "adminSave";
  const session = await readSession(env);

  if (action === "joinMatch") {
    const playerId = String(payload?.playerId ?? "");
    if (!session.hosted) {
      return json({ ...session, matchStatus: "closed" });
    }
    if (session.eliminatedPlayerIds.includes(playerId)) {
      return json({ ...session, matchStatus: "eliminated" });
    }
    const existingMatch = Object.values(session.matches).find((match) => match.playerIds?.includes(playerId) && !match.finished);
    if (existingMatch) {
      return json({ ...session, matchStatus: "matched", match: existingMatch });
    }

    const otherPlayers = session.waitingPlayers.filter((player) => player.id !== playerId);
    if (otherPlayers.length > 0) {
      const opponent = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      session.waitingPlayers = session.waitingPlayers.filter((player) => player.id !== playerId && player.id !== opponent.id);
      const firstPlayerId = Math.random() < 0.5 ? playerId : opponent.id;
      const match = {
        id: randomId(),
        round: session.round,
        playerIds: [playerId, opponent.id],
        firstPlayerId,
        finished: false,
        createdAt: Date.now(),
      };
      session.matches[match.id] = match;
      return json({ ...(await writeSession(env, session)), matchStatus: "matched", match });
    }

    session.waitingPlayers = [...session.waitingPlayers.filter((player) => player.id !== playerId), { id: playerId, joinedAt: Date.now() }];
    return json({ ...(await writeSession(env, session)), matchStatus: "waiting" });
  }

  if (action === "finishMatch") {
    const playerId = String(payload?.playerId ?? "");
    const result = payload?.result === "lose" ? "lose" : "win";
    const matchId = String(payload?.matchId ?? "");
    if (session.matches[matchId]) {
      session.matches[matchId].finished = true;
    }
    if (result === "lose" && !session.eliminatedPlayerIds.includes(playerId)) {
      session.eliminatedPlayerIds.push(playerId);
    }
    return json(await writeSession(env, session));
  }

  const adminCheck = requireAdmin(payload, env);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  if (action === "advanceRound") {
    session.closingRound = true;
    const closedSession = await writeSession(env, session);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    closedSession.round += 1;
    closedSession.closingRound = false;
    closedSession.waitingPlayers = [];
    closedSession.matches = {};
    return json(await writeSession(env, closedSession));
  }

  const nextHosted = payload?.hosted === true;
  const nextSession = {
    ...session,
    hosted: nextHosted,
    selectedSubjectKey: validSubjectKeys.has(payload?.selectedSubjectKey) ? payload.selectedSubjectKey : session.selectedSubjectKey,
  };
  if (nextHosted && !session.hosted) {
    nextSession.tournamentId = session.tournamentId + 1;
    nextSession.round = 0;
    nextSession.eliminatedPlayerIds = [];
    nextSession.waitingPlayers = [];
    nextSession.matches = {};
  }
  if (!nextHosted) {
    nextSession.waitingPlayers = [];
    nextSession.matches = {};
    nextSession.closingRound = false;
  }
  return json(await writeSession(env, nextSession));
}
