/**
 * 즐겨찾기 추가 — IE window.external.AddFavorite + 기타 브라우저 안내
 */
(function () {
  const btn = document.getElementById("add-bookmark");
  if (!btn) return;

  let hintTimer = null;

  function showHint(message) {
    const existing = document.querySelector(".bookmark-hint");
    if (existing) existing.remove();
    if (hintTimer) window.clearTimeout(hintTimer);

    const el = document.createElement("div");
    el.className = "bookmark-hint";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);

    requestAnimationFrame(function () {
      el.classList.add("is-visible");
    });

    hintTimer = window.setTimeout(function () {
      el.classList.remove("is-visible");
      window.setTimeout(function () {
        if (el.parentNode) el.remove();
      }, 280);
    }, 2600);
  }

  function addFavorite() {
    const url = window.location.href.split("#")[0];
    const title = document.title || "다 때려쳐 @office";

    try {
      if (
        window.external &&
        typeof window.external.AddFavorite === "function"
      ) {
        window.external.AddFavorite(url, title);
        return true;
      }
    } catch (e) {
      /* IE 보안/정책 거부 시 아래 안내로 */
    }

    try {
      if (window.sidebar && typeof window.sidebar.addPanel === "function") {
        window.sidebar.addPanel(title, url, "");
        return true;
      }
    } catch (e) {
      /* Firefox 구버전 */
    }

    return false;
  }

  btn.addEventListener("click", function () {
    if (addFavorite()) return;

    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    showHint(
      isMac
        ? "⌘ + D 로 즐겨찾기에 추가하세요"
        : "Ctrl + D 로 즐겨찾기에 추가하세요"
    );
  });
})();
