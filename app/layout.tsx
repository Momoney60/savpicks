import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SavPicks — Private Playoff Pool",
  description: "The private fantasy hockey pool with streak multipliers, live props, and the best rail chat in the game.",
  appleWebApp: {
    capable: true,
    title: "SavPicks",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-ink-900 text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}
