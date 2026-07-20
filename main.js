const openingDelayMs = 1000;
const fadeStartDelayMs = 3000;
const fadeDurationMs = 1000;
const titleAppearDelayMs = 1500;
const titleFadeDurationMs = 1000;
const titleMoveDelayMs = 1000;
const titleMoveDurationMs = 800;
const maxHp = 120;
const matchingPollMs = 3000;
const matchSyncPollMs = 1000;
const matchHeartbeatWriteIntervalMs = 30000;
const turnHandoffWatchdogMs = 9000;
const opponentAbsenceWinMessage = "相手の接続が切れたため、勝利しました。";
const sessionRequestTimeoutMs = 12000;
const sessionRetryDelayMs = 350;
const sessionRetryJitterMs = 250;
const resultReturnMs = 10000;
const battleAudioFadeOutMs = 1300;
const questionDurationSeconds = 20;
const skillBonusAccuracyThreshold = 65;
const feedbackDurationMs = 260;
const authEndpoint = "/api/auth";
const sessionEndpoint = "/api/session";
const subjects = {
  math: { label: "数学", file: "questions/math_questions.json" },
  japanese: { label: "国語", file: "questions/japanese_questions.json" },
  english: { label: "英語", file: "questions/english_questions.json" },
  science: { label: "理科", file: "questions/science_questions.json" },
  social: { label: "社会", file: "questions/social_questions.json" },
};
const passwordModes = {
  startup: {
    title: "パスワード認証",
    description: "学習クイズを開始するにはパスワードを入力してください。",
    allowCancel: false,
  },
  admin: {
    title: "管理者認証",
    description: "管理者画面を開くにはパスワードを入力してください。",
    allowCancel: true,
  },
};

const opening = document.querySelector("#opening");
const openingImage = document.querySelector("#openingImage");
const openingAudio = document.querySelector("#openingAudio");
const battleAudio = document.querySelector("#battleAudio");
const turnStartAudio = document.querySelector("#turnStartAudio");
const damageSmallAudio = document.querySelector("#damageSmallAudio");
const damageMediumAudio = document.querySelector("#damageMediumAudio");
const damageLargeAudio = document.querySelector("#damageLargeAudio");
const damageHugeAudio = document.querySelector("#damageHugeAudio");
const recoverAudio = document.querySelector("#recoverAudio");
const guardAudio = document.querySelector("#guardAudio");
const correctAudio = document.querySelector("#correctAudio");
const fallOverAudio = document.querySelector("#fallOverAudio");
const victoryAudio = document.querySelector("#victoryAudio");
const defeatAudio = document.querySelector("#defeatAudio");
const fadeOverlay = document.querySelector("#fadeOverlay");
const nextScreen = document.querySelector("#nextScreen");
const titleImage = document.querySelector("#titleImage");
const matchingButton = document.querySelector("#matchingButton");
const sessionNotice = document.querySelector("#sessionNotice");
const adminButton = document.querySelector("#adminButton");
const adminScreen = document.querySelector("#adminScreen");
const adminBackButton = document.querySelector("#adminBackButton");
const adminGameForm = document.querySelector("#adminGameForm");
const adminStatus = document.querySelector("#adminStatus");
const adminHostButton = document.querySelector("#adminHostButton");
const adminStopButton = document.querySelector("#adminStopButton");
const adminRoundButton = document.querySelector("#adminRoundButton");
const adminResetTournamentButton = document.querySelector("#adminResetTournamentButton");
const adminDebugButton = document.querySelector("#adminDebugButton");
const adminDebugOutput = document.querySelector("#adminDebugOutput");
const passwordGate = document.querySelector("#passwordGate");
const passwordForm = document.querySelector("#passwordForm");
const passwordTitle = document.querySelector("#passwordTitle");
const passwordDescription = document.querySelector("#passwordDescription");
const passwordInput = document.querySelector("#passwordInput");
const passwordError = document.querySelector("#passwordError");
const passwordCancelButton = document.querySelector("#passwordCancelButton");
const battleScene = document.querySelector("#battleScene");
const battleActions = document.querySelector("#battleActions");
const battleMessage = document.querySelector("#battleMessage");
const turnLabel = document.querySelector("#turnLabel");
const subjectLabel = document.querySelector("#subjectLabel");
const questionPanel = document.querySelector("#questionPanel");
const questionTimer = document.querySelector("#questionTimer");
const questionScore = document.querySelector("#questionScore");
const questionText = document.querySelector("#questionText");
const questionChoices = document.querySelector("#questionChoices");
const answerFeedback = document.querySelector("#answerFeedback");
const answerFeedbackIcon = document.querySelector("#answerFeedbackIcon");
const turnRoulette = document.querySelector("#turnRoulette");
const turnRouletteImage = document.querySelector("#turnRouletteImage");
const resultOverlay = document.querySelector("#resultOverlay");
const resultImage = document.querySelector("#resultImage");
const playerHpText = document.querySelector("#playerHpText");
const opponentHpText = document.querySelector("#opponentHpText");
const playerHpGauge = document.querySelector("#playerHpGauge");
const opponentHpGauge = document.querySelector("#opponentHpGauge");
const playerCharacter = document.querySelector(".battle-character--player");
const opponentCharacter = document.querySelector(".battle-character--opponent");
const playerGuardOverlay = document.querySelector("#playerGuardOverlay");
const playerGuardValue = document.querySelector("#playerGuardValue");
const opponentGuardOverlay = document.querySelector("#opponentGuardOverlay");
const opponentGuardValue = document.querySelector("#opponentGuardValue");
const skillButtons = Array.from(document.querySelectorAll(".battle-action"));

const skills = {
  attack: {
    name: "提出",
    difficulty: "normal",
    base: 8,
    perPoint: 4,
    type: "damage",
    cooldownTurns: 0,
  },
  recover: {
    name: "確認",
    difficulty: "normal",
    base: 6,
    perPoint: 3,
    type: "recover",
    cooldownTurns: 1,
  },
  guard: {
    name: "保留",
    difficulty: "normal",
    base: 15,
    perPoint: 7,
    type: "guard",
    cooldownTurns: 1,
    maxReduction: 60,
  },
  burst: {
    name: "発展",
    difficulty: "hard",
    base: 16,
    perPoint: 8,
    type: "damage",
    cooldownTurns: 1,
  },
};

