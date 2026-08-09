# 반도체 주식으로 돈벌자

듀얼 모드(A: 바닥 잡기 / B: 추세 탑승) · SMA60 시장 국면 · 손절가 안내

## 데이터 소스

**PyKRX** (KRX 공개 시세)로 삼성전자·SK하이닉스 일봉을 bake합니다.  
**추가 API 키·Secrets 설정 없음.**

| 항목 | 내용 |
|------|------|
| 라이브러리 | [pykrx](https://github.com/sharebook-kr/pykrx) |
| 갱신 | GitHub Actions 약 30분마다 → `semiconductor-stock/data/*.json` |
| 화면 | 정적 JSON 즉시 표시 + 2분마다 재조회 |

로컬 bake:

```bash
pip install pykrx
python scripts/generate-stock-json.py
# 또는
npm run prebuild
```

## 로컬 실행

```bash
pip install pykrx   # 최초 1회
npm install
npm run dev
```

## GitHub Pages (angrywork.com)

`main` push 시 Actions가 빌드·배포합니다. 별도 GitHub Secret 불필요.

- 게임: https://angrywork.com/
- 반도체 퀀트: https://angrywork.com/semiconductor-stock/

## 스택

PyKRX · technicalindicators · lightweight-charts · Tailwind · Next.js static export
