/**
 * 한국투자증권(KIS Developers) Open API 헬퍼
 * 환경변수: KIS_APP_KEY, KIS_APP_SECRET
 * 선택: KIS_BASE_URL (기본 실전), KIS_ENV=vps 시 모의서버
 */
const PROD_BASE = "https://openapi.koreainvestment.com:9443";
const VPS_BASE = "https://openapivts.koreainvestment.com:29443";

let cachedToken = null;
let tokenExpiresAt = 0;

function getBaseUrl() {
  if (process.env.KIS_BASE_URL) return process.env.KIS_BASE_URL.replace(/\/$/, "");
  if (String(process.env.KIS_ENV || "").toLowerCase() === "vps") return VPS_BASE;
  return PROD_BASE;
}

function requireKeys() {
  const appkey = process.env.KIS_APP_KEY || process.env.KIS_APPKEY;
  const appsecret = process.env.KIS_APP_SECRET || process.env.KIS_APPSECRET;
  if (!appkey || !appsecret) {
    throw new Error(
      "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 없습니다. KIS Developers 앱키를 설정해 주세요."
    );
  }
  return { appkey, appsecret };
}

export function hasKisCredentials() {
  return !!(
    process.env.KIS_APP_KEY ||
    process.env.KIS_APPKEY
  ) && !!(
    process.env.KIS_APP_SECRET ||
    process.env.KIS_APPSECRET
  );
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function kstYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "");
}

function ymdToIso(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function addDaysYmd(ymd, days) {
  const d = new Date(
    Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(4, 6)) - 1,
      Number(ymd.slice(6, 8))
    )
  );
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { appkey, appsecret } = requireKeys();
  const base = getBaseUrl();
  const res = await fetch(`${base}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey,
      appsecret,
    }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`KIS token 파싱 실패: ${res.status} ${text.slice(0, 200)}`);
  }

  if (!res.ok || !json.access_token) {
    throw new Error(
      `KIS token 실패: ${json.error_description || json.msg1 || json.message || res.status}`
    );
  }

  cachedToken = json.access_token;
  const expiresIn = Number(json.expires_in) || 86400;
  tokenExpiresAt = now + expiresIn * 1000;
  return cachedToken;
}

async function kisGet(path, trId, params) {
  const { appkey, appsecret } = requireKeys();
  const token = await getAccessToken();
  const base = getBaseUrl();
  const url = new URL(path, base);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      appkey,
      appsecret,
      tr_id: trId,
      custtype: "P",
    },
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`KIS ${trId} 파싱 실패: ${res.status} ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.rt_cd !== "0") {
    throw new Error(
      `KIS ${trId} 오류: ${json.msg_cd || ""} ${json.msg1 || res.status}`
    );
  }

  return json;
}

/**
 * 국내주식 기간별 시세 — 일봉 (최대 ~100건/요청)
 * tr_id: FHKST03010100
 */
export async function fetchDailyBarsRange(stockCode, startYmd, endYmd) {
  const json = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
    "FHKST03010100",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: stockCode,
      FID_INPUT_DATE_1: startYmd,
      FID_INPUT_DATE_2: endYmd,
      FID_PERIOD_DIV_CODE: "D",
      FID_ORG_ADJ_PRC: "0",
    }
  );

  const rows = Array.isArray(json.output2) ? json.output2 : [];
  const bars = [];

  for (const row of rows) {
    const ymd = row.stck_bsop_date;
    if (!ymd || ymd.length !== 8) continue;
    const open = toNum(row.stck_oprc);
    const high = toNum(row.stck_hgpr);
    const low = toNum(row.stck_lwpr);
    const close = toNum(row.stck_clpr);
    if (open == null || high == null || low == null || close == null) continue;
    bars.push({
      date: ymdToIso(ymd),
      open,
      high,
      low,
      close,
      volume: toNum(row.acml_vol) ?? 0,
    });
  }

  return bars;
}

/**
 * 주식현재가 시세
 * tr_id: FHKST01010100
 */
export async function fetchCurrentPrice(stockCode) {
  const json = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-price",
    "FHKST01010100",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: stockCode,
    }
  );

  const o = json.output || {};
  const price = toNum(o.stck_prpr);
  if (price == null) throw new Error(`${stockCode} 현재가 없음`);

  return {
    price,
    open: toNum(o.stck_oprc) ?? price,
    high: toNum(o.stck_hgpr) ?? price,
    low: toNum(o.stck_lwpr) ?? price,
    volume: toNum(o.acml_vol) ?? 0,
    date: ymdToIso(kstYmd()),
  };
}

/**
 * 최근 ~6개월 일봉 + 당일 현재가 반영
 */
export async function fetchSixMonthBarsWithLive(stockCode) {
  const end = kstYmd();
  // KIS 일봉 조회는 요청당 최대 약 100건 → 2회 페이징
  const midStart = addDaysYmd(end, -110);
  const midEnd = end;
  const oldStart = addDaysYmd(end, -230);
  const oldEnd = addDaysYmd(midStart, -1);

  const recent = await fetchDailyBarsRange(stockCode, midStart, midEnd);
  await delay(350);
  const older = await fetchDailyBarsRange(stockCode, oldStart, oldEnd);

  const byDate = new Map();
  for (const b of [...older, ...recent]) {
    byDate.set(b.date, b);
  }

  let bars = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (bars.length < 30) {
    throw new Error(`${stockCode} 일봉 부족 (${bars.length}건)`);
  }

  try {
    await delay(350);
    const live = await fetchCurrentPrice(stockCode);
    const last = bars[bars.length - 1];
    if (last.date < live.date) {
      bars.push({
        date: live.date,
        open: live.open,
        high: live.high,
        low: live.low,
        close: live.price,
        volume: live.volume,
      });
    } else if (last.date === live.date) {
      last.open = live.open;
      last.high = Math.max(live.high, live.price, last.high);
      last.low = Math.min(live.low, live.price, last.low);
      last.close = live.price;
      last.volume = live.volume || last.volume;
    } else {
      // 휴장일 등: 마지막 봉 종가만 현재가로 보정하지 않음
    }
  } catch (e) {
    console.warn(`[KIS] ${stockCode} 현재가 반영 실패:`, e.message || e);
  }

  // 최근 약 130거래일 정도 유지
  if (bars.length > 160) bars = bars.slice(-160);
  return bars;
}

export function yahooSymbolToKisCode(symbol) {
  return String(symbol).replace(/\.KS$/i, "").replace(/\.KQ$/i, "");
}
