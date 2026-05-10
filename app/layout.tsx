import type { Metadata } from "next";
import { Geist_Mono, Inter, Instrument_Sans, Inria_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inriaSerif = Inria_Serif({
  variable: "--font-italic",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["italic", "normal"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kali — agentic context layer for nonprofits",
  description:
    "One chat across eleven SaaS tools. Ask anything in plain English, get answers with citations. v1 prototype for HackDavis 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSans.variable} ${inriaSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
