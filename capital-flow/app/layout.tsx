import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://angrywork.com"),
  title: "세상 돈의 흐름 보기 | Global Capital Flow",
  description:
    "안전자산·위험자산·반도체(SMH) 달러 거래량 비중 트리맵으로 글로벌 자본 흐름과 반도체 타이밍을 확인합니다. API 키 불필요.",
  alternates: { canonical: "/capital-flow/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "angrywork.com",
    title: "세상 돈의 흐름 보기",
    description: "SMH 중심 글로벌 자본 흐름 트리맵 대시보드",
    url: "/capital-flow/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen bg-terminal-bg">
          <header className="border-b border-terminal-border bg-terminal-panel/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terminal-muted">
                  Capital Flow Terminal
                </p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  세상 돈의 흐름 보기
                </h1>
              </div>
              <a
                href="/"
                className="rounded-md border border-terminal-border bg-black/30 px-3 py-1.5 text-sm text-terminal-muted transition hover:border-terminal-accent hover:text-terminal-text"
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