const authState = {
  startupUnlocked: false,
  mode: "startup",
  pendingResolve: null,
  adminPassword: "",
};

const battleState = {
  phase: "idle",
  selectedSubjectKey: "math",
  hosted: false,
  tournamentId: 0,
  round: 0,
  closingRound: false,
  adminBusy: false,
  playerId: localStorage.getItem("schoolRpgPlayerId") || crypto.randomUUID(),
  match: null,
  lastMatchVersion: -1,
  matchSyncTimerId: null,
  turnHandoffWatchdogTimerId: null,
  syncInFlight: false,
  lastMatchHeartbeatAt: 0,
  matchingTimerId: null,
  rouletteRunId: 0,
  eliminatedTournamentId: Number(localStorage.getItem("schoolRpgEliminatedTournamentId") || "-1"),
  questions: [],
  questionSession: null,
  playerHp: maxHp,
  opponentHp: maxHp,
  playerGuardReduction: 0,
  opponentGuardReduction: 0,
  cooldowns: {
    recover: 0,
    guard: 0,
    burst: 0,
  },
};
localStorage.setItem("schoolRpgPlayerId", battleState.playerId);
let answerIconTimerId = null;

const yourTurnImage = "assets/images/ui/Icon/your_turn.png";
const enemyTurnImage = "assets/images/ui/Icon/enemy_turn.png";
const rouletteImages = [yourTurnImage, enemyTurnImage];
const rouletteStepCount = 18;
const rouletteStepMs = 120;
const rouletteFinalPauseMs = 650;

const setPasswordMode = (mode) => {
  authState.mode = mode;
  const modeConfig = passwordModes[mode];
  passwordTitle.textContent = modeConfig.title;
  passwordDescription.textContent = modeConfig.description;
  passwordCancelButton.hidden = !modeConfig.allowCancel;
  passwordError.textContent = "";
  passwordInput.value = "";
};

const showPasswordGate = (mode) => {
  setPasswordMode(mode);
  passwordGate.hidden = false;
  passwordInput.focus();

  return new Promise((resolve) => {
    authState.pendingResolve = resolve;
  });
};

const closePasswordGate = (authenticated) => {
  passwordGate.hidden = true;
  passwordError.textContent = "";
  if (authState.pendingResolve) {
    authState.pendingResolve(authenticated);
    authState.pendingResolve = null;
  }
};

const authenticatePassword = async (password, mode) => {
  const response = await fetch(authEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, mode }),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.ok === true;
};

const handlePasswordSubmit = async (event) => {
  event.preventDefault();
  passwordError.textContent = "";
  const submitButton = passwordForm.querySelector(".password-gate__submit");
  submitButton.disabled = true;

  try {
    const authenticated = await authenticatePassword(passwordInput.value, authState.mode);
    if (!authenticated) {
      passwordError.textContent = "パスワードが違います。";
      passwordInput.select();
      return;
    }

    if (authState.mode === "admin") {
      authState.adminPassword = passwordInput.value;
    }

    closePasswordGate(true);
  } catch (error) {
    const variableName = authState.mode === "admin" ? "ADMIN_PASSWORD" : "PASSWORD";
    passwordError.textContent = `認証に失敗しました。Cloudflare の ${variableName} 変数を確認してください。`;
  } finally {
    submitButton.disabled = false;
  }
};

const playAudioFromStart = (audioElement) => {
  if (!audioElement) {
    return;
  }

  audioElement.currentTime = 0;
  const playPromise = audioElement.play();

  if (playPromise !== undefined) {
    playPromise.catch(() => {});
  }
};


const stopBattleAudio = () => {
  if (!battleAudio) {
    return;
  }

  battleAudio.pause();
  battleAudio.currentTime = 0;
  battleAudio.volume = 1;
};

const fadeOutBattleAudio = (durationMs = battleAudioFadeOutMs) => {
  if (!battleAudio || battleAudio.paused) {
    return;
  }

  const startingVolume = battleAudio.volume;
  const startedAt = performance.now();

  const fadeFrame = (currentTime) => {
    const progress = Math.min((currentTime - startedAt) / durationMs, 1);
    battleAudio.volume = startingVolume * (1 - progress);

    if (progress < 1 && !battleAudio.paused) {
      window.requestAnimationFrame(fadeFrame);
      return;
    }

    battleAudio.pause();
    battleAudio.currentTime = 0;
    battleAudio.volume = 1;
  };

  window.requestAnimationFrame(fadeFrame);
};

const playBattleAudio = () => {
  if (!battleAudio) {
    return;
  }

  battleAudio.loop = true;
  battleAudio.volume = 1;
  playAudioFromStart(battleAudio);
};

const playOpeningAudio = () => {
  openingAudio.currentTime = 0;
  const playPromise = openingAudio.play();

  if (playPromise !== undefined) {
    playPromise.catch(() => {
      const playAfterUserGesture = () => {
        openingAudio.play();
        document.removeEventListener("pointerdown", playAfterUserGesture);
        document.removeEventListener("keydown", playAfterUserGesture);
      };

      document.addEventListener("pointerdown", playAfterUserGesture, { once: true });
      document.addEventListener("keydown", playAfterUserGesture, { once: true });
    });
  }
};

const setBattleMessage = (message) => {
  battleMessage.textContent = message;
  battleMessage.hidden = message.length === 0;
};

const getSelectedSubject = () => subjects[battleState.selectedSubjectKey] ?? subjects.math;

const updateAdminButtonStates = () => {
  if (adminHostButton) {
    adminHostButton.disabled = battleState.adminBusy || battleState.hosted;
  }
  if (adminStopButton) {
    adminStopButton.disabled = battleState.adminBusy || !battleState.hosted;
  }
  if (adminRoundButton) {
    adminRoundButton.disabled = battleState.adminBusy || !battleState.hosted;
  }
  if (adminDebugButton) {
    adminDebugButton.disabled = battleState.adminBusy;
  }
};

