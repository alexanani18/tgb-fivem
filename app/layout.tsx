import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),

  title: {
    default: "The Gentleman Blackfold",
    template: "%s | The Gentleman Blackfold",
  },

  description:
    "Platforma internă The Gentleman Blackfold pentru administrarea angajaților, contractelor, notificărilor, pontajelor și activităților organizației.",

  applicationName: "The Gentleman Blackfold",

  authors: [
    {
      name: "The Gentleman Blackfold",
    },
  ],

  creator: "The Gentleman Blackfold",
  publisher: "The Gentleman Blackfold",

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "The Gentleman Blackfold",
    title: "The Gentleman Blackfold",
    description: "Platforma internă de management The Gentleman Blackfold.",
    images: [
      {
        url: "/img/tgb-og.png",
        width: 1200,
        height: 630,
        alt: "The Gentleman Blackfold",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "The Gentleman Blackfold",
    description: "Platforma internă de management The Gentleman Blackfold.",
    images: ["/img/tgb-og.png"],
  },

  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },

  category: "management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
