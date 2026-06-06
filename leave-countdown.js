/**
 * 퇴근 목표 시간 · 남은 시간 표시
 */
(function () {
  const STORAGE_KEY = "leave_target_v1";
  const DEFAULT_MINUTES = 18 * 60;
  const STEP_MINUTES = 30;
  const TICK_MS = 30 * 1000;

  const displayEl = document.getElementById("leave-target-display");
  const remainingEl = document.getElementById("leave-remaining");
  const btnDown = document.getElementById("leave-time-down");
  const btnUp = document.getElementById("leave-time-up");

  if (!displayEl || !remainingEl || !btnDown || !btnUp) return;

  let targetMinutes = loadTarget();

  function loadTarget() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null) return DEFAULT_MINUTES;
      const n = parseInt(raw, 10);
      if (Number.isNaN(n) || n < 0 || n >= 24 * 60) return DEFAULT_MINUTES;
      return n;
    } catch (e) {
      return DEFAULT_MINUTES;
    }
  }

  function saveTarget() {
    try {
      localStorage.setItem(STORAGE_KEY, String(targetMinutes));
    } catch (e) {
      /* quota */
    }
  }

  function formatTargetLabel(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return period + " " + h12 + ":" + String(m).padStart(2, "0");
  }

  function getTargetDateToday() {
    const now = new Date();
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(targetMinutes / 60),
      targetMinutes % 60,
      0,
      0
    );
    return d;
  }

  function formatRemaining(ms) {
    if (ms <= 0) return { text: "퇴근 가능!", className: "is-done" };

    const totalMin = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;

    let text = "퇴근까지 ";
    if (hours > 0) text += hours + "시간 ";
    if (mins > 0 || hours === 0) text += mins + "분";
    text += " 남음";

    const className = totalMin <= 30 ? "is-soon" : "";
    return { text: text, className: className };
  }

  function renderTarget() {
    displayEl.textContent = formatTargetLabel(targetMinutes);
  }

  function renderRemaining() {
    const now = Date.now();
    const target = getTargetDateToday();
    const diff = target.getTime() - now;
    const info = formatRemaining(diff);

    remainingEl.textContent = info.text;
    remainingEl.classList.remove("is-done", "is-soon");
    if (info.className) remainingEl.classList.add(info.className);
  }

  function shiftTarget(delta) {
    targetMinutes = (targetMinutes + delta + 24 * 60) % (24 * 60);
    saveTarget();
    renderTarget();
    renderRemaining();
  }

  btnDown.addEventListener("click", function () {
    shiftTarget(-STEP_MINUTES);
  });

  btnUp.addEventListener("click", function () {
    shiftTarget(STEP_MINUTES);
  });

  renderTarget();
  renderRemaining();
  window.setInterval(renderRemaining, TICK_MS);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) renderRemaining();
  });
})();