const updateSessionUi = () => {
  const subject = getSelectedSubject();
  const statusText = battleState.hosted
    ? `実施中: ${subject.label} / 実施${battleState.tournamentId} 第${battleState.round + 1}受付${battleState.closingRound ? "締め切り中" : ""}`
    : "現在は実施していません。管理者画面で教科を選んで開始してください。";

  subjectLabel.textContent = `教科: ${subject.label}`;
  const isEliminated = battleState.eliminatedTournamentId === battleState.tournamentId;
  matchingButton.disabled = !battleState.hosted || isEliminated || battleState.closingRound;
  matchingButton.title = battleState.hosted ? `${subject.label}で参加開始` : "";
  matchingButton.classList.toggle("is-visible", battleState.hosted && titleImage.classList.contains("is-settled"));
  if (sessionNotice) {
    sessionNotice.hidden = battleState.hosted && !isEliminated && !battleState.closingRound;
    sessionNotice.textContent = !battleState.hosted ? "現在実施していません。管理者が開始するまで参加できません。" : isEliminated ? "今回は終了したため、次の回まで参加できません。" : "参加受付を締め切りました。次の回の開始を待ってください。";
    sessionNotice.classList.toggle("is-visible", !sessionNotice.hidden && titleImage.classList.contains("is-settled"));
  }
  if (adminStatus) {
    adminStatus.textContent = statusText;
  }
  updateAdminButtonStates();
  const selectedSubjectInput = adminGameForm?.querySelector(`input[name="subject"][value="${battleState.selectedSubjectKey}"]`);
  if (selectedSubjectInput) {
    selectedSubjectInput.checked = true;
  }
};

const applyRemoteSession = (session) => {
  const wasHosted = battleState.hosted;
  battleState.hosted = session?.hosted === true;
  battleState.selectedSubjectKey = subjects[session?.selectedSubjectKey] ? session.selectedSubjectKey : "math";
  battleState.tournamentId = Number.isInteger(session?.tournamentId) ? session.tournamentId : battleState.tournamentId;
  battleState.round = Number.isInteger(session?.round) ? session.round : battleState.round;
  battleState.closingRound = session?.closingRound === true;
  if (wasHosted && !battleState.hosted && battleState.phase !== "idle") {
    forceReturnToTitle("実施が終了したため、学習セッションを終了しました。");
  }
  updateSessionUi();
};

const loadRemoteSession = async () => {
  try {
    applyRemoteSession(await fetchSessionJson(sessionEndpoint, { cache: "no-store" }));
  } catch (error) {
    updateSessionUi();
    if (sessionNotice) {
      sessionNotice.textContent = "オンラインの実施状態を確認できません。管理者に確認してください。";
      sessionNotice.hidden = false;
      sessionNotice.classList.toggle("is-visible", titleImage.classList.contains("is-settled"));
    }
  }
};


const sessionErrorMessages = {
  GAME_SESSION_STORE_NOT_CONFIGURED: "GAME_SESSION_DO または GAME_SESSION_KV が未設定です。Durable Object binding（推奨）または KV namespace binding を追加してください。",
  GAME_SESSION_DO_WRITE_FAILED: "GAME_SESSION_DO への書き込みが失敗しました。Durable Object Worker と Pages の binding、再デプロイ、Cloudflare 側の一時障害を確認してください。",
  GAME_SESSION_DURABLE_STORAGE_IS_NOT_KV_BINDING: "Durable Object 内部ストレージの初期化に失敗しました。Durable Object Worker の設定を確認してください。",
  GAME_SESSION_KV_NOT_CONFIGURED: "GAME_SESSION_KV が未設定です。Cloudflare Pages の KV namespace bindings に同名の KV バインディングを追加してください。",
  GAME_SESSION_KV_IS_NOT_KV_BINDING: "GAME_SESSION_KV が通常の環境変数として設定されています。Environment variables ではなく KV namespace bindings に設定してください。",
  GAME_SESSION_IS_NOT_KV_BINDING: "GAME_SESSION が通常の環境変数として設定されています。Environment variables ではなく KV namespace bindings に設定してください。",
  GAME_SESSION_KV_WRITE_FAILED: "GAME_SESSION_KV への書き込みが失敗しました。KV namespace のバインディング先、Pages の再デプロイ、Cloudflare 側の一時障害を確認してください。",
  SESSION_TEMPORARILY_UNAVAILABLE: "セッション保存処理で一時的なエラーが発生しました。再試行しても直らない場合は管理者に確認してください。",
};

const getSessionErrorMessage = (error, fallback) => sessionErrorMessages[error?.result?.error] ?? fallback;


const showAdminDebugResult = (result) => {
  if (!adminDebugOutput) {
    return;
  }
  adminDebugOutput.hidden = false;
  adminDebugOutput.textContent = JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      url: window.location.href,
      sessionEndpoint,
      ...result,
    },
    null,
    2,
  );
};

const saveRemoteSession = async (session) => {
  applyRemoteSession(
    await fetchSessionJson(sessionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...session, adminPassword: authState.adminPassword }),
    }),
  );
};



const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getRetryDelay = (attempt) => sessionRetryDelayMs * 2 ** attempt + Math.random() * sessionRetryJitterMs;

const fetchSessionJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), sessionRequestTimeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok === false) {
      const error = new Error(`セッション通信に失敗しました: ${response.status}`);
      error.result = result;
      error.status = response.status;
      throw error;
    }
    return result;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const postSessionAction = async (payload, { retries = 3 } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchSessionJson(sessionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      lastError = error;
      const canRetry = !error.status || error.status >= 500;
      if (!canRetry || attempt === retries) {
        throw error;
      }
      await wait(getRetryDelay(attempt));
    }
  }
  throw lastError;
};

