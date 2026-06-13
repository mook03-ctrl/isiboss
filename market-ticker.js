/**
 * 게임 화면 좌측 상단 — 시세 티커 (live 우선 + baked JSON 폴백)
 */
(function () {
  const root = document.getElementById("market-ticker");
  const timeEl = document.getElementById("market-ticker-time");
  if (!root) return;

  const BAKED_URL = "data/market-ticker.json";
  const CACHE_KEY = "market_ticker_v7";
  const CACHE_TTL_MS = 60 * 1000;
  const REFRESH_MS = 3 * 60 * 1000;
  const SYMBOL_DELAY_MS = 500;
  const FETCH_TIMEOUT_MS = 18000;
  const BAKED_STALE_MS = 6 * 60 * 60 * 1000;

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

  function chartUrl(symbol) {
    return (
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?interval=1d&range=5d"
    );
  }

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

  function mergeQuotes(base, extra) {
    const merged = {};
    if (base) {
      Object.keys(base).forEach(function (sym) {
        merged[sym] = base[sym];
      });
    }
    Object.keys(extra || {}).forEach(function (sym) {
      merged[sym] = extra[sym];
    });
    return merged;
  }

  function parseChartQuote(data, symbol) {
    if (data && data.chart && data.chart.error) {
      throw new Error(data.chart.error.description || "Yahoo 오류");
    }
    const meta = data && data.chart && data.chart.result && data.chart.result[0]
      ? data.chart.result[0].meta
      : null;
    if (!meta || meta.regularMarketPrice == null) {
      throw new Error(symbol + " 시세 없음");
    }

    let pct = meta.regularMarketChangePercent;
    const prev =
      meta.chartPreviousClose != null
        ? meta.chartPreviousClose
        : meta.previousClose;
    if ((pct == null || Number.isNaN(pct)) && prev > 0) {
      pct = ((meta.regularMarketPrice - prev) / prev) * 100;
    }

    const marketTime =
      meta.regularMarketTime != null
        ? meta.regularMarketTime * 1000
        : null;

    return {
      symbol: symbol,
      regularMarketPrice: meta.regularMarketPrice,
      regularMarketChangePercent: pct,
      marketTime: marketTime,
    };
  }

  function proxyUrls(url) {
    return [
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      "https://corsproxy.io/?" + encodeURIComponent(url),
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
      url,
    ];
  }

  function fetchJson(url, signal) {
    return fetch(url, { signal: signal, cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function fetchChartJson(url, signal) {
    const urls = proxyUrls(url);

    return new Promise(function (resolve, reject) {
      let index = 0;
      let lastErr = null;

      function tryNext() {
        if (index >= urls.length) {
          reject(lastErr || new Error("시세 요청 실패"));
          return;
        }
        const nextUrl = urls[index];
        index += 1;
        fetchJson(nextUrl, signal)
          .then(resolve)
          .catch(function (e) {
            lastErr = e;
            tryNext();
          });
      }

      tryNext();
    });
  }

  function fetchSymbolQuote(symbol) {
    return new Promise(function (resolve, reject) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(function () {
        ctrl.abort();
      }, FETCH_TIMEOUT_MS);

      fetchChartJson(chartUrl(symbol), ctrl.signal)
        .then(function (data) {
          resolve(parseChartQuote(data, symbol));
        })
        .catch(reject)
        .finally(function () {
          window.clearTimeout(timer);
        });
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
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

  async function fetchLiveQuotesSequential() {
    const map = {};
    let latestMarketTime = null;

    for (let i = 0; i < SYMBOLS.length; i += 1) {
      const sym = SYMBOLS[i];
      try {
        const q = await fetchSymbolQuote(sym);
        map[q.symbol] = q;
        if (q.marketTime && (!latestMarketTime || q.marketTime > latestMarketTime)) {
          latestMarketTime = q.marketTime;
        }
        quotes = mergeQuotes(quotes, { [q.symbol]: q });
        renderQuote(q.symbol, q);
      } catch (e) {
        /* 개별 실패 허용 */
      }
      if (i < SYMBOLS.length - 1) {
        await delay(SYMBOL_DELAY_MS);
      }
    }

    return {
      quotes: map,
      savedAt: latestMarketTime || Date.now(),
      count: Object.keys(map).length,
    };
  }

  async function loadFallback() {
    const cached = readCache();
    if (cached && cached.quotes && Object.keys(cached.quotes).length > 0) {
      renderAll(cached.quotes, cached.savedAt);
      return true;
    }

    try {
      const baked = await fetchBaked();
      const isStale = Date.now() - baked.savedAt > BAKED_STALE_MS;
      renderAll(baked.quotes, baked.savedAt);
      if (!isStale) {
        writeCache(baked.quotes, baked.savedAt);
      }
      return true;
    } catch (e) {
      return false;
    }
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
      const live = await fetchLiveQuotesSequential();
      if (live.count > 0) {
        quotes = mergeQuotes(quotes, live.quotes);
        savedAt = live.savedAt;
        renderAll(quotes, savedAt);
        writeCache(quotes, savedAt);
        return;
      }

      if (Object.keys(quotes).length === 0) {
        await loadFallback();
        return;
      }

      try {
        const baked = await fetchBaked();
        if (Date.now() - baked.savedAt > (savedAt || 0)) {
          quotes = mergeQuotes(quotes, baked.quotes);
          savedAt = baked.savedAt;
          renderAll(quotes, savedAt);
        }
      } catch (e) {
        /* live·baked 모두 실패 시 기존 표시 유지 */
      }
    } finally {
      root.classList.remove("is-loading");
      refreshing = false;
    }
  }

  async function boot() {
    renderTime(Date.now());
    await loadFallback();
    await refresh(true);
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
