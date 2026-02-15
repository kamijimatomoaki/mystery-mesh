"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";

/**
 * NavbarWrapper
 * ゲームプレイ画面（/game/[gameId] 等）ではNavbarを非表示にし、没入感を維持
 * /game/join などのユーティリティページでは表示
 */
export function NavbarWrapper() {
  const pathname = usePathname();
  const isGamePlayPage =
    pathname.startsWith("/game/") && !pathname.startsWith("/game/join");

  if (isGamePlayPage) return null;

  return <Navbar />;
}
