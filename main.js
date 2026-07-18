const openingDelayMs = 1000;
const fadeStartDelayMs = 3000;
const fadeDurationMs = 1000;
const titleAppearDelayMs = 1500;
const titleFadeDurationMs = 1000;
const titleMoveDelayMs = 1000;
const titleMoveDurationMs = 800;
const maxHp = 120;
const matchingPollMs = 1500;
const resultReturnMs = 10000;
const questionDurationSeconds = 20;
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
    description: "ゲームを開始するにはパスワードを入力してください。",
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
const skillButtons = Array.from(document.querySelectorAll(".battle-action"));

const skills = {
  attack: {
    name: "アタック",
    difficulty: "normal",
    base: 8,
    perPoint: 4,
    type: "damage",
    cooldownTurns: 0,
  },
  recover: {
    name: "リカバー",
    difficulty: "normal",
    base: 6,
    perPoint: 3,
    type: "recover",
    cooldownTurns: 1,
  },
  guard: {
    name: "ガード",
    difficulty: "normal",
    base: 15,
    perPoint: 7,
    type: "guard",
    cooldownTurns: 1,
    maxReduction: 60,
  },
  burst: {
    name: "バースト",
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
  playerId: localStorage.getItem("schoolRpgPlayerId") || crypto.randomUUID(),
  match: null,
  lastMatchVersion: -1,
  matchSyncTimerId: null,
  matchingTimerId: null,
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

const updateSessionUi = () => {
  const subject = getSelectedSubject();
  const statusText = battleState.hosted
    ? `開催中: ${subject.label} / 大会${battleState.tournamentId} 第${battleState.round + 1}マッチング${battleState.closingRound ? "締め切り中" : ""}`
    : "現在は開催していません。管理者画面で教科を選んで開催してください。";

  subjectLabel.textContent = `教科: ${subject.label}`;
  const isEliminated = battleState.eliminatedTournamentId === battleState.tournamentId;
  matchingButton.disabled = !battleState.hosted || isEliminated || battleState.closingRound;
  matchingButton.title = battleState.hosted ? `${subject.label}でマッチング開始` : "";
  matchingButton.classList.toggle("is-visible", battleState.hosted && titleImage.classList.contains("is-settled"));
  if (sessionNotice) {
    sessionNotice.hidden = battleState.hosted && !isEliminated && !battleState.closingRound;
    sessionNotice.textContent = !battleState.hosted ? "現在開催していません。管理者が開催するまで遊べません。" : isEliminated ? "一回負けたため、次の大会までマッチングできません。" : "マッチング締め切り中です。次のトーナメント開始を待ってください。";
    sessionNotice.classList.toggle("is-visible", !sessionNotice.hidden && titleImage.classList.contains("is-settled"));
  }
  if (adminStatus) {
    adminStatus.textContent = statusText;
  }
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
    forceReturnToTitle("開催が終了したため、バトルを強制終了しました。");
  }
  updateSessionUi();
};

const loadRemoteSession = async () => {
  try {
    const response = await fetch(sessionEndpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`開催状態を読み込めませんでした: ${response.status}`);
    }

    applyRemoteSession(await response.json());
  } catch (error) {
    updateSessionUi();
    if (sessionNotice) {
      sessionNotice.textContent = "オンラインの開催状態を確認できません。管理者に確認してください。";
      sessionNotice.hidden = false;
      sessionNotice.classList.toggle("is-visible", titleImage.classList.contains("is-settled"));
    }
  }
};

const saveRemoteSession = async (session) => {
  const response = await fetch(sessionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, adminPassword: authState.adminPassword }),
  });

  if (!response.ok) {
    throw new Error(`開催状態を保存できませんでした: ${response.status}`);
  }

  applyRemoteSession(await response.json());
};



const postSessionAction = async (payload) => {
  const response = await fetch(sessionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`セッション操作に失敗しました: ${response.status}`);
    error.result = result;
    throw error;
  }
  return result;
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

const forceReturnToTitle = (message = "タイトルに戻りました。") => {
  if (battleState.questionSession?.timerId) {
    window.clearInterval(battleState.questionSession.timerId);
  }
  if (battleState.matchingTimerId) {
    window.clearInterval(battleState.matchingTimerId);
    battleState.matchingTimerId = null;
  }
  stopMatchSync();
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
  updateSkillButtons();
  const won = result === "win";
  const defeatedCharacter = won ? opponentCharacter : playerCharacter;
  playAudioFromStart(fallOverAudio);
  defeatedCharacter.classList.add("is-falling");
  await new Promise((resolve) => window.setTimeout(resolve, 1300));
  resultImage.src = won ? "assets/images/ui/Victory.png" : "assets/images/ui/defeat.png";
  resultImage.alt = won ? "勝利" : "敗北";
  resultOverlay.hidden = false;
  playAudioFromStart(won ? victoryAudio : defeatAudio);
  if (!won) {
    battleState.eliminatedTournamentId = battleState.tournamentId;
    localStorage.setItem("schoolRpgEliminatedTournamentId", String(battleState.tournamentId));
  }
  postSessionAction({ action: "finishMatch", playerId: battleState.playerId, matchId: battleState.match?.id, result }).catch(() => {});
  window.setTimeout(() => forceReturnToTitle(won ? "勝利しました。" : "敗北しました。次の大会まで参加できません。"), resultReturnMs);
};

