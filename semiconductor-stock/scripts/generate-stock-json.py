#!/usr/bin/env python3
"""
삼성전자·SK하이닉스 일봉 → public/data/*.json
PyKRX (KRX 공개 시세) — API 키 불필요
"""
from __future__ import annotations

import json
import sys
import time
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
OUT_DIR = ROOT / "public" / "data"

# symbol(웹 키) → 종목코드
SYMBOLS = [
    ("005930.KS", "005930"),
    ("000660.KS", "000660"),
]


def kst_today() -> datetime:
    return datetime.now(KST)


def ymd(d: datetime) -> str:
    return d.strftime("%Y%m%d")


def iso_date(d) -> str:
    if hasattr(d, "strftime"):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10]


def fetch_bars(code: str, months: int = 7) -> list[dict]:
    end = kst_today()
    start = end - timedelta(days=months * 31)
    df = stock.get_market_ohlcv_by_date(ymd(start), ymd(end), code)
    if df is None or df.empty:
        raise RuntimeError(f"{code}: PyKRX 일봉 비어 있음")

    # 컬럼: 시가 고가 저가 종가 거래량 (버전별 영문일 수 있음)
    colmap = {}
    for c in df.columns:
        name = str(c)
        if name in ("시가", "Open", "open"):
            colmap["open"] = c
        elif name in ("고가", "High", "high"):
            colmap["high"] = c
        elif name in ("저가", "Low", "low"):
            colmap["low"] = c
        elif name in ("종가", "Close", "close"):
            colmap["close"] = c
        elif name in ("거래량", "Volume", "volume"):
            colmap["volume"] = c

    required = ("open", "high", "low", "close")
    if not all(k in colmap for k in required):
        raise RuntimeError(f"{code}: 예상 컬럼 없음 {list(df.columns)}")

    bars: list[dict] = []
    for idx, row in df.iterrows():
        try:
            open_ = float(row[colmap["open"]])
            high = float(row[colmap["high"]])
            low = float(row[colmap["low"]])
            close = float(row[colmap["close"]])
        except (TypeError, ValueError):
            continue
        if any(v != v for v in (open_, high, low, close)):  # NaN
            continue
        vol = 0.0
        if "volume" in colmap:
            try:
                vol = float(row[colmap["volume"]])
                if vol != vol:
                    vol = 0.0
            except (TypeError, ValueError):
                vol = 0.0
        bars.append(
            {
                "date": iso_date(idx),
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": vol,
            }
        )

    bars.sort(key=lambda b: b["date"])
    if len(bars) < 30:
        raise RuntimeError(f"{code}: 일봉 부족 ({len(bars)}건)")
    return bars


def write_symbol(symbol: str, code: str) -> None:
    out = OUT_DIR / f"{symbol}.json"
    try:
        bars = fetch_bars(code)
        payload = {
            "symbol": symbol,
            "source": "pykrx",
            "fetchedAt": datetime.now(KST).isoformat(),
            "bars": bars,
        }
        out.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        last = bars[-1]
        print(
            f"Wrote {out} ({len(bars)} bars, last={last['date']} "
            f"close={last['close']}, source=pykrx)"
        )
    except Exception as e:
        if out.exists():
            print(f"[warn] {symbol} bake 실패 — 기존 JSON 유지: {e}", file=sys.stderr)
            return
        raise


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Baking semiconductor stock JSON via PyKRX…")
    for i, (symbol, code) in enumerate(SYMBOLS):
        write_symbol(symbol, code)
        if i < len(SYMBOLS) - 1:
            time.sleep(0.8)  # KRX 과도 요청 완화


if __name__ == "__main__":
    main()
