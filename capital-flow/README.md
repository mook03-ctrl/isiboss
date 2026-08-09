# 세상 돈의 흐름 보기

글로벌 안전자산·위험자산 달러 거래량 비중 트리맵 + 반도체(SMH) 타이밍 지표.

## Zero-config

API 키 **불필요**. `yahoo-finance2` + CoinGecko public API로 bake합니다.

| 항목 | 내용 |
|------|------|
| 안전 | GLD, TLT |
| 위험 | BTC+ETH (CoinGecko), SMH, BOTZ, XLV, CARZ, XLF |
| 가중치 | Dollar Volume = Price × Volume → 100% 정규화 |
| 정적 배포 | GitHub Pages (`/capital-flow/`) |

## 로컬

```bash
npm install
npm run bake   # 시세 JSON 생성
npm run dev    # http://localhost:3001
```

## 배포

root `pages.yml` 이 `capital-flow` 를 빌드·스테이징합니다.
