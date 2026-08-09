# 반도체 주식으로 돈벌자

듀얼 모드(A: 바닥 잡기 / B: 추세 탑승) · SMA60 시장 국면 · 손절가 안내

## 데이터 소스

**한국투자증권 Open API (KIS Developers)** 로 삼성전자·SK하이닉스 일봉·현재가를 bake합니다.

| 항목 | 내용 |
|------|------|
| 일봉 | `inquire-daily-itemchartprice` (`FHKST03010100`) |
| 현재가 | `inquire-price` (`FHKST01010100`) |
| 갱신 | GitHub Actions 크론 (~10분) → `semiconductor-stock/data/*.json` |
| 화면 | 정적 JSON 즉시 표시 + 2분마다 재조회 |

> 사이트는 GitHub Pages 정적 배포라, 브라우저에 AppKey를 넣지 않습니다.  
> 시세 갱신은 Actions 서버에서만 KIS를 호출합니다.

### GitHub Secrets (isiboss 저장소)

| Secret | 설명 |
|--------|------|
| `KIS_APP_KEY` | KIS Developers 앱 키 (실전 권장) |
| `KIS_APP_SECRET` | 앱 시크릿 |
| `KIS_ENV` | (선택) `vps` 이면 모의투자 서버 |

로컬 bake:

```bash
export KIS_APP_KEY=...
export KIS_APP_SECRET=...
node scripts/generate-stock-json.mjs
```

키가 없으면 Yahoo 폴백을 시도합니다 (CORS/차단으로 실패할 수 있음).

## 로컬 실행

```bash
npm install
npm run dev
```

## GitHub Pages (angrywork.com)

`main` push 시 Actions가 빌드·배포합니다.

- 게임: https://angrywork.com/
- 반도체 퀀트: https://angrywork.com/semiconductor-stock/

## 스택

KIS Open API · technicalindicators · lightweight-charts · Tailwind · Next.js static export