const notifyPlayerDisconnected = (event) => {
  if (event?.persisted || document.visibilityState === "hidden") {
    return;
  }
  if (!["matching", "roulette", "player", "opponent", "question", "resolving"].includes(battleState.phase)) {
    return;
  }

  const payload = JSON.stringify({
    action: "leaveMatch",
    playerId: battleState.playerId,
    matchId: battleState.match?.id,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(sessionEndpoint, new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch(sessionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
};

const hideAnswerIcon = () => {
  if (!answerFeedbackIcon) return;
  if (answerIconTimerId) {
    window.clearTimeout(answerIconTimerId);
    answerIconTimerId = null;
  }
  answerFeedbackIcon.classList.remove("is-playing");
  answerFeedbackIcon.hidden = true;
  answerFeedbackIcon.removeAttribute("src");
};

const playAnswerIcon = (isCorrect) => {
  if (!answerFeedbackIcon) return;
  hideAnswerIcon();
  answerFeedbackIcon.src = isCorrect ? "assets/images/ui/Icon/correct.png" : "assets/images/ui/Icon/wrong.png";
  answerFeedbackIcon.hidden = false;
  window.requestAnimationFrame(() => {
    if (!answerFeedbackIcon.hidden) {
      answerFeedbackIcon.classList.add("is-playing");
    }
  });
  answerIconTimerId = window.setTimeout(hideAnswerIcon, feedbackDurationMs + 80);
  if (isCorrect) {
    playAudioFromStart(correctAudio);
  }
};

const forceReturnToTitle = (message = "最初の画面に戻りました。") => {
  if (battleState.questionSession?.timerId) {
    window.clearInterval(battleState.questionSession.timerId);
  }
  if (battleState.matchingTimerId) {
    window.clearInterval(battleState.matchingTimerId);
    battleState.matchingTimerId = null;
  }
  stopMatchSync();
  stopTurnHandoffWatchdog();
  stopBattleAudio();
  resetBattle();
  nextScreen.classList.remove("is-battle-starting");
  battleScene.classList.remove("is-visible");
  resultOverlay.hidden = true;
  playerCharacter.classList.remove("is-falling");
  opponentCharacter.classList.remove("is-falling");
  setBattleMessage(message);
  updateSessionUi();
};

const showResult = async (result) => {
  battleState.phase = "finished";
  stopTurnHandoffWatchdog();
  const won = result === "win";
  fadeOutBattleAudio();
  updateSkillButtons();
  const defeatedCharacter = won ? opponentCharacter : playerCharacter;
  playAudioFromStart(fallOverAudio);
  defeatedCharacter.classList.add("is-falling");
  await new Promise((resolve) => window.setTimeout(resolve, 1300));
  resultImage.src = won ? "assets/images/ui/Victory.png" : "assets/images/ui/defeat.png";
  resultImage.alt = won ? "完了" : "終了";
  resultOverlay.hidden = false;
  playAudioFromStart(won ? victoryAudio : defeatAudio);
  if (!won) {
    battleState.eliminatedTournamentId = battleState.tournamentId;
    localStorage.setItem("schoolRpgEliminatedTournamentId", String(battleState.tournamentId));
  }
  postSessionAction({ action: "finishMatch", playerId: battleState.playerId, matchId: battleState.match?.id, result }).catch(() => {});
  window.setTimeout(() => forceReturnToTitle(won ? "完了しました。" : "終了しました。次の実施まで参加できません。"), resultReturnMs);
};

const waitForNextPaint = () =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });

const preloadTurnRouletteImages = () => {
  rouletteImages.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
};

const stopTurnRoulette = () => {
  turnRoulette.classList.remove("is-playing");
  turnRoulette.hidden = true;
  turnLabel.classList.remove("is-hidden-before-start");
};

const playTurnRoulette = async (firstIsPlayer) => {
  const rouletteRunId = battleState.rouletteRunId + 1;
  battleState.rouletteRunId = rouletteRunId;
  const finalImage = firstIsPlayer ? yourTurnImage : enemyTurnImage;

  preloadTurnRouletteImages();
  turnLabel.classList.add("is-hidden-before-start");
  turnRouletteImage.src = rouletteImages[0];
  turnRoulette.hidden = false;
  turnRoulette.classList.add("is-playing");
  await waitForNextPaint();

  for (let step = 1; step <= rouletteStepCount; step += 1) {
    if (battleState.rouletteRunId !== rouletteRunId) {
      stopTurnRoulette();
      return false;
    }
    turnRouletteImage.src = rouletteImages[step % rouletteImages.length];
    await wait(rouletteStepMs);
    await waitForNextPaint();
  }

  if (battleState.rouletteRunId !== rouletteRunId) {
    stopTurnRoulette();
    return false;
  }
  turnRouletteImage.src = finalImage;
  await wait(rouletteFinalPauseMs);
  stopTurnRoulette();
  return true;
};

const loadQuestions = async () => {
  const subject = getSelectedSubject();
  try {
    const response = await fetch(subject.file, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`問題ファイルを読み込めませんでした: ${response.status}`);
    }

    const questions = await response.json();
    battleState.questions = Array.isArray(questions) ? questions : [];
    updateSessionUi();
  } catch (error) {
    battleState.questions = [];
    setBattleMessage(`${subject.file} の読み込みに失敗しました。ページを再読み込みしてください。`);
  }
};

const isQuestionVisible = (question) => question.visible !== false;

const getQuestionsByDifficulty = (difficulty) =>
  battleState.questions.filter(
    (question) => question.difficulty === difficulty && question.subject === getSelectedSubject().label && isQuestionVisible(question),
  );

const shuffleArray = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const shuffleQuestions = (questions) => shuffleArray(questions);

const getShuffledChoices = (question) =>
  shuffleArray(
    question.choices.map((choice, index) => ({
      text: choice,
      originalIndex: index,
    })),
  );

const updateQuestionScore = () => {
  const session = battleState.questionSession;
  if (!session) {
    return;
  }

  questionScore.textContent = `正解 ${session.correct} / 誤答 ${session.wrong}`;
};

const showQuestion = () => {
  const session = battleState.questionSession;
  if (!session) {
    return;
  }

  if (session.index >= session.questions.length) {
    session.questions = shuffleQuestions(getQuestionsByDifficulty(session.difficulty));
    session.index = 0;
  }

  hideAnswerIcon();
  const question = session.questions[session.index];
  questionText.textContent = question.question;
  questionChoices.innerHTML = "";
  answerFeedback.textContent = "";
  delete answerFeedback.dataset.result;
  const shuffledChoices = getShuffledChoices(question);
  shuffledChoices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-panel__choice";
    button.textContent = choice.text;
    button.dataset.choiceIndex = String(choice.originalIndex);
    questionChoices.append(button);
  });
  questionChoices.classList.toggle("question-panel__choices--vertical", shuffledChoices.some((choice) => choice.text.length > 16));
};

const getQuestionAccuracy = (correct, wrong) => {
  const answeredCount = correct + wrong;
  return answeredCount > 0 ? (correct / answeredCount) * 100 : 0;
};

const getSkillEffectivePoint = (correct, wrong) => {
  const accuracy = getQuestionAccuracy(correct, wrong);
  if (accuracy <= skillBonusAccuracyThreshold) {
    return 0;
  }

  return Math.max(0, correct - wrong * 0.5);
};

