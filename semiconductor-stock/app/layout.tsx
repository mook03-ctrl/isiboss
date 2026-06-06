import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://angrywork.com"),
  title: "반도체 주식으로 돈벌자 | 매수 신뢰도",
  description:
    "삼성전자·SK하이닉스 기술적 지표(RSI, MACD, 볼린저, SMA) 기반 매수 확률 대시보드. angrywork.com 반도체 주식 퀀트 참고 도구.",
  keywords: [
    "반도체 주식",
    "삼성전자",
    "SK하이닉스",
    "매수 신뢰도",
    "RSI",
    "MACD",
    "angrywork",
  ],
  alternates: {
    canonical: "/semiconductor-stock/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "angrywork.com",
    title: "반도체 주식으로 돈벌자 | 매수 신뢰도",
    description:
      "삼성전자·SK하이닉스 기술적 지표 기반 매수 확률 대시보드 (RSI, MACD, 볼린저, SMA)",
    url: "/semiconductor-stock/",
  },
  twitter: {
    card: "summary_large_image",
    title: "반도체 주식으로 돈벌자 | 매수 신뢰도",
    description:
      "삼성전자·SK하이닉스 기술적 지표 기반 매수 확률 대시보드",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen">
          <header className="border-b-2 border-ink/15 bg-white/60 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-ink/50">
                  Quant Prototype
                </p>
                <h1 className="text-xl font-bold sm:text-2xl">
                  반도체 주식으로 돈벌자
                </h1>
              </div>
              <a
                href="/"
                className="rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-medium shadow-[2px_2px_0_#141414] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#141414]"
              >
                ← 다 때려쳐 @office
              </a>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
