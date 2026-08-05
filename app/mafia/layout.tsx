import type { ReactNode } from "react";

import AppShell from "../components/AppShell";

interface MafiaLayoutProps {
  children: ReactNode;
}

export default function MafiaLayout({ children }: MafiaLayoutProps) {
  return <AppShell backgroundImage="/img/mafia-image.png">{children}</AppShell>;
}