const finishQuestionSession = () => {
  const session = battleState.questionSession;
  if (!session || session.finished) {
    return;
  }

  session.finished = true;
  window.clearInterval(session.timerId);
  hideAnswerIcon();
  questionPanel.hidden = true;
  battleState.phase = "resolving";
  const effectivePoint = getSkillEffectivePoint(session.correct, session.wrong);
  applySkillResult(session.skillKey, effectivePoint, session.correct, session.wrong);
  battleState.questionSession = null;
};

const tickQuestionTimer = () => {
  const session = battleState.questionSession;
  if (!session) {
    return;
  }

  const remaining = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
  questionTimer.textContent = `残り${remaining}秒`;
  if (remaining <= 0) {
    finishQuestionSession();
  }
};

const startQuestionSession = (skillKey) => {
  const skill = skills[skillKey];
  const questions = shuffleQuestions(getQuestionsByDifficulty(skill.difficulty));

  if (questions.length === 0) {
    setBattleMessage("この操作に対応する実施教科の問題がありません。questions フォルダを確認してください。");
    return;
  }

  battleState.phase = "question";
  battleState.questionSession = {
    skillKey,
    difficulty: skill.difficulty,
    questions,
    index: 0,
    correct: 0,
    wrong: 0,
    finished: false,
    endsAt: Date.now() + questionDurationSeconds * 1000,
    timerId: window.setInterval(tickQuestionTimer, 200),
  };
  hideAnswerIcon();
  questionPanel.hidden = false;
  setBattleMessage("");
  updateSkillButtons();
  updateQuestionScore();
  tickQuestionTimer();
  showQuestion();
};

const handleChoiceClick = (event) => {
  const button = event.target.closest(".question-panel__choice");
  const session = battleState.questionSession;
  if (!button || !session || session.finished) {
    return;
  }

  const question = session.questions[session.index];
  const selectedIndex = Number(button.dataset.choiceIndex);
  const isCorrect = selectedIndex === question.answerIndex;
  session.correct += isCorrect ? 1 : 0;
  session.wrong += isCorrect ? 0 : 1;
  answerFeedback.textContent = "";
  answerFeedback.dataset.result = isCorrect ? "correct" : "wrong";
  playAnswerIcon(isCorrect);
  updateQuestionScore();
  session.index += 1;
  Array.from(questionChoices.children).forEach((choiceButton) => {
    choiceButton.disabled = true;
  });
  window.setTimeout(() => {
    if (battleState.questionSession === session && !session.finished) {
      showQuestion();
    }
  }, feedbackDurationMs);
};


const updateHpDisplay = () => {
  playerHpText.textContent = `${battleState.playerHp} / ${maxHp}`;
  opponentHpText.textContent = `${battleState.opponentHp} / ${maxHp}`;
  playerHpGauge.style.setProperty("--hp-cut", `${(1 - battleState.playerHp / maxHp) * 100}%`);
  opponentHpGauge.style.setProperty("--hp-cut", `${(1 - battleState.opponentHp / maxHp) * 100}%`);
};

const updateSkillButtons = () => {
  const isPlayerTurn = battleState.phase === "player";

  skillButtons.forEach((button) => {
    const skillKey = button.dataset.skill;
    const cooldown = battleState.cooldowns[skillKey] ?? 0;
    button.disabled = !isPlayerTurn || cooldown > 0 || battleState.opponentHp <= 0;
    button.classList.toggle("is-on-cooldown", cooldown > 0);
    button.classList.toggle("is-unavailable", !isPlayerTurn && battleState.opponentHp > 0);
    button.title = cooldown > 0 ? `${skills[skillKey].name}は次の自分の順番まで使えません` : skills[skillKey].name;
  });
};

const getDamageStage = (damage) => {
  if (damage >= 42) {
    return "huge";
  }

  if (damage >= 24) {
    return "large";
  }

  if (damage >= 12) {
    return "medium";
  }

  return "small";
};

const damageAudioByStage = {
  small: damageSmallAudio,
  medium: damageMediumAudio,
  large: damageLargeAudio,
  huge: damageHugeAudio,
};

const playDamageAudio = (damage) => {
  if (damage <= 0) {
    return;
  }

  playAudioFromStart(damageAudioByStage[getDamageStage(damage)]);
};

const playDamageEffect = (characterElement, damage) => {
  if (!characterElement || damage <= 0) {
    return;
  }

  characterElement.dataset.damageStage = getDamageStage(damage);
  characterElement.classList.remove("is-taking-damage");
  void characterElement.offsetWidth;
  characterElement.classList.add("is-taking-damage");
};

const playRecoverEffect = (characterElement) => {
  if (!characterElement) {
    return;
  }

  characterElement.classList.remove("is-recovering");
  void characterElement.offsetWidth;
  characterElement.classList.add("is-recovering");
};

const setGuardOverlay = (overlay, valueElement, reduction) => {
  if (!overlay || !valueElement) {
    return;
  }

  overlay.classList.toggle("is-active", reduction > 0);
  valueElement.textContent = `${reduction}%`;
};

const updateGuardOverlay = () => {
  setGuardOverlay(playerGuardOverlay, playerGuardValue, battleState.playerGuardReduction);
  setGuardOverlay(opponentGuardOverlay, opponentGuardValue, battleState.opponentGuardReduction);
};

const tickCooldownsAtPlayerTurnStart = () => {
  Object.keys(battleState.cooldowns).forEach((skillKey) => {
    battleState.cooldowns[skillKey] = Math.max(0, battleState.cooldowns[skillKey] - 1);
  });
};

const stopTurnHandoffWatchdog = () => {
  if (battleState.turnHandoffWatchdogTimerId) {
    window.clearTimeout(battleState.turnHandoffWatchdogTimerId);
    battleState.turnHandoffWatchdogTimerId = null;
  }
};

const armTurnHandoffWatchdog = (phase, version = battleState.lastMatchVersion) => {
  stopTurnHandoffWatchdog();
  if (!["opponent", "resolving"].includes(phase) || !battleState.match?.id) {
    return;
  }

  battleState.turnHandoffWatchdogTimerId = window.setTimeout(() => {
    battleState.turnHandoffWatchdogTimerId = null;
    if (battleState.phase !== phase || battleState.lastMatchVersion !== version || !battleState.match?.id) {
      return;
    }
    syncMatch();
    armTurnHandoffWatchdog(phase, version);
  }, turnHandoffWatchdogMs);
};

