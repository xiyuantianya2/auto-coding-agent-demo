import type { ReactNode } from "react";

import { GameGate } from "@/app/game/game-gate";

export default function GameLayout({ children }: { children: ReactNode }) {
  return <GameGate>{children}</GameGate>;
}
