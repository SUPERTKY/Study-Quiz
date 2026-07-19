const sessionKey = "current";
const validSubjectKeys = new Set(["math", "japanese", "english", "science", "social"]);
const waitingPlayerTimeoutMs = 90000;
// Polling two clients through KV can be delayed or reordered, so keep automatic absence detection conservative.
// Explicit leave signals still resolve immediately, but heartbeat-only ghost cleanup waits long enough to avoid false disconnects.
const matchPlayerTimeoutMs = 20 * 60 * 1000;
const matchHeartbeatTtlSeconds = 60 * 60;
const matchHeartbeatKeyPrefix = "match:";
const kvRealtimeConsistencyWarning =
  "Cloudflare KV is eventually consistent, so rapid match synchronization can be delayed or reordered across clients. Use Durable Objects for reliable real-time battles.";

const defaultSession = {
  hosted: false,
  selectedSubjectKey: "math",
  tournamentId: 0,
  round: 0,
  closingRound: false,
  eliminatedPlayerIds: [],
  waitingPlayers: [],
  matches: {},
  updatedAt: 0,
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

const kvBindingNames = ["GAME_SESSION_KV", "GAME_SESSION"];

class SessionStoreError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "SessionStoreError";
    this.code = code;
  }
}

const isKvStore = (value) => typeof value?.get === "function" && typeof value?.put === "function";

const getConfiguredBindingNames = (env = {}) => kvBindingNames.filter((name) => env[name] !== undefined && env[name] !== null);

const getSessionStores = (env = {}) => {
  const configuredBindingNames = getConfiguredBindingNames(env);
  const stores = configuredBindingNames.filter((name) => isKvStore(env[name])).map((name) => ({ name, store: env[name] }));
  if (stores.length > 0) {
    return stores;
  }

  if (configuredBindingNames.length > 0) {
    throw new SessionStoreError(`${configuredBindingNames[0]}_IS_NOT_KV_BINDING`);
  }
  return [];
};


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
  updatedAt: Number.isFinite(session?.updatedAt) ? session.updatedAt : 0,
});

const readSession = async (env) => {
  let stores;
  try {
    stores = getSessionStores(env);
  } catch {
    return memorySession;
  }
  if (stores.length === 0) {
    return memorySession;
  }

  for (const { store } of stores) {
    try {
      const savedSession = await store.get(sessionKey, "json");
      return normalizeSession(savedSession);
    } catch {
      // Try the next compatible binding before falling back to isolate memory.
    }
  }
  // If KV is temporarily unavailable or contains malformed JSON, keep /api/session usable.
  return memorySession;
};

const writeSession = async (env, session, { requireStoreWrite = false } = {}) => {
  const nextSession = normalizeSession({ ...session, updatedAt: Date.now() });
  let stores;
  try {
    stores = getSessionStores(env);
  } catch (error) {
    if (requireStoreWrite) {
      throw error;
    }
    memorySession = nextSession;
    return nextSession;
  }
  if (stores.length > 0) {
    let lastError;
    for (const { store } of stores) {
      try {
        await store.put(sessionKey, JSON.stringify(nextSession));
        return nextSession;
      } catch (error) {
        lastError = error;
      }
    }
    if (requireStoreWrite) {
      throw new SessionStoreError("GAME_SESSION_KV_WRITE_FAILED", lastError?.message);
    }
    // Fall back to isolate memory instead of surfacing a 500 to clients during a match.
    memorySession = nextSession;
  } else {
    if (requireStoreWrite) {
      throw new SessionStoreError("GAME_SESSION_KV_NOT_CONFIGURED");
    }
    memorySession = nextSession;
  }
  return nextSession;
};