const startPlayerTurn = () => {
  stopTurnHandoffWatchdog();
  battleState.phase = "player";
  battleState.playerGuardReduction = 0;
  turnLabel.src = "assets/images/ui/Icon/your_turn.png";
  turnLabel.alt = "自分の順番";
  turnLabel.classList.remove("is-entering");
  void turnLabel.offsetWidth;
  turnLabel.classList.add("is-entering");
  setBattleMessage("");
  updateGuardOverlay();
  updateSkillButtons();
  playAudioFromStart(turnStartAudio);
};


const applyRemoteMatch = (match) => {
  if (!match || !match.playerIds?.includes(battleState.playerId)) {
    return;
  }
  const opponentId = match.playerIds.find((id) => id !== battleState.playerId);
  const previousVersion = battleState.lastMatchVersion;
  const incomingVersion = Number.isInteger(match.version) ? match.version : previousVersion;
  if (incomingVersion < previousVersion) {
    return;
  }

  battleState.match = match;
  battleState.lastMatchVersion = incomingVersion;
  battleState.playerHp = match.hpByPlayerId?.[battleState.playerId] ?? battleState.playerHp;
  battleState.opponentHp = match.hpByPlayerId?.[opponentId] ?? battleState.opponentHp;
  battleState.playerGuardReduction = match.guardByPlayerId?.[battleState.playerId] ?? 0;
  battleState.opponentGuardReduction = match.guardByPlayerId?.[opponentId] ?? 0;
  battleState.cooldowns = { ...battleState.cooldowns, ...(match.cooldownsByPlayerId?.[battleState.playerId] ?? {}) };
  updateHpDisplay();
  updateGuardOverlay();

  if (match.lastAction && battleState.lastMatchVersion !== previousVersion) {
    const actionByMe = match.lastAction.playerId === battleState.playerId;
    const target = actionByMe ? opponentCharacter : playerCharacter;
    if (match.lastAction.skillType === "damage") {
      playDamageEffect(target, match.lastAction.effectValue);
      playDamageAudio(match.lastAction.effectValue);
    }
    if (match.lastAction.skillType === "recover") {
      playRecoverEffect(actionByMe ? playerCharacter : opponentCharacter);
      playAudioFromStart(recoverAudio);
    }
    if (match.lastAction.skillType === "guard") {
      playAudioFromStart(guardAudio);
    }
  }

  if (match.finished) {
    stopMatchSync();
    if (match.disconnectReason && match.winnerPlayerId === battleState.playerId) {
      setBattleMessage(opponentAbsenceWinMessage);
    }
    showResult(match.winnerPlayerId === battleState.playerId ? "win" : "lose");
    return;
  }

  if (match.turnPlayerId === battleState.playerId) {
    if (battleState.phase !== "player" && battleState.phase !== "question") {
      startPlayerTurn();
    }
  } else if (battleState.phase !== "opponent" && battleState.phase !== "question") {
    startOpponentTurn();
  }
};

const syncMatch = async () => {
  if (!battleState.match?.id || battleState.phase === "finished" || battleState.syncInFlight) {
    return;
  }
  battleState.syncInFlight = true;
  try {
    const now = Date.now();
    const shouldWriteHeartbeat = now - battleState.lastMatchHeartbeatAt >= matchHeartbeatWriteIntervalMs;
    const session = await postSessionAction({
      action: "getMatch",
      playerId: battleState.playerId,
      matchId: battleState.match.id,
      heartbeat: shouldWriteHeartbeat,
    });
    if (shouldWriteHeartbeat) {
      battleState.lastMatchHeartbeatAt = now;
    }
    applyRemoteSession(session);
    if (session.match) {
      applyRemoteMatch(session.match);
    } else if (["missing", "disconnected"].includes(session.matchStatus)) {
      forceReturnToTitle("相手との接続状態を確認できませんでした。もう一度参加してください。");
    }
  } catch (error) {
    setBattleMessage("相手との同期に失敗しました。自動で再接続しています...");
  } finally {
    battleState.syncInFlight = false;
  }
};

const startMatchSync = () => {
  stopMatchSync();
  syncMatch();
  battleState.matchSyncTimerId = window.setInterval(syncMatch, matchSyncPollMs);
};

const stopMatchSync = () => {
  if (battleState.matchSyncTimerId) {
    window.clearInterval(battleState.matchSyncTimerId);
    battleState.matchSyncTimerId = null;
  }
};

const startOpponentTurn = () => {
  battleState.phase = "opponent";
  turnLabel.classList.remove("is-entering");
  turnLabel.src = "assets/images/ui/Icon/enemy_turn.png";
  turnLabel.alt = "相手の順番";
  setBattleMessage("相手の順番です。相手の操作を待っています。");
  updateSkillButtons();
  armTurnHandoffWatchdog("opponent");
  syncMatch();
};

const finishBattleIfNeeded = () => {
  if (battleState.opponentHp <= 0) {
    showResult("win");
    return true;
  }

  if (battleState.playerHp <= 0) {
    showResult("lose");
    return true;
  }

  return false;
};

const applySkillResult = async (skillKey, effectivePoint, correct, wrong) => {
  const skill = skills[skillKey];
  const effectValue = Math.round(skill.base + effectivePoint * skill.perPoint);
  const accuracy = getQuestionAccuracy(correct, wrong);
  const bonusBlocked = correct + wrong > 0 && accuracy <= skillBonusAccuracyThreshold;
  const scoreText = `正解${correct}・誤答${wrong}・正解率${Math.round(accuracy)}%・有効得点${effectivePoint}${bonusBlocked ? "（65%以下のため追加強化なし）" : ""}`;
  let message = "";
  let guardReduction = 0;

  if (skill.type === "damage") {
    message = `${skill.name}！ ${scoreText}で、相手のポイントを${effectValue}調整。`;
  }

  if (skill.type === "recover") {
    message = `${skill.name}！ ${scoreText}で、自分のポイントを${effectValue}加算。`;
  }

  if (skill.type === "guard") {
    guardReduction = Math.min(skill.maxReduction, effectValue);
    message = `${skill.name}！ ${scoreText}で、次の減点を${guardReduction}%軽減。`;
  }

  battleState.phase = "resolving";
  armTurnHandoffWatchdog("resolving");
  setBattleMessage(message);
  updateSkillButtons();

  try {
    const session = await postSessionAction({
      action: "submitSkill",
      actionId: crypto.randomUUID(),
      expectedVersion: battleState.match?.version,
      playerId: battleState.playerId,
      matchId: battleState.match?.id,
      skillKey,
      skillType: skill.type,
      effectValue,
      guardReduction,
      cooldownTurns: skill.cooldownTurns,
      correct,
      wrong,
    });
    applyRemoteSession(session);
    applyRemoteMatch(session.match);
  } catch (error) {
    if (error.result?.match) {
      applyRemoteSession(error.result);
      applyRemoteMatch(error.result.match);
      setBattleMessage(error.result.matchStatus === "versionMismatch" ? "相手との状態を更新しました。もう一度操作してください。" : "現在は自分の順番ではありません。");
      return;
    }
    setBattleMessage("操作の送信に失敗しました。もう一度同期します。");
    armTurnHandoffWatchdog("resolving");
    await syncMatch();
  }
};

