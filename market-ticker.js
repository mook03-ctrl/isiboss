/**
 * 게임 화면 좌측 상단 — 실시간 시세 티커 (Yahoo v7 batch + v8 chart + Stooq)
 */
(function () {
  const root = document.getElementById("market-ticker");
  const timeEl = document.getElementById("market-ticker-time");
  if (!root) return;

  const CACHE_KEY = "market_ticker_v3";
  const CACHE_TTL_MS = 90 * 1000;
  const REFRESH_MS = 60 * 1000;

  const SYMBOLS = ["^KQ11", "^IXIC", "005930.KS", "000660.KS", "KRW=X"];

  const STOOQ_SYMBOL = {
    "^KQ11": "^kq11",
    "^IXIC": "^ixic",
    "005930.KS": "005930.kr",
    "000660.KS": "000660.kr",
    "KRW=X": "usdkrw",
  };

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

  function isMobile() {
    return window.matchMedia(
      "(max-width: 768px), (hover: none) and (pointer: coarse)"
    ).matches;
  }

  function fetchTimeoutMs() {
    return isMobile() ? 28000 : 14000;
  }

  function chartUrl(symbol) {
    return (
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?interval=1d&range=5d"
    );
  }

  function quoteBatchUrl() {
    return (
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
      encodeURIComponent(SYMBOLS.join(","))
    );
  }

  function stooqDailyUrl(symbol) {
    return (
      "https://stooq.com/q/d/l/?s=" +
      encodeURIComponent(STOOQ_SYMBOL[symbol]) +
      "&i=d"
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

  function buildQuote(symbol, price, pct) {
    return {
      symbol: symbol,
      regularMarketPrice: price,
      regularMarketChangePercent: pct,
    };
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

    return buildQuote(symbol, meta.regularMarketPrice, pct);
  }

  function parseV7Quote(row) {
    if (!row || row.regularMarketPrice == null) return null;
    let pct = row.regularMarketChangePercent;
    const prev =
      row.regularMarketPreviousClose != null
        ? row.regularMarketPreviousClose
        : row.previousClose;
    if ((pct == null || Number.isNaN(pct)) && prev > 0) {
      pct = ((row.regularMarketPrice - prev) / prev) * 100;
    }
    return buildQuote(row.symbol, row.regularMarketPrice, pct);
  }

  function parseV7Batch(data) {
    const rows =
      data && data.quoteResponse && data.quoteResponse.result
        ? data.quoteResponse.result
        : null;
    if (!rows || !rows.length) {
      throw new Error("v7 시세 없음");
    }
    const map = {};
    rows.forEach(function (row) {
      const q = parseV7Quote(row);
      if (q) map[q.symbol] = q;
    });
    if (Object.keys(map).length === 0) {
      throw new Error("v7 가격 없음");
    }
    return map;
  }

  function parseStooqCsv(text, symbol) {
    const lines = text
      .trim()
      .split(/\r?\n/)
      .filter(function (line) {
        return line && !/^symbol/i.test(line);
      });
    if (lines.length < 1) {
      throw new Error("Stooq 데이터 없음");
    }

    const last = lines[lines.length - 1].split(",");
    const close = parseFloat(last[5]);
    if (!close || Number.isNaN(close)) {
      throw new Error("Stooq 종가 없음");
    }

    let pct = null;
    if (lines.length >= 2) {
      const prevLine = lines[lines.length - 2].split(",");
      const prevClose = parseFloat(prevLine[5]);
      if (prevClose > 0) {
        pct = ((close - prevClose) / prevClose) * 100;
      }
    }

    return buildQuote(symbol, close, pct);
  }

  function getProxyFns() {
    const direct = function (u, s) {
      return fetch(u, { mode: "cors", signal: s, cache: "no-store" });
    };
    const alloriginsRaw = function (u, s) {
      return fetch(
        "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
        { signal: s, cache: "no-store" }
      );
    };
    const alloriginsGet = function (u, s) {
      return fetch(
        "https://api.allorigins.win/get?url=" + encodeURIComponent(u),
        { signal: s, cache: "no-store" }
      ).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().then(function (wrap) {
          if (!wrap || wrap.contents == null) {
            throw new Error("allorigins empty");
          }
          return { ok: true, json: function () { return JSON.parse(wrap.contents); }, text: function () { return Promise.resolve(wrap.contents); } };
        });
      });
    };
    const corsproxy = function (u, s) {
      return fetch("https://corsproxy.io/?" + encodeURIComponent(u), {
        signal: s,
        cache: "no-store",
      });
    };
    const codetabs = function (u, s) {
      return fetch(
        "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
        { signal: s, cache: "no-store" }
      );
    };

    if (isMobile()) {
      return [corsproxy, alloriginsRaw, alloriginsGet, codetabs, direct];
    }
    return [direct, corsproxy, alloriginsRaw, alloriginsGet, codetabs];
  }

  function fetchWithTimeout(run) {
    return new Promise(function (resolve, reject) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(function () {
        ctrl.abort();
      }, fetchTimeoutMs());

      run(ctrl.signal)
        .then(function (value) {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch(function (err) {
          window.clearTimeout(timer);
          reject(err);
        });
    });
  }

  function fetchJson(url, signal) {
    const hosts = [
      url,
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];
    const proxies = getProxyFns();

    if (isMobile()) {
      return new Promise(function (resolve, reject) {
        let hostIdx = 0;

        function tryNextProxy(proxyIdx) {
          if (hostIdx >= hosts.length) {
            reject(new Error("시세 요청 실패"));
            return;
          }
          if (proxyIdx >= proxies.length) {
            hostIdx += 1;
            tryNextProxy(0);
            return;
          }

          proxies[proxyIdx](hosts[hostIdx], signal)
            .then(function (res) {
              if (!res.ok) throw new Error("HTTP " + res.status);
              return res.json();
            })
            .then(resolve)
            .catch(function () {
              tryNextProxy(proxyIdx + 1);
            });
        }

        tryNextProxy(0);
      });
    }

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

  function fetchText(url, signal) {
    const proxies = [
      function (u, s) {
        return fetch(u, { mode: "cors", signal: s, cache: "no-store" }).then(
          function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.text();
          }
        );
      },
      function (u, s) {
        return fetch(
          "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
          { signal: s, cache: "no-store" }
        ).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        });
      },
      function (u, s) {
        return fetch("https://corsproxy.io/?" + encodeURIComponent(u), {
          signal: s,
          cache: "no-store",
        }).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        });
      },
    ];

    if (isMobile()) {
      return new Promise(function (resolve, reject) {
        let idx = 0;
        function next() {
          if (idx >= proxies.length) {
            reject(new Error("Stooq 요청 실패"));
            return;
          }
          const run = proxies[idx];
          idx += 1;
          run(url, signal).then(resolve).catch(next);
        }
        next();
      });
    }

    return new Promise(function (resolve, reject) {
      let pending = proxies.length;
      let lastErr = null;
      proxies.forEach(function (run) {
        run(url, signal)
          .then(resolve)
          .catch(function (e) {
            lastErr = e;
            pending -= 1;
            if (pending === 0) {
              reject(lastErr || new Error("Stooq 요청 실패"));
            }
          });
      });
    });
  }

  function fetchSymbolQuote(symbol) {
    return fetchWithTimeout(function (signal) {
      return fetchJson(chartUrl(symbol), signal).then(function (data) {
        return parseChartQuote(data, symbol);
      });
    });
  }

  function fetchQuoteBatch() {
    return fetchWithTimeout(function (signal) {
      return fetchJson(quoteBatchUrl(), signal).then(parseV7Batch);
    });
  }

  function fetchStooqQuote(symbol) {
    if (!STOOQ_SYMBOL[symbol]) {
      throw new Error("Stooq 심볼 없음");
    }
    return fetchWithTimeout(function (signal) {
      return fetchText(stooqDailyUrl(symbol), signal).then(function (text) {
        return parseStooqCsv(text, symbol);
      });
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  async function fetchMissingSymbols(map) {
    const missing = SYMBOLS.filter(function (sym) {
      return !map[sym];
    });

    for (let i = 0; i < missing.length; i += 1) {
      const sym = missing[i];
      try {
        const q = await fetchSymbolQuote(sym);
        map[q.symbol] = q;
      } catch (e) {
        /* v8 실패 */
      }
      if (isMobile() && i < missing.length - 1) {
        await delay(100);
      }
    }

    const stillMissing = SYMBOLS.filter(function (sym) {
      return !map[sym];
    });

    for (let j = 0; j < stillMissing.length; j += 1) {
      const sym = stillMissing[j];
      try {
        const q = await fetchStooqQuote(sym);
        map[q.symbol] = q;
      } catch (e) {
        /* Stooq 실패 */
      }
      if (isMobile() && j < stillMissing.length - 1) {
        await delay(100);
      }
    }

    return map;
  }

  async function fetchAllQuotes() {
    const map = {};

    try {
      const batch = await fetchQuoteBatch();
      Object.keys(batch).forEach(function (sym) {
        map[sym] = batch[sym];
      });
    } catch (e) {
      /* v7 배치 실패 → 개별 조회 */
    }

    await fetchMissingSymbols(map);

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

    const attempts = isMobile() ? 3 : 2;
    let lastErr = null;

    for (let i = 0; i < attempts; i += 1) {
      try {
        const fresh = await fetchAllQuotes();
        const merged = mergeQuotes(
          cached && cached.quotes ? cached.quotes : null,
          fresh
        );
        const savedAt = Date.now();
        writeCache(merged, savedAt);
        renderAll(merged, savedAt);
        return;
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) {
          await delay(isMobile() ? 2500 : 1200);
        }
      }
    }

    if (!cached || !cached.quotes) {
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
