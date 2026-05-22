/**
 * 다 때려쳐 @office
 */

(function () {
  const gameScreen = document.getElementById("game-screen");
  const behindZone = document.getElementById("behind-zone");
  const boss = document.getElementById("boss");
  const bossSpeech = document.getElementById("boss-speech");
  const hitSpark = document.getElementById("hit-spark");
  const projLayer = document.getElementById("proj-layer");
  const fxLayer = document.getElementById("fx-layer");
  const controlPad = document.getElementById("control-pad");
  const throwsScroll = document.getElementById("throws-scroll");
  const myDesk = document.getElementById("my-desk");
  const myMonitor = document.getElementById("my-monitor");
  const monitorStatus = document.querySelector(".my-monitor-status");

  const YELL_TEXT = "Sibal";
  const BOSS_PAIN = "으악~~";
  const BOSS_SCREAM = "으악~~~!!!!";
  const COMING_SOON = "고마워 준비중이야...";
  const REVEAL_MS = 380;
  const heroineScene = document.getElementById("heroine-scene");
  const hairPullFx = document.getElementById("hair-pull-fx");

  const THROWS = {
    notebook: {
      type: "notebook",
      impact: "퍽!!",
      impactSize: "sm",
      sub: null,
      hitAt: 720,
      duration: 1400,
      bossHit: "is-hit",
      useDeskMonitor: false,
    },
    cup: {
      type: "cup",
      impact: "퍽~!",
      impactSize: "sm",
      sub: null,
      hitAt: 680,
      duration: 1450,
      bossHit: "is-hit",
      useDeskMonitor: false,
    },
    monitor: {
      type: "monitor",
      impact: "쾅!!!",
      impactSize: "lg",
      sub: "내 모니터 투척",
      hitAt: 820,
      duration: 1600,
      bossHit: "is-monitor-hit",
      useDeskMonitor: true,
    },
    phone: {
      type: "phone",
      impact: "띠링→퍽",
      impactSize: "sm",
      sub: null,
      hitAt: 700,
      duration: 1400,
      bossHit: "is-hit",
      useDeskMonitor: false,
    },
    chair: {
      type: "chair",
      impact: "쿵!!!!",
      impactSize: "lg",
      sub: "회전의자 각",
      hitAt: 900,
      duration: 1700,
      bossHit: "is-heavy-hit",
      useDeskMonitor: false,
    },
    keyboard: {
      type: "keyboard",
      impact: "딸깍! 퍽",
      impactSize: "sm",
      sub: null,
      hitAt: 700,
      duration: 1420,
      bossHit: "is-hit",
      useDeskMonitor: false,
    },
    mouse: {
      type: "mouse",
      impact: "찍!",
      impactSize: "sm",
      sub: null,
      hitAt: 660,
      duration: 1380,
      bossHit: "is-hit",
      useDeskMonitor: false,
    },
  };

  const PROJ_BUILDERS = {
    notebook(el) {
      el.innerHTML =
        '<span class="proj-notebook-cover" aria-hidden="true"></span>' +
        '<span class="proj-notebook-spine" aria-hidden="true"></span>' +
        '<span class="proj-notebook-lines" aria-hidden="true"></span>';
    },
    cup(el) {
      el.innerHTML =
        '<span class="proj-cup-body" aria-hidden="true"></span>' +
        '<span class="proj-cup-rim" aria-hidden="true"></span>' +
        '<span class="proj-cup-handle" aria-hidden="true"></span>';
    },
    phone(el) {
      el.innerHTML =
        '<span class="proj-phone-body" aria-hidden="true"></span>' +
        '<span class="proj-phone-screen" aria-hidden="true"></span>' +
        '<span class="proj-phone-home" aria-hidden="true"></span>';
    },
    chair(el) {
      el.innerHTML =
        '<span class="proj-chair-seat" aria-hidden="true"></span>' +
        '<span class="proj-chair-back" aria-hidden="true"></span>' +
        '<span class="proj-chair-base" aria-hidden="true"></span>' +
        '<span class="proj-chair-wheel" aria-hidden="true"></span>';
    },
    monitor(el) {
      el.innerHTML =
        '<span class="proj-mon-bezel" aria-hidden="true"></span>' +
        '<span class="proj-mon-screen" aria-hidden="true"></span>' +
        '<span class="proj-mon-stand" aria-hidden="true"></span>';
    },
    keyboard(el) {
      el.innerHTML =
        '<span class="proj-kb-body" aria-hidden="true"></span>' +
        '<span class="proj-kb-keys" aria-hidden="true"></span>' +
        '<span class="proj-kb-space" aria-hidden="true"></span>';
    },
    mouse(el) {
      el.innerHTML =
        '<span class="proj-mouse-body" aria-hidden="true"></span>' +
        '<span class="proj-mouse-btn-l" aria-hidden="true"></span>' +
        '<span class="proj-mouse-btn-r" aria-hidden="true"></span>' +
        '<span class="proj-mouse-wheel" aria-hidden="true"></span>' +
        '<span class="proj-mouse-cord" aria-hidden="true"></span>';
    },
  };

  let busy = false;
  let resetTimer = null;

  function setBusy(on) {
    busy = on;
    controlPad.classList.toggle("is-busy", on);
  }

  function clearFx() {
    fxLayer.innerHTML = "";
  }

  function clearTimers() {
    if (resetTimer) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  function revealBoss() {
    gameScreen.classList.add("is-revealed");
    behindZone.setAttribute("aria-hidden", "false");
    if (monitorStatus) monitorStatus.textContent = "상사 보임!!";
  }

  function hideBoss() {
    gameScreen.classList.remove("is-revealed", "is-action");
    behindZone.setAttribute("aria-hidden", "true");
    if (monitorStatus) monitorStatus.textContent = "업무중...";
  }

  function resetScene() {
    hideBoss();
    boss.classList.remove(
      "is-hit",
      "is-panicked",
      "is-monitor-hit",
      "is-heavy-hit",
      "is-thrown-hit",
      "is-hair-pulled"
    );
    hideBossPain();
    hideHitSpark();
    hideHeroineScene();
    if (myDesk) myDesk.classList.remove("is-flipping", "is-flipped");
    myMonitor.classList.remove("is-throwing");
    projLayer.innerHTML = "";
  }

  function showBossPain() {
    if (!bossSpeech) return;
    bossSpeech.textContent = BOSS_PAIN;
    bossSpeech.hidden = false;
    bossSpeech.classList.remove("is-visible");
    void bossSpeech.offsetWidth;
    bossSpeech.classList.add("is-visible");
    bossSpeech.setAttribute("aria-hidden", "false");
  }

  function hideBossPain() {
    if (!bossSpeech) return;
    bossSpeech.classList.remove("is-visible", "is-scream");
    bossSpeech.hidden = true;
    bossSpeech.setAttribute("aria-hidden", "true");
    bossSpeech.textContent = BOSS_PAIN;
  }

  function showHitSpark() {
    if (!hitSpark) return;
    hitSpark.classList.remove("is-active");
    void hitSpark.offsetWidth;
    hitSpark.classList.add("is-active");
    hitSpark.setAttribute("aria-hidden", "false");
  }

  function hideHitSpark() {
    if (!hitSpark) return;
    hitSpark.classList.remove("is-active");
    hitSpark.setAttribute("aria-hidden", "true");
  }

  function scheduleReset(ms) {
    clearTimers();
    resetTimer = window.setTimeout(() => {
      resetScene();
      setBusy(false);
    }, ms);
  }

  function shakeScreen(hard) {
    gameScreen.classList.remove("is-shaking", "is-shaking-hard");
    void gameScreen.offsetWidth;
    gameScreen.classList.add(hard ? "is-shaking-hard" : "is-shaking");
    gameScreen.addEventListener(
      "animationend",
      () => gameScreen.classList.remove("is-shaking", "is-shaking-hard"),
      { once: true }
    );
  }

  function showImpactText(text, sizeClass, durationMs) {
    const el = document.createElement("div");
    el.className = `fx-impact fx-impact--${sizeClass}`;
    el.textContent = text;
    fxLayer.appendChild(el);
    window.setTimeout(() => {
      if (el.parentNode === fxLayer) el.remove();
    }, durationMs);
  }

  function showComingSoon(durationMs, position) {
    const el = document.createElement("div");
    el.className =
      position === "bottom" ? "fx-coming-soon fx-coming-soon--bottom" : "fx-coming-soon";
    el.textContent = COMING_SOON;
    fxLayer.appendChild(el);
    window.setTimeout(() => {
      if (el.parentNode === fxLayer) el.remove();
    }, durationMs);
  }

  function showHeroineScene() {
    if (heroineScene) {
      heroineScene.hidden = false;
      heroineScene.setAttribute("aria-hidden", "false");
      heroineScene.classList.add("is-active");
    }
    if (hairPullFx) {
      hairPullFx.hidden = false;
      hairPullFx.setAttribute("aria-hidden", "false");
      hairPullFx.classList.add("is-active");
    }
    if (boss) boss.classList.add("is-hair-pull-visible");
  }

  function hideHeroineScene() {
    if (heroineScene) {
      heroineScene.classList.remove("is-active");
      heroineScene.hidden = true;
      heroineScene.setAttribute("aria-hidden", "true");
    }
    if (hairPullFx) {
      hairPullFx.classList.remove("is-active");
      hairPullFx.hidden = true;
      hairPullFx.setAttribute("aria-hidden", "true");
    }
    if (boss) boss.classList.remove("is-hair-pull-visible");
  }

  function showBossScream() {
    if (globalThis.GameSfx) globalThis.GameSfx.playBossScream();
    if (!bossSpeech) return;
    bossSpeech.textContent = BOSS_SCREAM;
    bossSpeech.hidden = false;
    bossSpeech.classList.remove("is-visible");
    void bossSpeech.offsetWidth;
    bossSpeech.classList.add("is-visible", "is-scream");
    bossSpeech.setAttribute("aria-hidden", "false");
  }

  function showSubText(text, durationMs) {
    const el = document.createElement("div");
    el.className = "fx-sub";
    el.textContent = text;
    fxLayer.appendChild(el);
    window.setTimeout(() => {
      if (el.parentNode === fxLayer) el.remove();
    }, durationMs);
  }

  function spawnProjectile(type) {
    const el = document.createElement("div");
    el.className = `proj proj-${type}`;
    el.setAttribute("aria-hidden", "true");
    const build = PROJ_BUILDERS[type];
    if (build) build(el);
    projLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    return el;
  }

  function onBossHit(cfg, key) {
    if (globalThis.GameSfx) globalThis.GameSfx.playHit(key);
    boss.classList.add("is-thrown-hit", cfg.bossHit);
    showBossPain();
    showHitSpark();
    shakeScreen(key === "chair");
    showImpactText(cfg.impact, cfg.impactSize, 850);
    if (cfg.sub) showSubText(cfg.sub, 950);
  }

  function runAction(fn) {
    if (busy) return;
    setBusy(true);
    clearFx();
    clearTimers();
    resetScene();
    gameScreen.classList.add("is-action");
    revealBoss();
    fn();
  }

  function throwItem(key) {
    const cfg = THROWS[key];
    if (!cfg) return;

    runAction(() => {
      window.setTimeout(() => {
        if (cfg.useDeskMonitor) {
          myMonitor.classList.add("is-throwing");
        } else {
          spawnProjectile(cfg.type);
        }
      }, REVEAL_MS);

      window.setTimeout(() => onBossHit(cfg, key), REVEAL_MS + cfg.hitAt);
      scheduleReset(REVEAL_MS + cfg.duration + 400);
    });
  }

  function showYell() {
    runAction(() => {
      window.setTimeout(() => {
        if (globalThis.GameSfx) globalThis.GameSfx.playYell();
        shakeScreen(true);
        const wrap = document.createElement("div");
        wrap.className = "fx-yell-wrap";
        wrap.setAttribute("role", "img");
        wrap.setAttribute("aria-label", YELL_TEXT);

        const burst = document.createElement("div");
        burst.className = "fx-yell-burst";
        burst.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 10; i++) {
          const line = document.createElement("span");
          line.className = "fx-yell-line";
          line.style.setProperty("--i", String(i));
          burst.appendChild(line);
        }

        const markLeft = document.createElement("span");
        markLeft.className = "fx-yell-mark fx-yell-mark--left";
        markLeft.textContent = "!!!";

        const word = document.createElement("span");
        word.className = "fx-yell-word";
        word.textContent = YELL_TEXT;

        const markRight = document.createElement("span");
        markRight.className = "fx-yell-mark fx-yell-mark--right";
        markRight.textContent = "!!!";

        wrap.appendChild(burst);
        wrap.appendChild(markLeft);
        wrap.appendChild(word);
        wrap.appendChild(markRight);
        fxLayer.appendChild(wrap);

        boss.classList.add("is-panicked");
      }, REVEAL_MS);
      scheduleReset(REVEAL_MS + 1100);
    });
  }

  function watchAdSpecial() {
    if (busy) return;
    setBusy(true);
    clearFx();
    clearTimers();
    resetScene();
    showComingSoon(1100);
    scheduleReset(1200);
  }

  function watchAdRealQuit() {
    runAction(() => {
      window.setTimeout(() => {
        showComingSoon(2000, "bottom");
        showHeroineScene();
        boss.classList.add("is-hair-pulled", "is-panicked", "is-thrown-hit");
        showBossScream();
        showHitSpark();
        shakeScreen(true);
        showSubText("머리 쥐어뜯기 발동", 1800);
      }, REVEAL_MS);
      scheduleReset(REVEAL_MS + 2400);
    });
  }

  function flipDesk() {
    runAction(() => {
      window.setTimeout(() => {
        if (myDesk) myDesk.classList.add("is-flipping");
        boss.classList.add("is-panicked");
      }, REVEAL_MS);
      window.setTimeout(() => {
        if (myDesk) {
          myDesk.classList.remove("is-flipping");
          myDesk.classList.add("is-flipped");
        }
        shakeScreen(true);
        showImpactText("내 책상 엎었다!!!", "lg", 900);
        showSubText("모니터·물컵 다 날아감", 1000);
        showBossPain();
      }, REVEAL_MS + 550);
      scheduleReset(REVEAL_MS + 1700);
    });
  }

  function onAction(action) {
    if (THROWS[action]) {
      throwItem(action);
      return;
    }
    switch (action) {
      case "yell":
        showYell();
        break;
      case "flip":
        flipDesk();
        break;
      case "ad-special":
        watchAdSpecial();
        break;
      case "ad-real":
        watchAdRealQuit();
        break;
      default:
        break;
    }
  }

  function scrollThrowsBy(dir) {
    if (!throwsScroll) return;
    const first = throwsScroll.querySelector(".sketch-btn");
    const gap = parseFloat(getComputedStyle(throwsScroll).gap) || 0;
    const step = first ? first.offsetWidth + gap : throwsScroll.clientWidth * 0.75;
    throwsScroll.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  controlPad.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-throws-nav]");
    if (nav) {
      e.preventDefault();
      scrollThrowsBy(nav.dataset.throwsNav === "next" ? 1 : -1);
      return;
    }
  });

  controlPad.addEventListener(
    "click",
    () => {
      if (globalThis.GameSfx) globalThis.GameSfx.unlock();
    },
    { capture: true, once: true }
  );

  controlPad.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || busy) return;
    if (globalThis.GameSfx) globalThis.GameSfx.unlock();
    onAction(btn.dataset.action);
  });
})();
