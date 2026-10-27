import type { Metadata, Viewport } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

const nunito = Nunito({
  weight: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://playwebludo.vercel.app'),
  title: "PlayWebLudo — Play Together | Mobile First Browser Game",
  description: "Play classic Ludo 1v1 and 2v2 online or offline pass-and-play. Developed by istiak.tech",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/playweb-ludo-logo.png",
    shortcut: "/images/playweb-ludo-logo.png",
    apple: "/images/playweb-ludo-logo.png",
  },
  openGraph: {
    title: "PlayWebLudo — Play Together",
    description: "Play classic Ludo 1v1 and 2v2 online or offline pass-and-play. Developed by istiak.tech",
    url: "https://playwebludo.vercel.app",
    siteName: "PlayWebLudo",
    images: [
      {
        url: "/images/playweb-ludo-logo.png",
        width: 1536,
        height: 1024,
        alt: "PlayWebLudo Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PlayWebLudo — Play Together",
    description: "Play classic Ludo 1v1 and 2v2 online or offline pass-and-play. Developed by istiak.tech",
    images: ["/images/playweb-ludo-logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${nunito.variable} h-full antialiased`}>
      <body className="h-full w-full overflow-hidden bg-[#0F172A] text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
