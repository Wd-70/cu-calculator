import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UserInitializer from "@/components/UserInitializer";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cu-calc.app'),
  title: {
    default: "CU 할인계산기 - 편의점 할인 최적화 계산기",
    template: "%s | CU 할인계산기"
  },
  description: "CU 편의점의 1+1, 2+1, 쿠폰, 카드할인, 통신사할인을 자동으로 계산하고 최적의 조합을 찾아드립니다. AI 기반 할인 최적화로 똑똑한 쇼핑을 시작하세요.",
  keywords: ["CU", "편의점", "할인계산기", "1+1", "2+1", "쿠폰", "카드할인", "통신사할인", "할인조합", "절약", "편의점할인"],
  authors: [{ name: "CU 할인계산기" }],
  creator: "CU 할인계산기",
  publisher: "CU 할인계산기",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://cu-calc.app",
    siteName: "CU 할인계산기",
    title: "CU 할인계산기 - 편의점 할인 최적화",
    description: "1+1, 2+1, 쿠폰, 카드할인까지 복잡한 할인 조합을 자동으로 계산하고 최적의 조합을 찾아드립니다.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CU 할인계산기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CU 할인계산기 - 편의점 할인 최적화",
    description: "1+1, 2+1, 쿠폰, 카드할인까지 복잡한 할인 조합을 자동으로 계산",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // 나중에 Google Search Console, Naver 등록 후 추가
    // google: 'verification-code',
    // other: 'verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7C3FBF" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserInitializer />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
