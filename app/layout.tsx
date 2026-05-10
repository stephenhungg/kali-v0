import type { Metadata } from "next";
import {
  Geist_Mono,
  Inter,
  Bagel_Fat_One,
  Instrument_Serif,
  Nunito,
  Noto_Serif_JP,
  Plus_Jakarta_Sans,
  Quicksand,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-swiss",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const bagelFatOne = Bagel_Fat_One({
  variable: "--font-bagel",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic", "normal"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-subtext",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono-geist",
  subsets: ["latin"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/** Rounded display for dashboard / chat / onboarding kawaii surfaces */
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const SITE_URL = "https://kalilabs.ai";
const SITE_NAME = "Kali";
const SITE_TAGLINE = "The agentic context layer for nonprofits";
const SITE_DESCRIPTION =
  "Kali is the agentic context layer for nonprofits. Ask anything across your CRM, drive, inbox, and calendar — get a single cited answer, with every write held until you approve it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "nonprofit AI",
    "agentic AI",
    "context layer",
    "nonprofit software",
    "donor CRM AI",
    "grant research AI",
    "volunteer operations",
    "Salesforce nonprofit",
    "Google Drive nonprofit",
    "AI for nonprofits",
    "cited answers",
    "human-in-the-loop AI",
    "nonprofit automation",
    "Kali Labs",
    "kalilabs.ai",
  ],
  authors: [
    { name: "Kali Labs", url: SITE_URL },
    { name: "Stephen Hung" },
  ],
  creator: "Kali Labs",
  publisher: "Kali Labs",
  category: "Productivity",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/kawaii/app-icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/kawaii/app-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/kawaii/app-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kali — the agentic context layer for nonprofits. Cited answers across every tool you run on, with human-approved writes.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@kalilabs",
    site: "@kalilabs",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "theme-color": "#FFFDF6",
    "color-scheme": "light",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFDF6" },
    { media: "(prefers-color-scheme: dark)", color: "#204C37" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kali Labs",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/kawaii/logo-sticker.png`,
        width: 1842,
        height: 706,
      },
      description: SITE_DESCRIPTION,
      foundingDate: "2026",
      founder: { "@type": "Person", name: "Stephen Hung" },
      email: "founders@kalilabs.ai",
      sameAs: [
        "https://github.com/stephenhungg/kali-v0",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      creator: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "Cited answers across every connected tool",
        "Parallel agentic tool calls",
        "Human-in-the-loop writes",
        "Salesforce, Drive, Gmail, Calendar, Slack integrations",
        "Donor reactivation",
        "Grant research",
        "Volunteer operations",
      ],
      audience: {
        "@type": "Audience",
        audienceType: "Nonprofit organizations",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} ${bagelFatOne.variable} ${instrumentSerif.variable} ${nunito.variable} ${geistMono.variable} ${notoSerifJP.variable} ${quicksand.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
