const openingDelayMs = 1000;
const fadeStartDelayMs = 3000;
const fadeDurationMs = 1000;
const titleAppearDelayMs = 1500;
const titleFadeDurationMs = 1000;
const titleMoveDelayMs = 1000;
const titleMoveDurationMs = 800;

const opening = document.querySelector("#opening");
const openingImage = document.querySelector("#openingImage");
const openingAudio = document.querySelector("#openingAudio");
const fadeOverlay = document.querySelector("#fadeOverlay");
const nextScreen = document.querySelector("#nextScreen");
const titleImage = document.querySelector("#titleImage");
const matchingButton = document.querySelector("#matchingButton");
const battleScene = document.querySelector("#battleScene");

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

const startBattleScene = () => {
  if (nextScreen.classList.contains("is-battle-starting")) {
    return;
  }

  matchingButton.disabled = true;
  nextScreen.classList.add("is-battle-starting");

  window.setTimeout(() => {
    battleScene.classList.add("is-visible");
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

window.addEventListener("load", () => {
  window.setTimeout(() => {
    openingImage.classList.add("is-visible");
    playOpeningAudio();

    window.setTimeout(() => {
      fadeOverlay.classList.add("is-dark");
      window.setTimeout(showNextScreen, fadeDurationMs);
    }, fadeStartDelayMs);
  }, openingDelayMs);
});
