/**
 * 게임 화면 좌측 상단 — 실시간 시세 티커 (Yahoo v8 chart)
 */
(function () {
  const root = document.getElementById("market-ticker");
  const timeEl = document.getElementById("market-ticker-time");
  if (!root) return;

  const CACHE_KEY = "market_ticker_v2";
  const CACHE_TTL_MS = 90 * 1000;
  const REFRESH_MS = 60 * 1000;
  const IS_MOBILE = window.matchMedia(
    "(max-width: 520px), (hover: none) and (pointer: coarse)"
  ).matches;
  const FETCH_TIMEOUT_MS = IS_MOBILE ? 20000 : 12000;

  const SYMBOLS = ["^KQ11", "^IXIC", "005930.KS", "000660.KS", "KRW=X"];

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
    Object.keys(quotes).forEach(function (sym) {
      renderQuote(sym, quotes[sym]);
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

  function getProxyFns() {
    const direct = function (u, s) {
      return fetch(u, { mode: "cors", signal: s });
    };
    const allorigins = function (u, s) {
      return fetch(
        "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
        { signal: s }
      );
    };
    const corsproxy = function (u, s) {
      return fetch("https://corsproxy.io/?" + encodeURIComponent(u), {
        signal: s,
      });
    };
    const codetabs = function (u, s) {
      return fetch(
        "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
        { signal: s }
      );
    };

    if (IS_MOBILE) {
      return [allorigins, corsproxy, codetabs, direct];
    }
    return [direct, allorigins, corsproxy, codetabs];
  }

  function fetchJson(url, signal) {
    const hosts = [
      url,
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];
    const proxies = getProxyFns();
    const attempts = [];

    hosts.forEach(function (host) {
      proxies.forEach(function (proxy) {
        attempts.push(function () {
          return proxy(host, signal).then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          });
        });
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
    const ctrl = new AbortController();
    const timer = window.setTimeout(function () {
      ctrl.abort();
    }, FETCH_TIMEOUT_MS);

    return fetchJson(chartUrl(symbol), ctrl.signal)
      .then(function (data) {
        return parseChartQuote(data, symbol);
      })
      .finally(function () {
        window.clearTimeout(timer);
      });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  async function fetchAllQuotes() {
    const map = {};

    if (IS_MOBILE) {
      for (let i = 0; i < SYMBOLS.length; i += 1) {
        try {
          const q = await fetchSymbolQuote(SYMBOLS[i]);
          map[q.symbol] = q;
        } catch (e) {
          /* 개별 심볼 실패는 건너뜀 */
        }
        if (i < SYMBOLS.length - 1) {
          await delay(120);
        }
      }
    } else {
      const rows = await Promise.allSettled(
        SYMBOLS.map(function (sym) {
          return fetchSymbolQuote(sym);
        })
      );
      rows.forEach(function (row) {
        if (row.status === "fulfilled") {
          map[row.value.symbol] = row.value;
        }
      });
    }

    if (Object.keys(map).length === 0) {
      throw new Error("시세 요청 실패");
    }
    return map;
  }

  function mergeQuotes(cachedQuotes, freshQuotes) {
    const merged = {};
    if (cachedQuotes) {
      Object.keys(cachedQuotes).forEach(function (sym) {
        merged[sym] = cachedQuotes[sym];
      });
    }
    Object.keys(freshQuotes).forEach(function (sym) {
      merged[sym] = freshQuotes[sym];
    });
    return merged;
  }

  async function refresh(force) {
    const cached = readCache();
    if (cached && cached.quotes) {
      renderAll(cached.quotes, cached.savedAt || Date.now());
      if (
        !force &&
        cached.savedAt &&
        Date.now() - cached.savedAt < CACHE_TTL_MS
      ) {
        return;
      }
    } else {
      root.classList.add("is-loading");
    }

    try {
      const fresh = await fetchAllQuotes();
      const merged = mergeQuotes(
        cached && cached.quotes ? cached.quotes : null,
        fresh
      );
      const savedAt = Date.now();
      writeCache(merged, savedAt);
      renderAll(merged, savedAt);
    } catch (e) {
      if (!cached || !cached.quotes) {
        root.classList.remove("is-loading");
      }
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
})();
