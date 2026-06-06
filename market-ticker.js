/**
 * 게임 화면 좌측 상단 — 실시간 시세 티커
 */
(function () {
  const root = document.getElementById("market-ticker");
  if (!root) return;

  const CACHE_KEY = "market_ticker_v1";
  const CACHE_TTL_MS = 90 * 1000;
  const REFRESH_MS = 60 * 1000;
  const FETCH_TIMEOUT_MS = 12000;

  const SYMBOLS = ["^KQ11", "^IXIC", "005930.KS", "000660.KS", "KRW=X"];
  const QUOTE_URL =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
    encodeURIComponent(SYMBOLS.join(","));

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

    const price = q.regularMarketPrice;
    const pct = q.regularMarketChangePercent;

    row.priceEl.textContent = formatPrice(symbol, price);

    if (!row.chgEl) return;
    row.chgEl.textContent = formatChg(pct);
    row.chgEl.classList.remove("is-up", "is-down", "is-flat");
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

  function parseQuotes(data) {
    const list =
      (data &&
        data.quoteResponse &&
        data.quoteResponse.result) ||
      [];
    const map = {};
    list.forEach(function (q) {
      if (q && q.symbol) map[q.symbol] = q;
    });
    if (Object.keys(map).length === 0) {
      throw new Error("시세 데이터 없음");
    }
    return map;
  }

  function fetchJson(url, signal) {
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

    return new Promise(function (resolve, reject) {
      let pending = proxies.length;
      let lastErr = null;
      proxies.forEach(function (proxy) {
        proxy(url, signal)
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(function (e) {
            lastErr = e;
            pending -= 1;
            if (pending === 0) {
              reject(lastErr || new Error("시세 요청 실패"));
            }
          });
      });
    });
  }

  function fetchQuotes() {
    return new Promise(function (resolve, reject) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(function () {
        ctrl.abort();
      }, FETCH_TIMEOUT_MS);
      fetchJson(QUOTE_URL, ctrl.signal)
        .then(function (data) {
          window.clearTimeout(timer);
          resolve(parseQuotes(data));
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
      const quotes = await fetchQuotes();
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