const useSkill = (skillKey) => {
  if (battleState.phase !== "player") {
    return;
  }

  const skill = skills[skillKey];
  const cooldown = battleState.cooldowns[skillKey] ?? 0;

  if (!skill || cooldown > 0) {
    return;
  }

  startQuestionSession(skillKey);
};

const resetBattle = () => {
  battleState.phase = "idle";
  battleState.playerHp = maxHp;
  battleState.opponentHp = maxHp;
  battleState.playerGuardReduction = 0;
  battleState.opponentGuardReduction = 0;
  battleState.cooldowns.recover = 0;
  battleState.cooldowns.guard = 0;
  battleState.cooldowns.burst = 0;
  battleState.questionSession = null;
  battleState.match = null;
  battleState.lastMatchVersion = -1;
  battleState.rouletteRunId += 1;
  stopTurnHandoffWatchdog();
  stopTurnRoulette();
  questionPanel.hidden = true;
  updateHpDisplay();
  updateGuardOverlay();
  updateSkillButtons();
};

const hydrateRemoteMatch = (match) => {
  const opponentId = match.playerIds.find((id) => id !== battleState.playerId);
  battleState.match = match;
  battleState.lastMatchVersion = Number.isInteger(match.version) ? match.version : -1;
  battleState.playerHp = match.hpByPlayerId?.[battleState.playerId] ?? maxHp;
  battleState.opponentHp = match.hpByPlayerId?.[opponentId] ?? maxHp;
  battleState.playerGuardReduction = match.guardByPlayerId?.[battleState.playerId] ?? 0;
  battleState.opponentGuardReduction = match.guardByPlayerId?.[opponentId] ?? 0;
  battleState.cooldowns = { ...battleState.cooldowns, ...(match.cooldownsByPlayerId?.[battleState.playerId] ?? {}) };
  updateHpDisplay();
  updateGuardOverlay();
};

const beginMatchedBattle = async (match) => {
  if (!["idle", "matching"].includes(battleState.phase)) {
    return;
  }

  hydrateRemoteMatch(match);
  battleState.lastMatchHeartbeatAt = 0;
  if (battleState.matchingTimerId) {
    window.clearInterval(battleState.matchingTimerId);
    battleState.matchingTimerId = null;
  }
  battleState.phase = "roulette";
  setBattleMessage("参加が確定しました。順番を決めています。");
  await loadQuestions();
  battleScene.classList.add("is-visible");
  playBattleAudio();
  const firstIsPlayer = match.firstPlayerId === battleState.playerId;
  const rouletteCompleted = await playTurnRoulette(firstIsPlayer);
  if (!rouletteCompleted || battleState.phase !== "roulette") {
    return;
  }
  if (firstIsPlayer) {
    startPlayerTurn();
  } else {
    startOpponentTurn();
  }
  startMatchSync();
};

const pollMatching = async () => {
  if (!["idle", "matching"].includes(battleState.phase)) {
    return;
  }

  battleState.phase = "matching";
  try {
    const session = await postSessionAction({ action: "joinMatch", playerId: battleState.playerId });
    if (battleState.phase !== "matching") {
      return;
    }
    applyRemoteSession(session);
    if (session.matchStatus === "eliminated") {
      forceReturnToTitle("今回は終了したため、次の回まで参加できません。");
      return;
    }
    if (session.matchStatus === "closed") {
      forceReturnToTitle("現在実施していません。");
      return;
    }
    if (session.matchStatus === "matchedPending") {
      setBattleMessage("参加が確定しました。相手の準備完了を待っています。");
    }
    if (session.matchStatus === "matched" && session.match) {
      if (battleState.matchingTimerId) {
        window.clearInterval(battleState.matchingTimerId);
        battleState.matchingTimerId = null;
      }
      await beginMatchedBattle(session.match);
      return;
    }
    setBattleMessage("相手を探しています。同じタイミングで参加している人とランダムに接続します。");
  } catch (error) {
    battleState.phase = "matching";
    setBattleMessage("参加状態の確認に失敗しました。自動で再接続しています...");
  }
};

const startBattleScene = async () => {
  if (nextScreen.classList.contains("is-battle-starting")) {
    return;
  }

  if (!battleState.hosted) {
    setBattleMessage("管理者が学習クイズを開始するまで参加できません。");
    return;
  }
  if (battleState.eliminatedTournamentId === battleState.tournamentId) {
    setBattleMessage("今回は終了したため、次の回まで参加できません。");
    return;
  }
  if (battleState.closingRound) {
    setBattleMessage("参加受付を締め切りました。次の開始を待ってください。");
    return;
  }

  matchingButton.disabled = true;
  nextScreen.classList.add("is-battle-starting");
  battleScene.classList.add("is-visible");
  playBattleAudio();
  resetBattle();
  setBattleMessage("相手を探しています...");
  await pollMatching();
  if (!battleState.matchingTimerId && battleState.phase === "matching") {
    battleState.matchingTimerId = window.setInterval(pollMatching, matchingPollMs);
  }
};

const showNextScreen = () => {
  opening.hidden = true;
  nextScreen.classList.add("is-visible");
  fadeOverlay.classList.remove("is-dark");

  window.setTimeout(() => {
    titleImage.classList.add("is-visible");

    window.setTimeout(() => {
      titleImage.classList.add("is-settled");

      window.setTimeout(() => {
        updateSessionUi();
        adminButton.classList.add("is-visible");
      }, titleMoveDurationMs);
    }, titleFadeDurationMs + titleMoveDelayMs);
  }, titleAppearDelayMs);
};

matchingButton.addEventListener("click", startBattleScene);

