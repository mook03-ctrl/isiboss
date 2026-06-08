/**
 * 게임 화면 좌측 상단 — 시세 티커 (baked JSON + Yahoo v8 보조 갱신)
 */
(function () {
  const root = document.getElementById("market-ticker");
  const timeEl = document.getElementById("market-ticker-time");
  if (!root) return;

  const BAKED_URL = "data/market-ticker.json";
  const CACHE_KEY = "market_ticker_v6";
  const CACHE_TTL_MS = 90 * 1000;
  const REFRESH_MS = 5 * 60 * 1000;
  const SYMBOL_DELAY_MS = 700;
  const FETCH_TIMEOUT_MS = 20000;

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

  function writeCache(quotes, savedAt) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ quotes: quotes, savedAt: savedAt || Date.now() })
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

  function renderAll(quotes, savedAt) {
    root.classList.remove("is-loading");
    renderTime(savedAt);
    SYMBOLS.forEach(function (sym) {
      if (quotes[sym]) renderQuote(sym, quotes[sym]);
    });
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

    return {
      symbol: symbol,
      regularMarketPrice: meta.regularMarketPrice,
      regularMarketChangePercent: pct,
    };
  }

  function fetchChartJson(url, signal) {
    const hosts = [
      url,
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];
    const attempts = [];

    hosts.forEach(function (host) {
      attempts.push(function () {
        return fetch(
          "https://api.allorigins.win/raw?url=" + encodeURIComponent(host),
          { signal: signal, cache: "no-store" }
        ).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
      });
      attempts.push(function () {
        return fetch(host, { mode: "cors", signal: signal, cache: "no-store" }).then(
          function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          }
        );
      });
    });

    return new Promise(function (resolve, reject) {
      let pending = attempts.length;
      let lastErr = null;
      let settled = false;

      attempts.forEach(function (run) {
        run()
          .then(function (data) {
            if (settled) return;
            settled = true;
            resolve(data);
          })
          .catch(function (e) {
            lastErr = e;
            pending -= 1;
            if (!settled && pending === 0) {
              reject(lastErr || new Error("시세 요청 실패"));
            }
          });
      });
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
    const res = await fetch(BAKED_URL, { cache: "no-store" });
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

    for (let i = 0; i < SYMBOLS.length; i += 1) {
      const sym = SYMBOLS[i];
      try {
        const q = await fetchSymbolQuote(sym);
        map[q.symbol] = q;
      } catch (e) {
        /* 개별 실패 허용 */
      }
      if (i < SYMBOLS.length - 1) {
        await delay(SYMBOL_DELAY_MS);
      }
    }

    return map;
  }

  function mergeQuotes(base, extra) {
    const merged = {};
    if (base) {
      Object.keys(base).forEach(function (sym) {
        merged[sym] = base[sym];
      });
    }
    Object.keys(extra).forEach(function (sym) {
      merged[sym] = extra[sym];
    });
    return merged;
  }

  async function refresh(force) {
    const cached = readCache();
    let current = cached && cached.quotes ? cached.quotes : null;
    let currentAt = cached ? cached.savedAt : null;

    if (current) {
      renderAll(current, currentAt || Date.now());
      if (
        !force &&
        currentAt &&
        Date.now() - currentAt < CACHE_TTL_MS
      ) {
        return;
      }
    } else {
      root.classList.add("is-loading");
    }

    try {
      const baked = await fetchBaked();
      current = mergeQuotes(current, baked.quotes);
      currentAt = baked.savedAt;
      renderAll(current, currentAt);
      writeCache(current, currentAt);
    } catch (e) {
      /* baked 없으면 live 시도 */
    }

    try {
      const live = await fetchLiveQuotesSequential();
      if (Object.keys(live).length > 0) {
        current = mergeQuotes(current, live);
        currentAt = Date.now();
        writeCache(current, currentAt);
        renderAll(current, currentAt);
      }
    } catch (e) {
      /* live 전부 실패 — baked/캐시 유지 */
    }

    if (!current) {
      root.classList.remove("is-loading");
    }
  }

  renderTime(Date.now());
  refresh(false);
  window.setInterval(function () {
    refresh(true);
  }, REFRESH_MS);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh(true);
  });

  window.addEventListener("online", function () {
    refresh(true);
  });
})();
