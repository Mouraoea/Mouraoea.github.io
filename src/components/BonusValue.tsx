import type { ReactNode } from "react";
import "./BonusValue.css";

interface BonusValueProps {
  modified: boolean;
  tooltip?: string | null;
  children: ReactNode;
}

export function BonusValue({ modified, tooltip, children }: BonusValueProps) {
  if (!modified) {
    return <>{children}</>;
  }

  return (
    <span className="recipe-bonus-modified" title={tooltip ?? undefined}>
      {children}
    </span>
  );
}