adminButton.addEventListener("click", async () => {
  const authenticated = await showPasswordGate("admin");
  if (authenticated) {
    adminScreen.hidden = false;
    adminButton.classList.remove("is-visible");
    matchingButton.classList.remove("is-visible");
    sessionNotice?.classList.remove("is-visible");
  }
});

adminGameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (battleState.hosted) {
    updateSessionUi();
    return;
  }

  const formData = new FormData(adminGameForm);
  const nextSubjectKey = String(formData.get("subject") ?? "math");
  battleState.selectedSubjectKey = subjects[nextSubjectKey] ? nextSubjectKey : "math";
  battleState.adminBusy = true;
  updateAdminButtonStates();
  adminStatus.textContent = "オンラインに実施状態を保存しています...";
  let failed = false;
  try {
    await saveRemoteSession({ hosted: true, selectedSubjectKey: battleState.selectedSubjectKey });
    await loadQuestions();
  } catch (error) {
    failed = true;
    adminStatus.textContent = getSessionErrorMessage(error, "実施状態の保存に失敗しました。Cloudflare の GAME_SESSION_KV と ADMIN_PASSWORD を確認してください。");
  } finally {
    battleState.adminBusy = false;
    if (failed) {
      updateAdminButtonStates();
    } else {
      updateSessionUi();
    }
  }
});

adminStopButton.addEventListener("click", async () => {
  if (!battleState.hosted) {
    updateSessionUi();
    return;
  }

  battleState.adminBusy = true;
  updateAdminButtonStates();
  adminStatus.textContent = "オンラインに実施終了を保存しています...";
  let failed = false;
  try {
    await saveRemoteSession({ hosted: false, selectedSubjectKey: battleState.selectedSubjectKey });
  } catch (error) {
    failed = true;
    adminStatus.textContent = getSessionErrorMessage(error, "実施終了の保存に失敗しました。Cloudflare の GAME_SESSION_KV と ADMIN_PASSWORD を確認してください。");
  } finally {
    battleState.adminBusy = false;
    if (failed) {
      updateAdminButtonStates();
    } else {
      updateSessionUi();
    }
  }
});

adminRoundButton.addEventListener("click", async () => {
  if (!battleState.hosted) {
    updateSessionUi();
    return;
  }

  battleState.adminBusy = true;
  updateAdminButtonStates();
  const nextRoundLabel = battleState.round === 0 ? "第2回開始" : `第${battleState.round + 2}回開始`;
  adminStatus.textContent = `5秒後に${nextRoundLabel}に進みます...`;
  try {
    await postSessionAction({ action: "advanceRound", adminPassword: authState.adminPassword });
    adminRoundButton.textContent = nextRoundLabel;
    await loadRemoteSession();
  } catch (error) {
    adminStatus.textContent = "回進行に失敗しました。";
  } finally {
    battleState.adminBusy = false;
    updateAdminButtonStates();
  }
});


adminDebugButton?.addEventListener("click", async () => {
  battleState.adminBusy = true;
  updateAdminButtonStates();
  adminStatus.textContent = "KV の接続状態を確認しています...";
  try {
    const result = await postSessionAction({
      action: "diagnoseSessionStore",
      adminPassword: authState.adminPassword,
    });
    showAdminDebugResult(result);
    adminStatus.textContent = result.activeBinding
      ? `KV デバッグ完了: ${result.activeBinding} で読み書きできました。`
      : "KV デバッグ完了: 詳細を下の表示で確認してください。";
  } catch (error) {
    showAdminDebugResult(error.result ?? { ok: false, message: error.message, status: error.status });
    adminStatus.textContent = getSessionErrorMessage(error, "KV デバッグに失敗しました。詳細を下の表示で確認してください。");
  } finally {
    battleState.adminBusy = false;
    updateAdminButtonStates();
  }
});

adminResetTournamentButton.addEventListener("click", async () => {
  adminResetTournamentButton.disabled = true;
  adminStatus.textContent = "実施番号をリセットしています...";
  try {
    await postSessionAction({ action: "resetTournamentNumber", adminPassword: authState.adminPassword });
    localStorage.removeItem("schoolRpgEliminatedTournamentId");
    battleState.eliminatedTournamentId = -1;
    adminRoundButton.textContent = "最初の参加受付締め切り";
    await loadRemoteSession();
  } catch (error) {
    adminStatus.textContent = "実施番号のリセットに失敗しました。";
  } finally {
    adminResetTournamentButton.disabled = false;
  }
});

adminBackButton.addEventListener("click", () => {
  adminScreen.hidden = true;
  if (!nextScreen.classList.contains("is-battle-starting")) {
    adminButton.classList.add("is-visible");
    updateSessionUi();
  }
});

passwordForm.addEventListener("submit", handlePasswordSubmit);

passwordCancelButton.addEventListener("click", () => {
  if (passwordModes[authState.mode].allowCancel) {
    closePasswordGate(false);
  }
});

questionChoices.addEventListener("click", handleChoiceClick);

battleActions.addEventListener("click", (event) => {
  const button = event.target.closest(".battle-action");

  if (!button) {
    return;
  }

  useSkill(button.dataset.skill);
});

// pagehide also fires for mobile tab/app switches and bfcache transitions, which made
// active players look disconnected. Only send an explicit leave signal for real unloads.
window.addEventListener("beforeunload", notifyPlayerDisconnected);
window.addEventListener("online", () => {
  if (["matching", "roulette", "player", "opponent", "question", "resolving"].includes(battleState.phase)) {
    syncMatch();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && ["matching", "roulette", "player", "opponent", "question", "resolving"].includes(battleState.phase)) {
    syncMatch();
  }
});

window.addEventListener("load", async () => {
  await loadRemoteSession();
  resetBattle();
  loadQuestions();
  window.setInterval(loadRemoteSession, 5000);

  authState.startupUnlocked = await showPasswordGate("startup");
  if (!authState.startupUnlocked) {
    return;
  }

  window.setTimeout(() => {
    openingImage.classList.add("is-visible");
    playOpeningAudio();

    window.setTimeout(() => {
      fadeOverlay.classList.add("is-dark");
      window.setTimeout(showNextScreen, fadeDurationMs);
    }, fadeStartDelayMs);
  }, openingDelayMs);
});


document.addEventListener("dragstart", (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

document.querySelectorAll("img").forEach((image) => {
  image.draggable = false;
});

turnLabel.addEventListener("animationend", () => {
  turnLabel.classList.remove("is-entering");
});