const deleteMatchHeartbeats = async (env, { cursor, limit = 100 } = {}) => {
  let stores;
  try {
    stores = getSessionStores(env);
  } catch {
    return { deletedCount: 0, cursor: undefined, complete: true };
  }

  const safeLimit = Math.max(1, Math.min(100, Math.round(normalizeNumber(limit, 100))));
  for (const { store } of stores) {
    if (!store?.list || !store?.delete) {
      continue;
    }
    try {
      const result = await store.list({ prefix: matchHeartbeatKeyPrefix, cursor, limit: safeLimit });
      const keys = Array.isArray(result?.keys) ? result.keys : [];
      for (const key of keys) {
        await store.delete(key.name);
      }
      return {
        deletedCount: keys.length,
        cursor: result?.list_complete ? undefined : result?.cursor,
        complete: result?.list_complete === true || !result?.cursor,
      };
    } catch {
      // Try the next compatible binding before treating cleanup as incomplete.
    }
  }
  // Cleanup is best-effort; do not block tournament administration if KV listing/deletion fails.
  return { deletedCount: 0, cursor, complete: false };
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

const pruneCurrentRoundWaitingPlayers = (session, playerIdToExclude = "", now = Date.now()) => {
  const uniquePlayers = new Map();
  session.waitingPlayers
    .filter(
      (player) =>
        isCurrentRoundPlayer(session, player) &&
        player.id !== playerIdToExclude &&
        now - player.joinedAt <= waitingPlayerTimeoutMs,
    )
    .forEach((player) => uniquePlayers.set(player.id, player));
  session.waitingPlayers = Array.from(uniquePlayers.values());
};

const getMatchHeartbeatKey = (matchId, playerId) => `${matchHeartbeatKeyPrefix}${matchId}:seen:${playerId}`;

const touchMatchPlayer = (match, playerId, now = Date.now()) => {
  match.lastSeenByPlayerId ??= {};
  match.lastSeenByPlayerId[playerId] = now;
};

const writeMatchHeartbeat = async (env, match, playerId, now = Date.now()) => {
  touchMatchPlayer(match, playerId, now);
  let stores;
  try {
    stores = getSessionStores(env);
  } catch {
    stores = [];
  }
  if (match?.id && playerId) {
    for (const { store } of stores) {
      try {
        await store.put(getMatchHeartbeatKey(match.id, playerId), String(now), { expirationTtl: matchHeartbeatTtlSeconds });
        return;
      } catch {
        // Try the next compatible binding before ignoring this liveness hint.
      }
    }
  }
};

const readMatchHeartbeat = async (env, match, playerId) => {
  let stores;
  try {
    stores = getSessionStores(env);
  } catch {
    stores = [];
  }
  if (stores.length === 0 || !match?.id || !playerId) {
    return match.lastSeenByPlayerId?.[playerId];
  }
  for (const { store } of stores) {
    try {
      const savedValue = await store.get(getMatchHeartbeatKey(match.id, playerId));
      const savedLastSeen = savedValue === null ? NaN : Number(savedValue);
      if (Number.isFinite(savedLastSeen)) {
        return savedLastSeen;
      }
    } catch {
      // Try the next compatible binding before falling back to the session copy.
    }
  }
  return match.lastSeenByPlayerId?.[playerId];
};

const finishMatchByForfeit = (session, match, forfeitingPlayerId, now = Date.now()) => {
  if (!match || match.finished) {
    return match;
  }

  const winnerPlayerId = getOpponentId(match, forfeitingPlayerId);
  match.finished = true;
  match.winnerPlayerId = winnerPlayerId ?? null;
  match.loserPlayerId = forfeitingPlayerId;
  match.disconnectedPlayerId = forfeitingPlayerId;
  match.disconnectReason = "playerForfeited";
  match.version = (Number.isInteger(match.version) ? match.version : 0) + 1;
  match.updatedAt = now;
  if (forfeitingPlayerId && !session.eliminatedPlayerIds.includes(forfeitingPlayerId)) {
    session.eliminatedPlayerIds.push(forfeitingPlayerId);
  }
  return match;
};

const finishMatchIfOpponentTimedOut = async (env, session, match, playerId, now = Date.now()) => {
  const allPlayersAcknowledged = match.playerIds?.every((id) => match.acknowledgedByPlayerId?.[id] === true);
  if (!allPlayersAcknowledged) {
    return match;
  }

  const opponentId = getOpponentId(match, playerId);
  const opponentLastSeen = (await readMatchHeartbeat(env, match, opponentId)) ?? match.updatedAt ?? match.createdAt ?? now;
  if (now - opponentLastSeen > matchPlayerTimeoutMs) {
    finishMatchByForfeit(session, match, opponentId, now);
  }
  return match;
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
    acknowledgedByPlayerId: { [playerId]: true, [opponentId]: false },
    processedActionIds: [],
    createdAt: Date.now(),
    lastSeenByPlayerId: { [playerId]: Date.now(), [opponentId]: Date.now() },
    updatedAt: Date.now(),
  };
  session.matches[match.id] = match;
  return match;
};

