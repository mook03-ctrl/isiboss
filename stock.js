/**
 * 주식으로 돈벌자 — 시가총액 · AI 예측
 */
(function () {
  const API = "https://openai.highbuff.com/?method=";
  const app = document.getElementById("app");
  const stockPanel = document.getElementById("stock-panel");
  const stockBtn = document.querySelector('[data-site-panel="stock"]');
  const stockBack = document.getElementById("stock-back");
  const stockSearch = document.getElementById("stock-search");
  const stockPredictBtn = document.getElementById("stock-predict-btn");
  const stockStatus = document.getElementById("stock-status");
  const kospiList = document.getElementById("stock-kospi");
  const kosdaqList = document.getElementById("stock-kosdaq");
  const stockResult = document.getElementById("stock-result");
  const stockResultTitle = document.getElementById("stock-result-title");
  const stockResultBody = document.getElementById("stock-result-body");

  let marketLoaded = false;
  let predictBusy = false;
  let tqqqLoaded = false;
  let tqqqTimer = null;
  let tqqqCache = null;
  let tqqqFetchGen = 0;

  const TQQQ_CACHE_KEY = "tqqq_chart_v3";
  const TQQQ_CACHE_TTL_MS = 3 * 60 * 1000;
  const TQQQ_REFRESH_MS = 3 * 60 * 1000;
  const TQQQ_FETCH_TIMEOUT_MS = 18000;

  const YAHOO_TQQQ_URLS = [
    "https://query1.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=10y",
    "https://query2.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=10y",
    "https://query1.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=5y",
    "https://query1.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=max",
  ];

  const STOOQ_TQQQ_URLS = [
    "https://stooq.com/q/d/l/?s=tqqq.us&i=d",
    "https://stooq.pl/q/d/l/?s=tqqq.us&i=d",
  ];
  const tqqqPrice = document.getElementById("tqqq-price");
  const tqqqAthPct = document.getElementById("tqqq-ath-pct");
  const tqqqPrevAthPct = document.getElementById("tqqq-prev-ath-pct");
  const tqqqTradeBadge = document.getElementById("tqqq-trade-badge");
  const tqqqTradeDesc = document.getElementById("tqqq-trade-desc");
  const tqqqChart = document.getElementById("tqqq-chart");
  const tqqqStatus = document.getElementById("tqqq-status");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMarketCap(v) {
    const n = Number(v);
    if (!n || Number.isNaN(n)) return "-";
    return n.toLocaleString("ko-KR");
  }

  function setStatus(msg, isError) {
    if (!stockStatus) return;
    stockStatus.textContent = msg || "";
    stockStatus.classList.toggle("is-error", !!isError);
  }

  function showStockMode(on) {
    if (!app || !stockPanel) return;
    app.classList.toggle("is-stock-mode", on);
    document.documentElement.classList.toggle("is-stock-page", on);
    document.body.classList.toggle("is-stock-page", on);
    stockPanel.hidden = !on;
    if (stockBtn) stockBtn.classList.toggle("is-active", on);
    if (on && !marketLoaded) loadMarketCap();
    if (on) {
      window.requestAnimationFrame(function () {
        loadTqqq();
        window.setTimeout(function () {
          if (tqqqCache) renderTqqqFromCache();
        }, 300);
      });
      if (!tqqqTimer) {
        tqqqTimer = window.setInterval(function () {
          loadTqqq({ silent: true });
        }, TQQQ_REFRESH_MS);
      }
    } else {
      if (tqqqTimer) {
        window.clearInterval(tqqqTimer);
        tqqqTimer = null;
      }
      setStatus("");
      stockResult.hidden = true;
    }
  }

  function readStoredTqqqCache() {
    try {
      const raw = localStorage.getItem(TQQQ_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.closes || parsed.closes.length < 30) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeStoredTqqqCache(cache) {
    try {
      localStorage.setItem(
        TQQQ_CACHE_KEY,
        JSON.stringify({
          closes: cache.closes,
          highs: cache.highs,
          timestamps: cache.timestamps,
          meta: cache.meta,
          source: cache.source,
          savedAt: cache.savedAt || Date.now(),
        })
      );
    } catch (e) {
      /* quota */
    }
  }

  function parseYahooChartPayload(data) {
    if (data && data.chart && data.chart.error) {
      throw new Error(data.chart.error.description || "Yahoo 오류");
    }
    if (
      !data ||
      !data.chart ||
      !data.chart.result ||
      !data.chart.result[0] ||
      !data.chart.result[0].indicators
    ) {
      throw new Error("Yahoo 차트 형식 오류");
    }
    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    const series = buildTqqqSeries(quote, result.meta);
    return {
      closes: series.closes,
      highs: series.highs,
      timestamps: result.timestamp,
      meta: result.meta,
      source: "yahoo",
    };
  }

  function parseStooqCsv(text) {
    const lines = String(text || "")
      .trim()
      .split(/\r?\n/);
    if (lines.length < 3) throw new Error("Stooq CSV 비어 있음");

    const closes = [];
    const highs = [];
    const timestamps = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      if (parts.length < 5) continue;
      const high = parseFloat(parts[2]);
      const close = parseFloat(parts[4]);
      if (Number.isNaN(close) || Number.isNaN(high)) continue;
      const ts = Date.parse(parts[0]);
      closes.push(close);
      highs.push(high);
      timestamps.push(Number.isNaN(ts) ? 0 : Math.floor(ts / 1000));
    }

    if (closes.length < 30) throw new Error("Stooq 데이터 부족");

    const last = closes.length - 1;
    return {
      closes: closes,
      highs: highs,
      timestamps: timestamps,
      meta: {
        regularMarketPrice: closes[last],
        regularMarketDayHigh: highs[last],
      },
      source: "stooq",
    };
  }

  function fetchWithTimeout(run, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(function () {
        ctrl.abort();
      }, timeoutMs);
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

  function fetchYahooChartUrl(url, signal) {
    const urls = [
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      "https://corsproxy.io/?" + encodeURIComponent(url),
      url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];

    return new Promise(function (resolve, reject) {
      let index = 0;
      let lastErr = null;

      function tryNext() {
        if (index >= urls.length) {
          reject(lastErr || new Error("Yahoo 요청 실패"));
          return;
        }
        const nextUrl = urls[index];
        index += 1;
        fetch(nextUrl, { signal: signal, cache: "no-store" })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (data) {
            resolve(parseYahooChartPayload(data));
          })
          .catch(function (e) {
            lastErr = e;
            tryNext();
          });
      }

      tryNext();
    });
  }

  function fetchStooqText(url, signal) {
    return fetch(url, { mode: "cors", signal: signal })
      .then(function (res) {
        if (res.ok) return res.text();
        throw new Error("HTTP " + res.status);
      })
      .catch(function () {
        return fetch(
          "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
          { signal: signal }
        ).then(function (res) {
          if (!res.ok) throw new Error("Stooq HTTP " + res.status);
          return res.text();
        });
      });
  }

  function fetchStooqChart(signal) {
    const jobs = STOOQ_TQQQ_URLS.map(function (url) {
      return fetchStooqText(url, signal).then(parseStooqCsv);
    });
    return Promise.any(jobs);
  }

  async function fetchTqqqChartData() {
    let lastErr = null;

    for (let i = 0; i < YAHOO_TQQQ_URLS.length; i += 1) {
      const url = YAHOO_TQQQ_URLS[i];
      try {
        return await fetchWithTimeout(function (signal) {
          return fetchYahooChartUrl(url, signal);
        }, TQQQ_FETCH_TIMEOUT_MS);
      } catch (e) {
        lastErr = e;
      }
    }

    try {
      return await fetchWithTimeout(fetchStooqChart, TQQQ_FETCH_TIMEOUT_MS);
    } catch (e) {
      throw lastErr || e;
    }
  }

  function findPrevAthFromHighs(highs) {
    let runningAth = 0;
    let prevAth = null;
    highs.forEach(function (h) {
      if (h == null) return;
      if (h > runningAth) {
        if (runningAth > 0) prevAth = runningAth;
        runningAth = h;
      }
    });
    return prevAth;
  }

  function buildTqqqSeries(quote, meta) {
    const closes = quote.close.slice();
    const highs = quote.high.slice();
    const len = closes.length;

    if (len > 0 && meta.regularMarketPrice != null) {
      closes[len - 1] = meta.regularMarketPrice;
    }
    if (len > 0 && meta.regularMarketDayHigh != null) {
      highs[len - 1] = Math.max(highs[len - 1] || 0, meta.regularMarketDayHigh);
    }

    return { closes: closes, highs: highs };
  }

  function analyzeTqqq(closes, highs) {
    let ath = 0;
    let athIdx = 0;
    highs.forEach(function (h, i) {
      if (h != null && h > ath) {
        ath = h;
        athIdx = i;
      }
    });
    const current = closes[closes.length - 1];
    if (current == null || ath <= 0) {
      throw new Error("TQQQ 현재가 데이터가 없습니다.");
    }
    const prevAth = findPrevAthFromHighs(highs);
    const buyLine = ath * 0.85;
    const sellLine = ath * 1.45;
    const pctOfAth = (current / ath) * 100;
    const hasPrevAth =
      prevAth != null && prevAth > 0 && Math.abs(prevAth - ath) / ath > 0.001;
    const pctFromPrevAth = hasPrevAth
      ? ((current / prevAth) - 1) * 100
      : null;

    let dippedBelowBuy = false;
    for (let i = athIdx; i < closes.length; i++) {
      if (closes[i] != null && closes[i] <= buyLine) dippedBelowBuy = true;
      if (dippedBelowBuy && closes[i] != null && closes[i] >= ath) {
        dippedBelowBuy = false;
      }
    }

    let status = "wait";
    let label = "거래 대기";
    let desc =
      "전고점 +45% 미만 · 전고점 −15% 초과 구간입니다. 매수·매도 신호 대기 중.";

    if (current >= sellLine) {
      status = "sell";
      label = "매도";
      desc =
        "전고점 대비 +45% 이상 상승 구간입니다. 매도 신호가 발생했습니다.";
    } else if (current <= buyLine || (dippedBelowBuy && current < ath)) {
      status = "buy";
      label = "매수 기간";
      desc =
        "전고점 대비 −15% 이상 하락 후, 전고점 회복 전까지 매수 기간입니다.";
    } else {
      desc =
        "전고점 +45% 미만 · −15% 초과 구간입니다. 거래 대기 중입니다.";
    }

    return {
      ath: ath,
      athIdx: athIdx,
      prevAth: prevAth,
      hasPrevAth: hasPrevAth,
      pctFromPrevAth: pctFromPrevAth,
      current: current,
      buyLine: buyLine,
      sellLine: sellLine,
      pctOfAth: pctOfAth,
      status: status,
      label: label,
      desc: desc,
    };
  }

  function getChartSize(wrap) {
    const style = window.getComputedStyle(wrap);
    let w = wrap.clientWidth;
    let h = wrap.clientHeight;
    if (h < 20) {
      h =
        parseFloat(style.height) ||
        parseFloat(style.minHeight) ||
        280;
    }
    if (w < 20) {
      w =
        (wrap.parentElement && wrap.parentElement.clientWidth - 16) ||
        parseFloat(style.width) ||
        320;
    }
    return { w: Math.max(w, 200), h: Math.max(h, 220) };
  }

  function drawTqqqMessage(w, h, msg) {
    if (!tqqqChart) return;
    const dpr = window.devicePixelRatio || 1;
    tqqqChart.width = Math.floor(w * dpr);
    tqqqChart.height = Math.floor(h * dpr);
    tqqqChart.style.width = w + "px";
    tqqqChart.style.height = h + "px";
    const ctx = tqqqChart.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fefefe";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20,20,20,0.55)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, w / 2, h / 2);
  }

  function drawTqqqChart(closes, highs, timestamps, meta) {
    if (!tqqqChart) return null;
    const wrap = tqqqChart.parentElement;
    if (!wrap) return null;

    const size = getChartSize(wrap);
    const w = size.w;
    const h = size.h;

    if (wrap.clientHeight < 20) {
      wrap.style.minHeight = h + "px";
      wrap.style.height = h + "px";
    }

    const dpr = window.devicePixelRatio || 1;
    tqqqChart.width = Math.floor(w * dpr);
    tqqqChart.height = Math.floor(h * dpr);
    tqqqChart.style.width = w + "px";
    tqqqChart.style.height = h + "px";

    const ctx = tqqqChart.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padL = 44;
    const padR = 12;
    const padT = 14;
    const padB = 22;
    const chartW = Math.max(w - padL - padR, 1);
    const chartH = Math.max(h - padT - padB, 1);

    const visibleBars = Math.min(closes.length, 504);
    const startIdx = closes.length - visibleBars;
    const plotSlice = closes.slice(startIdx);
    const validPlot = plotSlice.filter(function (v) { return v != null; });
    if (validPlot.length < 2) {
      throw new Error("TQQQ 가격 데이터가 부족합니다.");
    }
    const analysis = analyzeTqqq(closes, highs);
    const { ath, prevAth, hasPrevAth, buyLine, sellLine, current } = analysis;

    let yMin = Math.min.apply(null, validPlot);
    let yMax = Math.max.apply(null, validPlot);
    yMin = Math.min(yMin, buyLine);
    yMax = Math.max(yMax, sellLine, ath);
    if (hasPrevAth) {
      yMin = Math.min(yMin, prevAth);
      yMax = Math.max(yMax, prevAth);
    }
    const yPad = (yMax - yMin) * 0.06 || 1;
    yMin -= yPad;
    yMax += yPad;

    function yPos(price) {
      return padT + chartH - ((price - yMin) / (yMax - yMin)) * chartH;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fefefe";
    ctx.fillRect(0, 0, w, h);

    function fillBand(yTop, yBottom, color) {
      const top = Math.min(yTop, yBottom);
      const height = Math.abs(yBottom - yTop);
      ctx.fillStyle = color;
      ctx.fillRect(padL, top, chartW, height);
    }

    fillBand(yPos(sellLine), yPos(yMax), "rgba(200, 60, 60, 0.18)");
    fillBand(yPos(ath), yPos(sellLine), "rgba(220, 180, 50, 0.16)");
    fillBand(yPos(buyLine), yPos(ath), "rgba(120, 160, 200, 0.1)");
    fillBand(yPos(yMin), yPos(buyLine), "rgba(50, 140, 70, 0.18)");

    ctx.strokeStyle = "rgba(20,20,20,0.08)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (chartH / 4) * g;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + chartW, gy);
      ctx.stroke();
    }

    function drawHLine(price, color, dash, label) {
      const y = yPos(price);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, 4, y + 4);
      ctx.restore();
    }

    drawHLine(sellLine, "rgba(180,40,40,0.85)", [6, 4], "매도 +45%");
    drawHLine(ath, "#141414", null, "전고점");
    if (hasPrevAth) {
      drawHLine(prevAth, "rgba(130,130,130,0.9)", [5, 5], "이전 전고점");
    }
    drawHLine(buyLine, "rgba(40,120,60,0.9)", [4, 3], "매수 −15%");

    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let started = false;
    plotSlice.forEach(function (c, i) {
      if (c == null) return;
      const x = padL + (i / (plotSlice.length - 1 || 1)) * chartW;
      const y = yPos(c);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const lastX = padL + chartW;
    const lastY = yPos(current);
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(20,20,20,0.45)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      "$" + current.toFixed(2),
      padL + chartW,
      Math.max(padT + 10, lastY - 8)
    );

    if (tqqqStatus) {
      let statusText =
        "전고점 $" +
        ath.toFixed(2) +
        " · 매도 $" +
        sellLine.toFixed(2) +
        " · 매수 $" +
        buyLine.toFixed(2);
      if (hasPrevAth) {
        statusText += " · 이전 전고점 $" + prevAth.toFixed(2);
      }
      tqqqStatus.textContent = statusText;
    }

    return analysis;
  }

  function updateTqqqUI(analysis, meta) {
    const currency = (meta && meta.currency) || "USD";
    if (tqqqPrice) {
      tqqqPrice.textContent =
        "현재가 $" +
        analysis.current.toFixed(2) +
        " (" +
        currency +
        ")";
    }
    if (tqqqAthPct) {
      tqqqAthPct.textContent =
        "전고점 대비 " +
        analysis.pctOfAth.toFixed(1) +
        "% ($" +
        analysis.ath.toFixed(2) +
        ")";
    }
    if (tqqqPrevAthPct) {
      if (analysis.hasPrevAth && analysis.pctFromPrevAth != null) {
        const sign = analysis.pctFromPrevAth >= 0 ? "+" : "";
        tqqqPrevAthPct.textContent =
          "이전 전고점 대비 " +
          sign +
          analysis.pctFromPrevAth.toFixed(1) +
          "% ($" +
          analysis.prevAth.toFixed(2) +
          ")";
      } else {
        tqqqPrevAthPct.textContent = "이전 전고점 대비 —";
      }
    }
    if (tqqqTradeBadge) {
      tqqqTradeBadge.textContent = analysis.label;
      tqqqTradeBadge.className =
        "tqqq-badge tqqq-badge--" + analysis.status;
    }
    if (tqqqTradeDesc) {
      tqqqTradeDesc.textContent = analysis.desc;
    }
  }

  function renderTqqqFromCache() {
    if (!tqqqCache || !tqqqChart) return false;
    const wrap = tqqqChart.parentElement;
    const size = wrap ? getChartSize(wrap) : { w: 320, h: 280 };
    try {
      const analysis = drawTqqqChart(
        tqqqCache.closes,
        tqqqCache.highs,
        tqqqCache.timestamps,
        tqqqCache.meta
      );
      if (analysis) {
        updateTqqqUI(analysis, tqqqCache.meta);
        return true;
      }
    } catch (e) {
      drawTqqqMessage(size.w, size.h, e.message || "차트를 그리지 못했습니다.");
      if (tqqqStatus) {
        tqqqStatus.textContent = e.message || "차트를 그리지 못했습니다.";
      }
    }
    return false;
  }

  async function loadTqqq(opts) {
    const silent = opts && opts.silent;
    const gen = ++tqqqFetchGen;

    const stored = readStoredTqqqCache();
    if (stored && (!tqqqCache || !silent)) {
      tqqqCache = stored;
      renderTqqqFromCache();
      tqqqLoaded = true;
    }

    if (
      silent &&
      stored &&
      stored.savedAt &&
      Date.now() - stored.savedAt < TQQQ_CACHE_TTL_MS
    ) {
      return;
    }

    if (!silent && tqqqStatus && !tqqqLoaded) {
      tqqqStatus.textContent = "TQQQ 차트 불러오는 중…";
    }

    try {
      const data = await fetchTqqqChartData();
      if (gen !== tqqqFetchGen) return;

      tqqqCache = {
        closes: data.closes,
        highs: data.highs,
        timestamps: data.timestamps,
        meta: data.meta,
        source: data.source,
        savedAt: Date.now(),
      };
      writeStoredTqqqCache(tqqqCache);

      if (renderTqqqFromCache()) {
        tqqqLoaded = true;
      } else {
        window.setTimeout(renderTqqqFromCache, 200);
      }
    } catch (e) {
      if (gen !== tqqqFetchGen) return;
      if (tqqqCache) return;

      tqqqLoaded = false;
      const wrap = tqqqChart && tqqqChart.parentElement;
      if (wrap) {
        const size = getChartSize(wrap);
        drawTqqqMessage(
          size.w,
          size.h,
          e.name === "AbortError"
            ? "TQQQ 데이터 요청 시간 초과"
            : e.message || "TQQQ 데이터를 불러오지 못했습니다."
        );
      }
      if (tqqqStatus) {
        tqqqStatus.textContent =
          e.name === "AbortError"
            ? "TQQQ 데이터 요청 시간 초과입니다."
            : e.message || "TQQQ 데이터를 불러오지 못했습니다.";
      }
    }
  }

  if (tqqqChart && tqqqChart.parentElement && window.ResizeObserver) {
    new ResizeObserver(function () {
      if (tqqqCache && app && app.classList.contains("is-stock-mode")) {
        renderTqqqFromCache();
      }
    }).observe(tqqqChart.parentElement);
  }

  window.addEventListener("resize", function () {
    if (app && app.classList.contains("is-stock-mode") && tqqqCache) {
      renderTqqqFromCache();
    }
  });

  function parseResponseBody(text) {
    const trimmed = String(text || "")
      .trim()
      .replace(/^\uFEFF/, "");
    if (!trimmed) {
      throw new Error("서버에서 빈 응답을 받았습니다.");
    }

    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      return { chartUrl: trimmed, _responseType: "chartUrl" };
    }

    try {
      return JSON.parse(trimmed);
    } catch (e) {
      const jsonSlice = trimmed.match(/\{[\s\S]*\}/);
      if (jsonSlice) {
        try {
          return JSON.parse(jsonSlice[0]);
        } catch (e2) {
          /* fall through */
        }
      }
      const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
      if (urlMatch) {
        return { chartUrl: urlMatch[0], _responseType: "chartUrl" };
      }
      throw new Error(
        trimmed.length > 160 ? trimmed.slice(0, 160) + "…" : trimmed
      );
    }
  }

  async function fetchJson(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(function () {
      ctrl.abort();
    }, timeoutMs || 90000);

    try {
      const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
      const text = await res.text();
      let data;
      try {
        data = parseResponseBody(text);
      } catch (e) {
        if (!res.ok) {
          throw new Error(
            (e && e.message) || text.slice(0, 120) || "응답 오류 (" + res.status + ")"
          );
        }
        throw new Error(
          "예측 결과를 해석하지 못했습니다. " +
            ((e && e.message) || "응답 형식 오류")
        );
      }
      if (!res.ok || (data.status && Number(data.status) >= 400)) {
        const errMsg =
          data.error ||
          data.message ||
          "요청 실패 (" + res.status + ")";
        throw new Error(errMsg);
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function findStockCode(name) {
    const target = (name || "").trim();
    if (!target) return "";
    const lists = document.querySelectorAll(".stock-item-btn");
    for (let i = 0; i < lists.length; i++) {
      const btn = lists[i];
      if (btn.dataset.name === target && btn.dataset.code) {
        return btn.dataset.code;
      }
    }
    return "";
  }

  function renderStockList(listEl, items) {
    if (!listEl) return;
    listEl.innerHTML = "";
    items.forEach(function (item, i) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stock-item-btn";
      btn.dataset.name = item.name;
      if (item.code) btn.dataset.code = item.code;
      btn.innerHTML =
        '<span class="stock-item-rank">' +
        (i + 1) +
        "</span>" +
        '<span class="stock-item-name">' +
        escapeHtml(item.name) +
        "</span>" +
        '<span class="stock-item-cap">' +
        formatMarketCap(item.marketCap) +
        "</span>";
      btn.addEventListener("click", function () {
        selectStock(item.name);
        runPrediction(item.name, item.code);
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function loadMarketCap() {
    setStatus("시가총액 불러오는 중…");
    try {
      const data = await fetchJson(API + "marketCap", 30000);
      renderStockList(kospiList, data.kospi || []);
      renderStockList(kosdaqList, data.kosdaq || []);
      marketLoaded = true;
      setStatus("종목을 누르거나 이름을 입력해 AI 예측을 받아보세요.");
    } catch (e) {
      setStatus(
        e.name === "AbortError"
          ? "시가총액 요청 시간 초과입니다."
          : e.message || "시가총액을 불러오지 못했습니다.",
        true
      );
    }
  }

  function selectStock(name) {
    if (stockSearch) stockSearch.value = name;
    document.querySelectorAll(".stock-item-btn").forEach(function (el) {
      el.classList.toggle("is-selected", el.dataset.name === name);
    });
  }

  function renderPrediction(name, data) {
    if (!stockResult || !stockResultBody || !stockResultTitle) return;
    stockResult.hidden = false;
    stockResultTitle.textContent = name + " — AI 주식 예측";
    stockResultBody.innerHTML = "";

    const chartUrl =
      (data && data.chartUrl) ||
      (data && data.url) ||
      (data && data.image) ||
      (typeof data === "string" && /^https?:\/\//i.test(data) ? data : "");

    if (chartUrl) {
      const wrap = document.createElement("div");
      wrap.className = "stock-chart-result";
      const link = document.createElement("a");
      link.className = "stock-chart-link";
      link.href = chartUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "예측 차트 원본 보기";
      const img = document.createElement("img");
      img.className = "stock-chart-img";
      img.src = chartUrl;
      img.alt = name + " AI 예측 차트";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () {
        img.hidden = true;
        const note = document.createElement("p");
        note.className = "stock-chart-fallback";
        note.textContent =
          "차트 이미지를 불러오지 못했습니다. 위 링크로 원본을 열어 주세요.";
        wrap.appendChild(note);
      });
      wrap.appendChild(link);
      wrap.appendChild(img);
      stockResultBody.appendChild(wrap);
      stockResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (typeof data === "string") {
      stockResultBody.textContent = data;
      return;
    }

    const dl = document.createElement("dl");
    dl.className = "stock-dl";

    function appendRow(label, value) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      if (value == null || value === "") {
        dd.textContent = "-";
      } else if (typeof value === "object") {
        dd.textContent = JSON.stringify(value, null, 2);
      } else {
        dd.textContent = String(value);
      }
      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    Object.keys(data).forEach(function (key) {
      if (key === "status" && data.status >= 400) return;
      appendRow(key, data[key]);
    });

    if (!dl.childNodes.length) {
      stockResultBody.textContent = JSON.stringify(data, null, 2);
    } else {
      stockResultBody.appendChild(dl);
    }

    stockResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function requestPortfolioAI(name) {
    const url = API + "portfolioAI&name=" + encodeURIComponent(name);
    return fetchJson(url, 90000);
  }

  async function runPrediction(name, stockCode) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      setStatus("종목명을 입력해 주세요.", true);
      stockSearch && stockSearch.focus();
      return;
    }
    if (predictBusy) return;
    predictBusy = true;
    if (stockPredictBtn) stockPredictBtn.disabled = true;
    setStatus(trimmed + " AI 예측 분석 중… (최대 90초)");
    stockResult.hidden = true;

    const code = (stockCode || findStockCode(trimmed) || "").trim();
    const tried = [];

    try {
      let data;
      try {
        tried.push(trimmed);
        data = await requestPortfolioAI(trimmed);
      } catch (firstErr) {
        const canRetryWithCode =
          code &&
          code !== trimmed &&
          tried.indexOf(code) < 0 &&
          (/데이터가 충분하지|405|not enough/i.test(firstErr.message || "") ||
            firstErr.message.indexOf("요청 실패") >= 0);
        if (canRetryWithCode) {
          setStatus(trimmed + " → 종목코드(" + code + ")로 재시도 중…");
          tried.push(code);
          data = await requestPortfolioAI(code);
        } else {
          throw firstErr;
        }
      }
      renderPrediction(trimmed, data);
      setStatus(trimmed + " 예측 완료.");
    } catch (e) {
      const msg =
        e.name === "AbortError"
          ? "예측 요청 시간 초과입니다. 잠시 후 다시 시도해 주세요."
          : e.message || "예측을 불러오지 못했습니다.";
      setStatus(msg, true);
      stockResult.hidden = false;
      stockResultTitle.textContent = trimmed + " — AI 주식 예측";
      stockResultBody.innerHTML =
        '<p class="stock-error">' + escapeHtml(msg) + "</p>";
    } finally {
      predictBusy = false;
      if (stockPredictBtn) stockPredictBtn.disabled = false;
    }
  }

  if (stockBtn) {
    stockBtn.addEventListener("click", function () {
      const on = !app.classList.contains("is-stock-mode");
      showStockMode(on);
    });
  }

  if (stockBack) {
    stockBack.addEventListener("click", function () {
      showStockMode(false);
    });
  }

  if (stockPredictBtn) {
    stockPredictBtn.addEventListener("click", function () {
      runPrediction(stockSearch && stockSearch.value);
    });
  }

  if (stockSearch) {
    stockSearch.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        runPrediction(stockSearch.value);
      }
    });
  }

  if (tqqqChart) {
    loadTqqq({ silent: true });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && app && app.classList.contains("is-stock-mode")) {
      loadTqqq({ silent: true });
    }
  });

  window.addEventListener("online", function () {
    if (app && app.classList.contains("is-stock-mode")) {
      loadTqqq({ silent: true });
    }
  });
})();