const playTurnRoulette = async (firstIsPlayer) => {
  turnLabel.classList.add("is-hidden-before-start");
  turnRoulette.classList.add("is-playing");
  const yourTurnImage = "assets/images/ui/Icon/your_turn.png";
  const enemyTurnImage = "assets/images/ui/Icon/enemy_turn.png";
  const rouletteImages = firstIsPlayer ? [enemyTurnImage, yourTurnImage] : [yourTurnImage, enemyTurnImage];
  let index = 0;
  turnRouletteImage.src = rouletteImages[index];
  const timerId = window.setInterval(() => {
    index += 1;
    turnRouletteImage.src = rouletteImages[index % rouletteImages.length];
  }, 120);
  await new Promise((resolve) => window.setTimeout(resolve, 2160));
  window.clearInterval(timerId);
  turnRouletteImage.src = firstIsPlayer ? yourTurnImage : enemyTurnImage;
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  turnRoulette.classList.remove("is-playing");
  turnLabel.classList.remove("is-hidden-before-start");
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
  const effectivePoint = Math.max(0, session.correct - session.wrong * 0.5);
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
    setBattleMessage("この技に対応する開催教科の問題がありません。questions フォルダを確認してください。");
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
    button.title = cooldown > 0 ? `${skills[skillKey].name}は次の自分のターンまで使えません` : skills[skillKey].name;
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

const updateGuardOverlay = () => {
  if (!playerGuardOverlay || !playerGuardValue) {
    return;
  }

  const reduction = battleState.playerGuardReduction;
  playerGuardOverlay.classList.toggle("is-active", reduction > 0);
  playerGuardValue.textContent = `${reduction}%`;
};

const tickCooldownsAtPlayerTurnStart = () => {
  Object.keys(battleState.cooldowns).forEach((skillKey) => {
    battleState.cooldowns[skillKey] = Math.max(0, battleState.cooldowns[skillKey] - 1);
  });
};

const startPlayerTurn = () => {
  battleState.phase = "player";
  battleState.playerGuardReduction = 0;
  turnLabel.src = "assets/images/ui/Icon/your_turn.png";
  turnLabel.alt = "自分のターン";
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
  battleState.match = match;
  battleState.lastMatchVersion = Number.isInteger(match.version) ? match.version : previousVersion;
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
    if (match.lastAction.skillType === "recover" && actionByMe) {
      playRecoverEffect(playerCharacter);
      playAudioFromStart(recoverAudio);
    }
    if (match.lastAction.skillType === "guard" && actionByMe) {
      playAudioFromStart(guardAudio);
    }
  }

  if (match.finished) {
    stopMatchSync();
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
  if (!battleState.match?.id || battleState.phase === "finished") {
    return;
  }
  try {
    const session = await postSessionAction({ action: "getMatch", playerId: battleState.playerId, matchId: battleState.match.id });
    applyRemoteSession(session);
    if (session.match) {
      applyRemoteMatch(session.match);
    }
  } catch (error) {
    setBattleMessage("相手との同期に失敗しました。再接続を待っています...");
  }
};

const startMatchSync = () => {
  stopMatchSync();
  battleState.matchSyncTimerId = window.setInterval(syncMatch, 1000);
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
  turnLabel.alt = "相手のターン";
  setBattleMessage("相手のターンです。相手の操作を待っています。");
  updateSkillButtons();
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
  const scoreText = `正解${correct}・誤答${wrong}・有効得点${effectivePoint}`;
  let message = "";
  let guardReduction = 0;

  if (skill.type === "damage") {
    message = `${skill.name}！ ${scoreText}で、相手に${effectValue}ダメージを送信。`;
  }

  if (skill.type === "recover") {
    message = `${skill.name}！ ${scoreText}で、自分のHPを${effectValue}回復送信。`;
  }

  if (skill.type === "guard") {
    guardReduction = Math.min(skill.maxReduction, effectValue);
    message = `${skill.name}！ ${scoreText}で、次に受けるダメージを${guardReduction}%軽減。`;
  }

  battleState.phase = "resolving";
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
      setBattleMessage(error.result.matchStatus === "versionMismatch" ? "相手との状態を更新しました。もう一度操作してください。" : "現在は自分のターンではありません。");
      return;
    }
    setBattleMessage("技の送信に失敗しました。もう一度同期します。");
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
  battleState.cooldowns.recover = 0;
  battleState.cooldowns.guard = 0;
  battleState.cooldowns.burst = 0;
  battleState.questionSession = null;
  battleState.match = null;
  battleState.lastMatchVersion = -1;
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
  hydrateRemoteMatch(match);
  if (battleState.matchingTimerId) {
    window.clearInterval(battleState.matchingTimerId);
    battleState.matchingTimerId = null;
  }
  battleState.phase = "roulette";
  setBattleMessage("マッチングしました！ 先攻・後攻を決めています。");
  await loadQuestions();
  battleScene.classList.add("is-visible");
  const firstIsPlayer = match.firstPlayerId === battleState.playerId;
  await playTurnRoulette(firstIsPlayer);
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
    applyRemoteSession(session);
    if (session.matchStatus === "eliminated") {
      forceReturnToTitle("一回負けたため、次の大会までマッチングできません。");
      return;
    }
    if (session.matchStatus === "closed") {
      forceReturnToTitle("現在開催していません。");
      return;
    }
    if (session.matchStatus === "matched" && session.match) {
      if (battleState.matchingTimerId) {
        window.clearInterval(battleState.matchingTimerId);
        battleState.matchingTimerId = null;
      }
      await beginMatchedBattle(session.match);
      return;
    }
    setBattleMessage("相手を探しています。同じタイミングで探している人とランダムにマッチングします。");
  } catch (error) {
    battleState.phase = "idle";
    setBattleMessage("マッチング状態の確認に失敗しました。通信を確認してください。");
  }
};