const getOpponentId = (match, playerId) => match.playerIds.find((id) => id !== playerId);

const normalizeNumber = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const requireAdmin = (payload, env = {}) => {
  const expectedPassword = env.ADMIN_PASSWORD ?? "";
  if (!expectedPassword) {
    return { ok: false, response: json({ ok: false, error: "ADMIN_PASSWORD_NOT_CONFIGURED" }, { status: 400 }) };
  }

  if (payload?.adminPassword !== expectedPassword) {
    return { ok: false, response: json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 }) };
  }

  return { ok: true };
};

export async function onRequestGet({ env }) {
  return json(await readSession(env));
}

const handlePost = async ({ request, env }) => {
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
    const now = Date.now();
    if (!playerId) {
      return json({ ...session, matchStatus: "missing" }, { status: 400 });
    }
    if (!session.hosted) {
      return json({ ...session, matchStatus: "closed" });
    }
    if (session.eliminatedPlayerIds.includes(playerId)) {
      return json({ ...session, matchStatus: "eliminated" });
    }
    pruneCurrentRoundWaitingPlayers(session, playerId, now);
    const existingMatch = Object.values(session.matches).find((match) => isCurrentRoundMatch(session, match) && match.playerIds?.includes(playerId));
    if (existingMatch) {
      existingMatch.acknowledgedByPlayerId ??= Object.fromEntries(existingMatch.playerIds.map((id) => [id, false]));
      existingMatch.acknowledgedByPlayerId[playerId] = true;
      const allPlayersAcknowledged = existingMatch.playerIds.every((id) => existingMatch.acknowledgedByPlayerId?.[id] === true);
      if (allPlayersAcknowledged) {
        existingMatch.updatedAt = now;
        return json({ ...(await writeSession(env, session)), matchStatus: "matched", match: existingMatch });
      }
      return json({ ...(await writeSession(env, session)), matchStatus: "matchedPending", match: existingMatch });
    }

    const otherPlayers = session.waitingPlayers.filter((player) => isCurrentRoundPlayer(session, player) && player.id !== playerId);
    if (otherPlayers.length > 0) {
      const opponent = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      session.waitingPlayers = session.waitingPlayers.filter((player) => player.id !== playerId && player.id !== opponent.id);
      const match = createMatch(session, playerId, opponent.id);
      return json({ ...(await writeSession(env, session)), matchStatus: "matchedPending", match });
    }

    session.waitingPlayers = [
      ...session.waitingPlayers.filter((player) => isCurrentRoundPlayer(session, player) && player.id !== playerId),
      { id: playerId, joinedAt: now, tournamentId: session.tournamentId, round: session.round },
    ];
    return json({ ...(await writeSession(env, session)), matchStatus: "waiting" });
  }


  if (action === "getMatch") {
    const playerId = String(payload?.playerId ?? "");
    const matchId = String(payload?.matchId ?? "");
    const now = Date.now();
    const match = session.matches[matchId] ?? Object.values(session.matches).find((item) => isCurrentRoundMatch(session, item) && item.playerIds?.includes(playerId));
    if (!match || !match.playerIds?.includes(playerId)) {
      return json({ ...session, matchStatus: "missing" });
    }

    await writeMatchHeartbeat(env, match, playerId, now);
    await finishMatchIfOpponentTimedOut(env, session, match, playerId, now);
    // Do not persist ordinary polling by rewriting the whole session: a stale getMatch
    // write can overwrite a just-submitted skill in KV and leave the other player stuck
    // on an old turn. Heartbeats are stored separately above, and the session is persisted
    // only when the poll actually changes the match outcome, such as a disconnect timeout.
    if (match.finished) {
      return json({ ...(match.disconnectReason ? await writeSession(env, session) : session), matchStatus: "finished", match });
    }
    return json({ ...session, matchStatus: "matched", match });
  }

  if (action === "leaveMatch") {
    const playerId = String(payload?.playerId ?? "");
    const matchId = String(payload?.matchId ?? "");
    session.waitingPlayers = session.waitingPlayers.filter((player) => player.id !== playerId);
    const match = session.matches[matchId] ?? Object.values(session.matches).find((item) => isCurrentRoundMatch(session, item) && item.playerIds?.includes(playerId));
    if (match?.playerIds?.includes(playerId) && match.finished !== true) {
      finishMatchByForfeit(session, match, playerId);
    }
    return json(await writeSession(env, session));
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
    const now = Date.now();
    await writeMatchHeartbeat(env, match, playerId, now);
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
    return json({ ...(await writeSession(env, session)), matchStatus: match.disconnectReason ? "disconnected" : match.finished ? "finished" : "matched", match });
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

  if (action === "diagnoseSessionStore") {
    return json({ ...session, ...(await getSessionStoreDiagnostic(env)) });
  }

  if (action === "cleanupMatchHeartbeats") {
    const cleanup = await deleteMatchHeartbeats(env, { cursor: payload?.cursor, limit: payload?.limit });
    return json({ ...session, heartbeatKeysDeleted: cleanup.deletedCount, cleanupCursor: cleanup.cursor, cleanupComplete: cleanup.complete });
  }

  if (action === "resetTournamentNumber") {
    session.tournamentId = 0;
    session.round = 0;
    session.closingRound = false;
    session.eliminatedPlayerIds = [];
    session.waitingPlayers = [];
    session.matches = {};
    const heartbeatKeysDeleted = await deleteMatchHeartbeats(env);
    return json({ ...(await writeSession(env, session, { requireStoreWrite: true })), heartbeatKeysDeleted });
  }

  if (action === "advanceRound") {
    const originalTournamentId = session.tournamentId;
    const originalRound = session.round;
    session.closingRound = true;
    await writeSession(env, session, { requireStoreWrite: true });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const latestSession = await readSession(env);
    if (!latestSession.hosted || latestSession.tournamentId !== originalTournamentId || latestSession.round !== originalRound) {
      return json(latestSession);
    }

    latestSession.round += 1;
    latestSession.closingRound = false;
    latestSession.waitingPlayers = [];
    latestSession.matches = {};
    return json(await writeSession(env, latestSession, { requireStoreWrite: true }));
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
    const heartbeatKeysDeleted = await deleteMatchHeartbeats(env);
    return json({ ...(await writeSession(env, nextSession, { requireStoreWrite: true })), heartbeatKeysDeleted });
  }
  return json(await writeSession(env, nextSession, { requireStoreWrite: true }));
};

