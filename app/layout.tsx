import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PDFer",
  description: "Split and combine PDF pages in the browser.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fsi.css" />
        <link rel="stylesheet" href="/app-override.css" />
      </head>
      <body>
        <Script src="/theme.js" strategy="beforeInteractive" />
        {children}
        <Script src="/navbar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
