import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourtRao",
  description: "View and update the tennis courts reserved by our group.",
  applicationName: "CourtRao",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "CourtRao",
    description: "View the group's weekly reserved tennis courts.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#198754" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1612" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
