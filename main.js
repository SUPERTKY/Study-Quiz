const openingDelayMs = 1000;
const fadeStartDelayMs = 3000;
const fadeDurationMs = 1000;
const titleAppearDelayMs = 1500;
const titleFadeDurationMs = 1000;
const titleMoveDelayMs = 1000;
const titleMoveDurationMs = 800;
const maxHp = 120;
const opponentWaitMs = 5000;
const fallbackPoint = 1;

const opening = document.querySelector("#opening");
const openingImage = document.querySelector("#openingImage");
const openingAudio = document.querySelector("#openingAudio");
const turnStartAudio = document.querySelector("#turnStartAudio");
const fadeOverlay = document.querySelector("#fadeOverlay");
const nextScreen = document.querySelector("#nextScreen");
const titleImage = document.querySelector("#titleImage");
const matchingButton = document.querySelector("#matchingButton");
const battleScene = document.querySelector("#battleScene");
const battleActions = document.querySelector("#battleActions");
const battleMessage = document.querySelector("#battleMessage");
const turnLabel = document.querySelector("#turnLabel");
const playerHpText = document.querySelector("#playerHpText");
const opponentHpText = document.querySelector("#opponentHpText");
const playerHpGauge = document.querySelector("#playerHpGauge");
const opponentHpGauge = document.querySelector("#opponentHpGauge");
const skillButtons = Array.from(document.querySelectorAll(".battle-action"));

const skills = {
  attack: {
    name: "アタック",
    base: 8,
    perPoint: 4,
    type: "damage",
    cooldownTurns: 0,
  },
  recover: {
    name: "リカバー",
    base: 6,
    perPoint: 3,
    type: "recover",
    cooldownTurns: 1,
  },
  guard: {
    name: "ガード",
    base: 15,
    perPoint: 7,
    type: "guard",
    cooldownTurns: 1,
    maxReduction: 60,
  },
  burst: {
    name: "バースト",
    base: 16,
    perPoint: 8,
    type: "damage",
    cooldownTurns: 1,
  },
};

const battleState = {
  phase: "idle",
  playerHp: maxHp,
  opponentHp: maxHp,
  playerGuardReduction: 0,
  cooldowns: {
    recover: 0,
    guard: 0,
    burst: 0,
  },
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
};

const updateHpDisplay = () => {
  playerHpText.textContent = `${battleState.playerHp} / ${maxHp}`;
  opponentHpText.textContent = `${battleState.opponentHp} / ${maxHp}`;
  playerHpGauge.style.transform = `scaleX(${battleState.playerHp / maxHp})`;
  opponentHpGauge.style.transform = `scaleX(${battleState.opponentHp / maxHp})`;
};

const updateSkillButtons = () => {
  const isPlayerTurn = battleState.phase === "player";

  skillButtons.forEach((button) => {
    const skillKey = button.dataset.skill;
    const cooldown = battleState.cooldowns[skillKey] ?? 0;
    button.disabled = !isPlayerTurn || cooldown > 0 || battleState.opponentHp <= 0;
    button.classList.toggle("is-on-cooldown", cooldown > 0);
    button.title = cooldown > 0 ? `${skills[skillKey].name}は次の自分のターンまで使えません` : skills[skillKey].name;
  });
};

const tickCooldownsAtPlayerTurnStart = () => {
  Object.keys(battleState.cooldowns).forEach((skillKey) => {
    battleState.cooldowns[skillKey] = Math.max(0, battleState.cooldowns[skillKey] - 1);
  });
};

const startPlayerTurn = () => {
  battleState.phase = "player";
  tickCooldownsAtPlayerTurnStart();
  turnLabel.textContent = "自分のターン";
  setBattleMessage("自分のターンです。バトルアイコンから技を選んでください。");
  updateSkillButtons();
  playAudioFromStart(turnStartAudio);
};

const startOpponentTurn = () => {
  battleState.phase = "opponent";
  turnLabel.textContent = "相手のターン";
  setBattleMessage("相手のターンです。今は5秒待機します。");
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
    turnLabel.textContent = "勝利";
    setBattleMessage("相手のHPが0になりました。勝利です！");
    updateSkillButtons();
    return true;
  }

  if (battleState.playerHp <= 0) {
    battleState.phase = "finished";
    turnLabel.textContent = "敗北";
    setBattleMessage("自分のHPが0になりました。敗北です。");
    updateSkillButtons();
    return true;
  }

  return false;
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

  const effectValue = Math.round(skill.base + fallbackPoint * skill.perPoint);
  let message = "";

  if (skill.type === "damage") {
    battleState.opponentHp = Math.max(0, battleState.opponentHp - effectValue);
    message = `${skill.name}！ 問題ファイル未使用のためポイント${fallbackPoint}で、相手に${effectValue}ダメージ。`;
  }

  if (skill.type === "recover") {
    const beforeHp = battleState.playerHp;
    battleState.playerHp = Math.min(maxHp, battleState.playerHp + effectValue);
    message = `${skill.name}！ 問題ファイル未使用のためポイント${fallbackPoint}で、自分のHPを${battleState.playerHp - beforeHp}回復。`;
  }

  if (skill.type === "guard") {
    const reduction = Math.min(skill.maxReduction, effectValue);
    battleState.playerGuardReduction = reduction;
    message = `${skill.name}！ 問題ファイル未使用のためポイント${fallbackPoint}で、次に受けるダメージを${reduction}%軽減。`;
  }

  if (skill.cooldownTurns > 0) {
    battleState.cooldowns[skillKey] = skill.cooldownTurns + 1;
  }

  updateHpDisplay();
  setBattleMessage(message);

  if (!finishBattleIfNeeded()) {
    window.setTimeout(startOpponentTurn, 900);
  }
};

const resetBattle = () => {
  battleState.phase = "idle";
  battleState.playerHp = maxHp;
  battleState.opponentHp = maxHp;
  battleState.playerGuardReduction = 0;
  battleState.cooldowns.recover = 0;
  battleState.cooldowns.guard = 0;
  battleState.cooldowns.burst = 0;
  updateHpDisplay();
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
      }, titleMoveDurationMs);
    }, titleFadeDurationMs + titleMoveDelayMs);
  }, titleAppearDelayMs);
};

matchingButton.addEventListener("click", startBattleScene);

battleActions.addEventListener("click", (event) => {
  const button = event.target.closest(".battle-action");

  if (!button) {
    return;
  }

  useSkill(button.dataset.skill);
});

window.addEventListener("load", () => {
  resetBattle();

  window.setTimeout(() => {
    openingImage.classList.add("is-visible");
    playOpeningAudio();

    window.setTimeout(() => {
      fadeOverlay.classList.add("is-dark");
      window.setTimeout(showNextScreen, fadeDurationMs);
    }, fadeStartDelayMs);
  }, openingDelayMs);
});
