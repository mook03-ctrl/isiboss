/**
 * 시세 포스트잇 — baked JSON(PyKRX+Yahoo, Actions 주기 갱신) 우선 표시
 * GitHub Pages는 CORS 때문에 브라우저 Yahoo 호출이 막히므로 서버 bake를 신뢰 소스로 사용
 */
(function () {
  const root = document.getElementById("market-ticker");
  const timeEl = document.getElementById("market-ticker-time");
  if (!root) return;

  const BAKED_URL = "data/market-ticker.json";
  const CACHE_KEY = "market_ticker_v8";
  const CACHE_TTL_MS = 2 * 60 * 1000;
  const REFRESH_MS = 3 * 60 * 1000;

  const SYMBOLS = ["^KS11", "^IXIC", "005930.KS", "000660.KS", "KRW=X"];

  const items = {};
  root.querySelectorAll(".market-ticker__item").forEach(function (el) {
    const sym = el.getAttribute("data-symbol");
    if (!sym) return;
    items[sym] = {
      el: el,
      priceEl: el.querySelector(".market-ticker__price"),
      chgEl: el.querySelector(".market-ticker__chg"),
    };
  });

  let quotes = {};
  let savedAt = null;
  let refreshing = false;

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.quotes) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(nextQuotes, when) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ quotes: nextQuotes, savedAt: when || Date.now() })
      );
    } catch (e) {
      /* quota */
    }
  }

  function formatPrice(symbol, price) {
    if (price == null || Number.isNaN(price)) return "—";
    if (symbol === "KRW=X") {
      return price.toLocaleString("ko-KR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (symbol === "005930.KS" || symbol === "000660.KS") {
      return Math.round(price).toLocaleString("ko-KR");
    }
    return price.toLocaleString("ko-KR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatChg(pct) {
    if (pct == null || Number.isNaN(pct)) return "";
    const sign = pct > 0 ? "+" : "";
    return sign + pct.toFixed(2) + "%";
  }

  function formatTickerTime(ts) {
    const d = new Date(ts);
    return (
      d.getFullYear() +
      ". " +
      (d.getMonth() + 1) +
      ". " +
      d.getDate() +
      ". " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0") +
      " 기준"
    );
  }

  function renderTime(ts) {
    if (!timeEl) return;
    const when = ts || Date.now();
    timeEl.dateTime = new Date(when).toISOString();
    timeEl.textContent = formatTickerTime(when);
  }

  function renderQuote(symbol, q) {
    const row = items[symbol];
    if (!row || !row.priceEl) return;

    row.priceEl.textContent = formatPrice(symbol, q.regularMarketPrice);

    if (!row.chgEl) return;
    row.chgEl.textContent = formatChg(q.regularMarketChangePercent);
    row.chgEl.classList.remove("is-up", "is-down", "is-flat");
    const pct = q.regularMarketChangePercent;
    if (pct == null || Math.abs(pct) < 0.005) {
      row.chgEl.classList.add("is-flat");
    } else if (pct > 0) {
      row.chgEl.classList.add("is-up");
    } else {
      row.chgEl.classList.add("is-down");
    }
  }

  function renderAll(nextQuotes, when) {
    root.classList.remove("is-loading");
    quotes = nextQuotes || quotes;
    savedAt = when || savedAt || Date.now();
    renderTime(savedAt);
    SYMBOLS.forEach(function (sym) {
      if (quotes[sym]) renderQuote(sym, quotes[sym]);
    });
  }

  async function fetchBaked() {
    const res = await fetch(BAKED_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("baked HTTP " + res.status);
    const data = await res.json();
    if (!data || !data.quotes || Object.keys(data.quotes).length === 0) {
      throw new Error("baked empty");
    }
    return {
      quotes: data.quotes,
      savedAt: data.savedAt || Date.now(),
    };
  }

  /** baked가 캐시보다 최신이면 baked 사용 */
  function pickNewer(a, b) {
    if (!a) return b;
    if (!b) return a;
    return (a.savedAt || 0) >= (b.savedAt || 0) ? a : b;
  }

  async function refresh(force) {
    if (refreshing) return;
    if (
      !force &&
      savedAt &&
      Date.now() - savedAt < CACHE_TTL_MS &&
      Object.keys(quotes).length > 0
    ) {
      return;
    }

    refreshing = true;
    if (Object.keys(quotes).length === 0) {
      root.classList.add("is-loading");
    }

    try {
      const baked = await fetchBaked();
      const currentSaved = savedAt || 0;
      if (
        !force &&
        Object.keys(quotes).length > 0 &&
        baked.savedAt <= currentSaved
      ) {
        return;
      }
      // force 시에도 baked가 더 오래되면 유지하되, 없거나 비어있으면 교체
      if (
        force ||
        baked.savedAt > currentSaved ||
        Object.keys(quotes).length === 0
      ) {
        if (
          baked.savedAt >= currentSaved ||
          Object.keys(quotes).length === 0
        ) {
          renderAll(baked.quotes, baked.savedAt);
          writeCache(baked.quotes, baked.savedAt);
        }
      }
    } catch (e) {
      if (Object.keys(quotes).length === 0) {
        const cached = readCache();
        if (cached && cached.quotes) {
          renderAll(cached.quotes, cached.savedAt);
        }
      }
    } finally {
      root.classList.remove("is-loading");
      refreshing = false;
    }
  }

  async function boot() {
    const cached = readCache();
    if (cached && cached.quotes && Object.keys(cached.quotes).length > 0) {
      renderAll(cached.quotes, cached.savedAt);
    } else {
      renderTime(Date.now());
      root.classList.add("is-loading");
    }

    // always re-fetch baked and prefer if newer (또는 force)
    try {
      const baked = await fetchBaked();
      const chosen = pickNewer(
        cached && cached.quotes
          ? { quotes: cached.quotes, savedAt: cached.savedAt }
          : null,
        baked
      );
      // 캐시가 7일 이상 오래되면 무조건 baked (v7→v8 마이그레이션 등)
      const week = 7 * 24 * 60 * 60 * 1000;
      if (
        !cached ||
        !cached.savedAt ||
        Date.now() - cached.savedAt > week ||
        baked.savedAt >= (cached.savedAt || 0)
      ) {
        renderAll(baked.quotes, baked.savedAt);
        writeCache(baked.quotes, baked.savedAt);
      } else if (chosen) {
        renderAll(chosen.quotes, chosen.savedAt);
      }
    } catch (e) {
      if (!cached) {
        root.classList.remove("is-loading");
      }
    }

    window.setInterval(function () {
      refresh(true);
    }, REFRESH_MS);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh(true);
  });

  window.addEventListener("online", function () {
    refresh(true);
  });

  boot();
})();
