#!/usr/bin/env python3
"""
시세 포스트잇 JSON (data/market-ticker.json)
- KR: PyKRX (코스피·삼성·하이닉스)
- US/FX: Yahoo chart API 폴백 (나스닥·원달러, 키 불필요)
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from pykrx import stock
except ImportError:
    print("pykrx 미설치: pip install pykrx", file=sys.stderr)
    sys.exit(1)

KST = ZoneInfo("Asia/Seoul")
ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "data" / "market-ticker.json"

SYMBOL_KOSPI = "^KS11"
SYMBOL_NASDAQ = "^IXIC"
SYMBOL_SAMSUNG = "005930.KS"
SYMBOL_HYNIX = "000660.KS"
SYMBOL_USDKRW = "KRW=X"
INDEX_KOSPI = "1001"


def kst_now() -> datetime:
    return datetime.now(KST)


def ymd(d: datetime) -> str:
    return d.strftime("%Y%m%d")


def num(v, default=None):
    try:
        n = float(v)
        if n != n:
            return default
        return n
    except (TypeError, ValueError):
        return default


def pct_change(last: float, prev: float | None) -> float | None:
    if prev is None or prev == 0 or last is None:
        return None
    return ((last - prev) / prev) * 100.0


def close_col(df):
    for name in ("종가", "Close", "close"):
        if name in df.columns:
            return name
    for c in df.columns:
        if str(c) not in ("거래량", "Volume", "volume"):
            return c
    return df.columns[-1]


def last_two_closes(df) -> tuple[float | None, float | None]:
    if df is None or df.empty:
        return None, None
    col = close_col(df)
    series = df[col].dropna()
    if series.empty:
        return None, None
    last = float(series.iloc[-1])
    prev = float(series.iloc[-2]) if len(series) >= 2 else None
    return last, prev


def fetch_index_kospi() -> dict:
    end = kst_now()
    start = end - timedelta(days=14)
    df = stock.get_index_ohlcv_by_date(ymd(start), ymd(end), INDEX_KOSPI)
    last, prev = last_two_closes(df)
    if last is None:
        raise RuntimeError("코스피 일봉 없음")
    return {
        "symbol": SYMBOL_KOSPI,
        "regularMarketPrice": last,
        "regularMarketChangePercent": pct_change(last, prev),
        "source": "pykrx",
    }


def fetch_equity(code: str, symbol_key: str) -> dict:
    end = kst_now()
    start = end - timedelta(days=14)
    df = stock.get_market_ohlcv_by_date(ymd(start), ymd(end), code)
    last, prev = last_two_closes(df)
    if last is None:
        raise RuntimeError(f"{code} 일봉 없음")
    return {
        "symbol": symbol_key,
        "regularMarketPrice": last,
        "regularMarketChangePercent": pct_change(last, prev),
        "source": "pykrx",
    }


def fetch_yahoo_chart(symbol: str) -> dict:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(symbol, safe="")
        + "?interval=1d&range=5d"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; angrywork-ticker/2.0)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode("utf-8"))
    result = ((data.get("chart") or {}).get("result") or [None])[0] or {}
    meta = result.get("meta") or {}
    price = num(meta.get("regularMarketPrice"))
    if price is None:
        raise RuntimeError(f"{symbol} Yahoo 시세 없음")
    pct = num(meta.get("regularMarketChangePercent"))
    prev = num(meta.get("chartPreviousClose")) or num(meta.get("previousClose"))
    if pct is None and prev and prev > 0:
        pct = ((price - prev) / prev) * 100.0
    return {
        "symbol": symbol,
        "regularMarketPrice": price,
        "regularMarketChangePercent": pct,
        "source": "yahoo",
    }


def load_existing() -> dict:
    if not OUT_FILE.exists():
        return {}
    try:
        return json.loads(OUT_FILE.read_text(encoding="utf-8")).get("quotes") or {}
    except Exception:
        return {}


def main() -> None:
    quotes: dict = {}
    existing = load_existing()

    # KR 주식·지수는 PyKRX 우선, 실패 시 Yahoo 폴백
    def kospi_with_fallback() -> dict:
        try:
            return fetch_index_kospi()
        except Exception as e:
            print(f"[warn] 코스피 PyKRX 실패 → Yahoo: {e}", file=sys.stderr)
            return fetch_yahoo_chart(SYMBOL_KOSPI)

    def equity_with_fallback(code: str, symbol_key: str) -> dict:
        try:
            return fetch_equity(code, symbol_key)
        except Exception as e:
            print(f"[warn] {symbol_key} PyKRX 실패 → Yahoo: {e}", file=sys.stderr)
            return fetch_yahoo_chart(symbol_key)

    steps = [
        ("코스피", kospi_with_fallback),
        ("삼성전자", lambda: equity_with_fallback("005930", SYMBOL_SAMSUNG)),
        ("하이닉스", lambda: equity_with_fallback("000660", SYMBOL_HYNIX)),
        ("나스닥", lambda: fetch_yahoo_chart(SYMBOL_NASDAQ)),
        ("원달러", lambda: fetch_yahoo_chart(SYMBOL_USDKRW)),
    ]

    for label, fn in steps:
        try:
            q = fn()
            quotes[q["symbol"]] = q
            print(
                f"{label} ({q['symbol']}): {q['regularMarketPrice']} "
                f"chg={q.get('regularMarketChangePercent')} src={q.get('source')}"
            )
        except Exception as e:
            print(f"[warn] {label}: {e}", file=sys.stderr)
        time.sleep(0.35)

    for key, prev in existing.items():
        if key not in quotes and prev:
            quotes[key] = prev
            print(f"[keep] {key} 기존 값 유지")

    if not quotes:
        print("시세 0건", file=sys.stderr)
        sys.exit(1)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "savedAt": int(time.time() * 1000),
        "source": "pykrx+yahoo",
        "quotes": quotes,
    }
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {OUT_FILE} ({len(quotes)} symbols)")


if __name__ == "__main__":
    main()
