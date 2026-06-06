/**
 * 게임 화면 좌측 상단 — 실시간 시세 티커 (Yahoo v8 chart)
 */
(function () {
  const root = document.getElementById("market-ticker");
  if (!root) return;

  const CACHE_KEY = "market_ticker_v2";
  const CACHE_TTL_MS = 90 * 1000;
  const REFRESH_MS = 60 * 1000;
  const FETCH_TIMEOUT_MS = 12000;

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

  function writeCache(quotes) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ quotes: quotes, savedAt: Date.now() })
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

  function renderAll(quotes) {
    root.classList.remove("is-loading");
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

  function fetchJson(url, signal) {
    const hosts = [
      url,
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];
    const proxies = [
      function (u, s) {
        return fetch(u, { mode: "cors", signal: s });
      },
      function (u, s) {
        return fetch(
          "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
          { signal: s }
        );
      },
      function (u, s) {
        return fetch("https://corsproxy.io/?" + encodeURIComponent(u), {
          signal: s,
        });
      },
    ];

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

  function fetchSymbolQuote(symbol, signal) {
    return fetchJson(chartUrl(symbol), signal).then(function (data) {
      return parseChartQuote(data, symbol);
    });
  }

  function fetchAllQuotes() {
    return new Promise(function (resolve, reject) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(function () {
        ctrl.abort();
      }, FETCH_TIMEOUT_MS);

      Promise.all(
        SYMBOLS.map(function (sym) {
          return fetchSymbolQuote(sym, ctrl.signal);
        })
      )
        .then(function (rows) {
          window.clearTimeout(timer);
          const map = {};
          rows.forEach(function (q) {
            map[q.symbol] = q;
          });
          resolve(map);
        })
        .catch(function (e) {
          window.clearTimeout(timer);
          reject(e);
        });
    });
  }

  async function refresh(force) {
    const cached = readCache();
    if (cached && cached.quotes) {
      renderAll(cached.quotes);
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
      const quotes = await fetchAllQuotes();
      writeCache(quotes);
      renderAll(quotes);
    } catch (e) {
      if (!cached || !cached.quotes) {
        root.classList.remove("is-loading");
      }
    }
  }

  refresh(false);
  window.setInterval(function () {
    refresh(true);
  }, REFRESH_MS);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh(true);
  });
})();