const startBattleScene = async () => {
  if (nextScreen.classList.contains("is-battle-starting")) {
    return;
  }

  if (!battleState.hosted) {
    setBattleMessage("管理者がゲームを開催するまで遊べません。");
    return;
  }
  if (battleState.eliminatedTournamentId === battleState.tournamentId) {
    setBattleMessage("一回負けたため、次の大会までマッチングできません。");
    return;
  }
  if (battleState.closingRound) {
    setBattleMessage("マッチング締め切り中です。次の開始を待ってください。");
    return;
  }

  matchingButton.disabled = true;
  nextScreen.classList.add("is-battle-starting");
  battleScene.classList.add("is-visible");
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
  const formData = new FormData(adminGameForm);
  const nextSubjectKey = String(formData.get("subject") ?? "math");
  battleState.selectedSubjectKey = subjects[nextSubjectKey] ? nextSubjectKey : "math";
  adminHostButton.disabled = true;
  adminStatus.textContent = "オンラインに開催状態を保存しています...";
  try {
    await saveRemoteSession({ hosted: true, selectedSubjectKey: battleState.selectedSubjectKey });
    await loadQuestions();
  } catch (error) {
    adminStatus.textContent = "開催状態の保存に失敗しました。Cloudflare の GAME_SESSION_KV と ADMIN_PASSWORD を確認してください。";
  } finally {
    adminHostButton.disabled = false;
  }
});

adminStopButton.addEventListener("click", async () => {
  adminStopButton.disabled = true;
  adminStatus.textContent = "オンラインに開催終了を保存しています...";
  try {
    await saveRemoteSession({ hosted: false, selectedSubjectKey: battleState.selectedSubjectKey });
  } catch (error) {
    adminStatus.textContent = "開催終了の保存に失敗しました。Cloudflare の GAME_SESSION_KV と ADMIN_PASSWORD を確認してください。";
  } finally {
    adminStopButton.disabled = false;
  }
});

adminRoundButton.addEventListener("click", async () => {
  adminRoundButton.disabled = true;
  const nextRoundLabel = battleState.round === 0 ? "トーナメント2次開始" : `トーナメント${battleState.round + 2}次開始`;
  adminStatus.textContent = `5秒後に${nextRoundLabel}に進みます...`;
  try {
    await postSessionAction({ action: "advanceRound", adminPassword: authState.adminPassword });
    adminRoundButton.textContent = nextRoundLabel;
    await loadRemoteSession();
  } catch (error) {
    adminStatus.textContent = "トーナメント進行に失敗しました。";
  } finally {
    adminRoundButton.disabled = false;
  }
});


adminResetTournamentButton.addEventListener("click", async () => {
  adminResetTournamentButton.disabled = true;
  adminStatus.textContent = "大会番号をリセットしています...";
  try {
    await postSessionAction({ action: "resetTournamentNumber", adminPassword: authState.adminPassword });
    localStorage.removeItem("schoolRpgEliminatedTournamentId");
    battleState.eliminatedTournamentId = -1;
    adminRoundButton.textContent = "大会最初のマッチング締め切り";
    await loadRemoteSession();
  } catch (error) {
    adminStatus.textContent = "大会番号のリセットに失敗しました。";
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