const getPublicErrorCode = (error) => {
  if (error instanceof SessionStoreError) {
    return error.code;
  }
  return "SESSION_TEMPORARILY_UNAVAILABLE";
};

const getSessionStoreDiagnostic = async (env = {}) => {
  const bindings = Object.fromEntries(
    kvBindingNames.map((name) => [
      name,
      {
        configured: env[name] !== undefined && env[name] !== null,
        isKvBinding: isKvStore(env[name]),
      },
    ]),
  );

  let stores;
  try {
    stores = getSessionStores(env);
  } catch (error) {
    return {
      ok: false,
      error: getPublicErrorCode(error),
      bindings,
      consistencyWarning: kvRealtimeConsistencyWarning,
    };
  }
  if (stores.length === 0) {
    return {
      ok: false,
      error: "GAME_SESSION_KV_NOT_CONFIGURED",
      bindings,
      consistencyWarning: kvRealtimeConsistencyWarning,
    };
  }

  const diagnosticKey = `diagnostic:${crypto.randomUUID?.() ?? Date.now()}`;
  let lastError;
  for (const { name, store } of stores) {
    try {
      await store.put(diagnosticKey, "ok", { expirationTtl: 60 });
      const savedValue = await store.get(diagnosticKey);
      await store.delete?.(diagnosticKey);
      bindings[name].readWriteOk = savedValue === "ok";
      if (bindings[name].readWriteOk) {
        return { ok: true, activeBinding: name, bindings, consistencyWarning: kvRealtimeConsistencyWarning };
      }
      bindings[name].readWriteError = "READ_AFTER_WRITE_MISMATCH";
    } catch (error) {
      lastError = error;
      bindings[name].readWriteOk = false;
      bindings[name].readWriteError = error?.message ?? String(error);
      bindings[name].readWriteErrorName = error?.name;
    }
  }
  return {
    ok: false,
    error: "GAME_SESSION_KV_WRITE_FAILED",
    message: lastError?.message,
    bindings,
    consistencyWarning: kvRealtimeConsistencyWarning,
  };
};

export async function onRequestPost(context) {
  try {
    return await handlePost(context);
  } catch (error) {
    return json({ ...(await readSession(context?.env)), ok: false, error: getPublicErrorCode(error) });
  }
}
