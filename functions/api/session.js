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
  waitingPlayers: Array.isArray(session?.waitingPlayers)
    ? session.waitingPlayers
        .filter((player) => player?.id)
        .map((player) => ({
          id: String(player.id),
          joinedAt: Number.isFinite(player.joinedAt) ? player.joinedAt : 0,
          tournamentId: Number.isInteger(player.tournamentId) ? player.tournamentId : session?.tournamentId,
          round: Number.isInteger(player.round) ? player.round : session?.round,
        }))
    : [],
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

const maxHp = 120;

const randomId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const isCurrentRoundPlayer = (session, player) =>
  player?.id && player.tournamentId === session.tournamentId && player.round === session.round;

const isCurrentRoundMatch = (session, match) =>
  match &&
  match.tournamentId === session.tournamentId &&
  match.round === session.round &&
  match.finished !== true;

const pruneCurrentRoundWaitingPlayers = (session, playerIdToExclude = "") => {
  const uniquePlayers = new Map();
  session.waitingPlayers
    .filter((player) => isCurrentRoundPlayer(session, player) && player.id !== playerIdToExclude)
    .forEach((player) => uniquePlayers.set(player.id, player));
  session.waitingPlayers = Array.from(uniquePlayers.values());
};

const createMatch = (session, playerId, opponentId) => {
  const firstPlayerId = Math.random() < 0.5 ? playerId : opponentId;
  const match = {
    id: randomId(),
    tournamentId: session.tournamentId,
    round: session.round,
    playerIds: [playerId, opponentId],
    firstPlayerId,
    turnPlayerId: firstPlayerId,
    version: 0,
    finished: false,
    winnerPlayerId: null,
    loserPlayerId: null,
    hpByPlayerId: { [playerId]: maxHp, [opponentId]: maxHp },
    guardByPlayerId: { [playerId]: 0, [opponentId]: 0 },
    cooldownsByPlayerId: {
      [playerId]: { recover: 0, guard: 0, burst: 0 },
      [opponentId]: { recover: 0, guard: 0, burst: 0 },
    },
    lastAction: null,
    processedActionIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  session.matches[match.id] = match;
  return match;
};

const getOpponentId = (match, playerId) => match.playerIds.find((id) => id !== playerId);

const normalizeNumber = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

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
    pruneCurrentRoundWaitingPlayers(session, playerId);
    const existingMatch = Object.values(session.matches).find((match) => isCurrentRoundMatch(session, match) && match.playerIds?.includes(playerId));
    if (existingMatch) {
      return json({ ...session, matchStatus: "matched", match: existingMatch });
    }

    const otherPlayers = session.waitingPlayers.filter((player) => isCurrentRoundPlayer(session, player) && player.id !== playerId);
    if (otherPlayers.length > 0) {
      const opponent = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      session.waitingPlayers = session.waitingPlayers.filter((player) => player.id !== playerId && player.id !== opponent.id);
      const match = createMatch(session, playerId, opponent.id);
      return json({ ...(await writeSession(env, session)), matchStatus: "matched", match });
    }

    session.waitingPlayers = [
      ...session.waitingPlayers.filter((player) => isCurrentRoundPlayer(session, player) && player.id !== playerId),
      { id: playerId, joinedAt: Date.now(), tournamentId: session.tournamentId, round: session.round },
    ];
    return json({ ...(await writeSession(env, session)), matchStatus: "waiting" });
  }


  if (action === "getMatch") {
    const playerId = String(payload?.playerId ?? "");
    const matchId = String(payload?.matchId ?? "");
    const match = session.matches[matchId] ?? Object.values(session.matches).find((item) => item.playerIds?.includes(playerId) && !item.finished);
    return json({ ...session, matchStatus: match ? "matched" : "missing", match });
  }

  if (action === "submitSkill") {
    const playerId = String(payload?.playerId ?? "");
    const matchId = String(payload?.matchId ?? "");
    const match = session.matches[matchId];
    if (!match || !match.playerIds?.includes(playerId)) {
      return json({ ...session, matchStatus: "missing" }, { status: 404 });
    }
    const actionId = String(payload?.actionId ?? "");
    if (actionId && match.processedActionIds?.includes(actionId)) {
      return json({ ...session, matchStatus: match.finished ? "finished" : "matched", match });
    }
    if (match.finished) {
      return json({ ...session, matchStatus: "finished", match });
    }
    if (Number.isInteger(payload?.expectedVersion) && payload.expectedVersion !== match.version) {
      return json({ ...session, matchStatus: "versionMismatch", match }, { status: 409 });
    }
    if (match.turnPlayerId !== playerId) {
      return json({ ...session, matchStatus: "notYourTurn", match }, { status: 409 });
    }

    const opponentId = getOpponentId(match, playerId);
    const skillType = payload?.skillType === "recover" || payload?.skillType === "guard" ? payload.skillType : "damage";
    const skillKey = String(payload?.skillKey ?? "attack");
    const effectValue = Math.max(0, Math.round(normalizeNumber(payload?.effectValue)));
    const guardReduction = Math.max(0, Math.min(60, Math.round(normalizeNumber(payload?.guardReduction))));
    const cooldownTurns = Math.max(0, Math.round(normalizeNumber(payload?.cooldownTurns)));
    const correct = Math.max(0, Math.round(normalizeNumber(payload?.correct)));
    const wrong = Math.max(0, Math.round(normalizeNumber(payload?.wrong)));

    match.hpByPlayerId[playerId] ??= maxHp;
    match.hpByPlayerId[opponentId] ??= maxHp;
    match.guardByPlayerId[playerId] ??= 0;
    match.guardByPlayerId[opponentId] ??= 0;
    match.cooldownsByPlayerId[playerId] ??= { recover: 0, guard: 0, burst: 0 };

    if (skillType === "damage") {
      const reducedDamage = Math.max(0, Math.round(effectValue * (1 - (match.guardByPlayerId[opponentId] ?? 0) / 100)));
      match.hpByPlayerId[opponentId] = Math.max(0, match.hpByPlayerId[opponentId] - reducedDamage);
      match.guardByPlayerId[opponentId] = 0;
      match.lastAction = { playerId, skillKey, skillType, effectValue: reducedDamage, correct, wrong, at: Date.now() };
    }
    if (skillType === "recover") {
      const beforeHp = match.hpByPlayerId[playerId];
      match.hpByPlayerId[playerId] = Math.min(maxHp, match.hpByPlayerId[playerId] + effectValue);
      match.lastAction = { playerId, skillKey, skillType, effectValue: match.hpByPlayerId[playerId] - beforeHp, correct, wrong, at: Date.now() };
    }
    if (skillType === "guard") {
      match.guardByPlayerId[playerId] = guardReduction;
      match.lastAction = { playerId, skillKey, skillType, effectValue: guardReduction, correct, wrong, at: Date.now() };
    }

    if (cooldownTurns > 0) {
      match.cooldownsByPlayerId[playerId][skillKey] = cooldownTurns + 1;
    }

    if (match.hpByPlayerId[opponentId] <= 0) {
      match.finished = true;
      match.winnerPlayerId = playerId;
      match.loserPlayerId = opponentId;
      if (!session.eliminatedPlayerIds.includes(opponentId)) {
        session.eliminatedPlayerIds.push(opponentId);
      }
    } else {
      match.cooldownsByPlayerId[opponentId] ??= { recover: 0, guard: 0, burst: 0 };
      Object.keys(match.cooldownsByPlayerId[opponentId]).forEach((key) => {
        match.cooldownsByPlayerId[opponentId][key] = Math.max(0, match.cooldownsByPlayerId[opponentId][key] - 1);
      });
      match.turnPlayerId = opponentId;
    }
    if (actionId) {
      match.processedActionIds = [...(match.processedActionIds ?? []), actionId].slice(-40);
    }
    match.version += 1;
    match.updatedAt = Date.now();
    return json({ ...(await writeSession(env, session)), matchStatus: match.finished ? "finished" : "matched", match });
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

  if (action === "resetTournamentNumber") {
    session.tournamentId = 0;
    session.round = 0;
    session.closingRound = false;
    session.eliminatedPlayerIds = [];
    session.waitingPlayers = [];
    session.matches = {};
    return json(await writeSession(env, session));
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
