const openingDelayMs = 1000;
const fadeStartDelayMs = 3000;
const fadeDurationMs = 1000;
const titleAppearDelayMs = 1500;
const titleFadeDurationMs = 1000;
const titleMoveDelayMs = 1000;
const titleMoveDurationMs = 800;
const maxHp = 120;
const opponentWaitMs = 5000;
const questionDurationSeconds = 20;
const feedbackDurationMs = 260;
const authEndpoint = "/api/auth";
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
const fadeOverlay = document.querySelector("#fadeOverlay");
const nextScreen = document.querySelector("#nextScreen");
const titleImage = document.querySelector("#titleImage");
const matchingButton = document.querySelector("#matchingButton");
const adminButton = document.querySelector("#adminButton");
const adminScreen = document.querySelector("#adminScreen");
const adminBackButton = document.querySelector("#adminBackButton");
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
};

const battleState = {
  phase: "idle",
  mathQuestions: [],
  questionSession: null,
  playerHp: maxHp,
  opponentHp: maxHp,
  playerGuardReduction: 0,
  cooldowns: {
    recover: 0,
    guard: 0,
    burst: 0,
  },
};


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

const loadMathQuestions = async () => {
  try {
    const response = await fetch("questions/math_questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`問題ファイルを読み込めませんでした: ${response.status}`);
    }

    const questions = await response.json();
    battleState.mathQuestions = Array.isArray(questions) ? questions : [];
    if (subjectLabel) {
      subjectLabel.textContent = "教科: 数学";
    }
  } catch (error) {
    battleState.mathQuestions = [];
    setBattleMessage("questions/math_questions.json の読み込みに失敗しました。ページを再読み込みしてください。");
  }
};

const isQuestionVisible = (question) => question.visible !== false;

const getQuestionsByDifficulty = (difficulty) =>
  battleState.mathQuestions.filter(
    (question) => question.difficulty === difficulty && question.subject === "数学" && isQuestionVisible(question),
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

  const question = session.questions[session.index];
  questionText.textContent = question.question;
  questionChoices.innerHTML = "";
  answerFeedback.textContent = "";
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
    setBattleMessage("この技に対応する数学の問題がありません。questions/math_questions.json を確認してください。");
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
  answerFeedback.textContent = isCorrect ? "正解！" : "不正解";
  answerFeedback.dataset.result = isCorrect ? "correct" : "wrong";
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
  tickCooldownsAtPlayerTurnStart();
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

const startOpponentTurn = () => {
  battleState.phase = "opponent";
  turnLabel.classList.remove("is-entering");
  turnLabel.src = "assets/images/ui/Icon/enemy_turn.png";
  turnLabel.alt = "相手のターン";
  setBattleMessage("");
  updateSkillButtons();

  window.setTimeout(() => {
    if (battleState.phase === "opponent" && battleState.playerHp > 0 && battleState.opponentHp > 0) {
      startPlayerTurn();
    }
  }, opponentWaitMs);
};

const finishBattleIfNeeded = () => {
  if (battleState.opponentHp <= 0) {
    battleState.phase = "finished";
    turnLabel.alt = "勝利";
    setBattleMessage("相手のHPが0になりました。勝利です！");
    updateSkillButtons();
    return true;
  }

  if (battleState.playerHp <= 0) {
    battleState.phase = "finished";
    turnLabel.alt = "敗北";
    setBattleMessage("自分のHPが0になりました。敗北です。");
    updateSkillButtons();
    return true;
  }

  return false;
};

const applySkillResult = (skillKey, effectivePoint, correct, wrong) => {
  const skill = skills[skillKey];
  const effectValue = Math.round(skill.base + effectivePoint * skill.perPoint);
  const scoreText = `正解${correct}・誤答${wrong}・有効得点${effectivePoint}`;
  let message = "";
  let damageTarget = null;
  let recoverAmount = 0;

  if (skill.type === "damage") {
    battleState.opponentHp = Math.max(0, battleState.opponentHp - effectValue);
    message = `${skill.name}！ ${scoreText}で、相手に${effectValue}ダメージ。`;
    damageTarget = opponentCharacter;
  }

  if (skill.type === "recover") {
    const beforeHp = battleState.playerHp;
    battleState.playerHp = Math.min(maxHp, battleState.playerHp + effectValue);
    recoverAmount = battleState.playerHp - beforeHp;
    message = `${skill.name}！ ${scoreText}で、自分のHPを${recoverAmount}回復。`;
  }

  if (skill.type === "guard") {
    const reduction = Math.min(skill.maxReduction, effectValue);
    battleState.playerGuardReduction = reduction;
    message = `${skill.name}！ ${scoreText}で、次に受けるダメージを${reduction}%軽減。`;
  }

  if (skill.cooldownTurns > 0) {
    battleState.cooldowns[skillKey] = skill.cooldownTurns + 1;
  }

  updateHpDisplay();
  updateGuardOverlay();
  playDamageEffect(damageTarget, skill.type === "damage" ? effectValue : 0);
  if (skill.type === "damage") {
    playDamageAudio(effectValue);
  }
  if (skill.type === "recover") {
    playRecoverEffect(playerCharacter);
    playAudioFromStart(recoverAudio);
  }
  if (skill.type === "guard") {
    playAudioFromStart(guardAudio);
  }
  setBattleMessage(message);

  if (!finishBattleIfNeeded()) {
    window.setTimeout(startOpponentTurn, 900);
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
  questionPanel.hidden = true;
  updateHpDisplay();
  updateGuardOverlay();
  updateSkillButtons();
};

const startBattleScene = () => {
  if (nextScreen.classList.contains("is-battle-starting")) {
    return;
  }

  matchingButton.disabled = true;
  nextScreen.classList.add("is-battle-starting");
  resetBattle();

  window.setTimeout(() => {
    battleScene.classList.add("is-visible");
    startPlayerTurn();
  }, 600);
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
        matchingButton.classList.add("is-visible");
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
  }
});

adminBackButton.addEventListener("click", () => {
  adminScreen.hidden = true;
  if (!nextScreen.classList.contains("is-battle-starting")) {
    adminButton.classList.add("is-visible");
    matchingButton.classList.add("is-visible");
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
  resetBattle();
  loadMathQuestions();

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
