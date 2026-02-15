import type { Metadata } from "next";
import {
  Noto_Sans_JP,
  Shippori_Mincho,
  Cinzel,
  Playfair_Display,
  Crimson_Text,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavbarWrapper } from "@/components/organisms/NavbarWrapper";

// フォント設定
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "optional",
});

const shipporiMincho = Shippori_Mincho({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-shippori-mincho",
  display: "optional",
});

const cinzel = Cinzel({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "optional",
});

// Dark Academia追加フォント
const playfairDisplay = Playfair_Display({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "optional",
});

const crimsonText = Crimson_Text({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-crimson",
  display: "optional",
});

export const metadata: Metadata = {
  title: "MisteryMesh - The Infinite Mystery Library",
  description: "AI×人間が織りなす、無限のマーダーミステリー図書館",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${shipporiMincho.variable} ${cinzel.variable} ${playfairDisplay.variable} ${crimsonText.variable} font-sans antialiased bg-primary text-primary-foreground`}
      >
        <Providers>
          <NavbarWrapper />
          {children}
        </Providers>
      </body>
    </html>
  );
}
