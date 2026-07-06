import { useTranslation } from "react-i18next";
import { MAX_GEAR_PRESETS } from "../bonuses/gear-settings.ts";
import "./GearPresetTabs.css";

interface GearPresetTabsProps {
  activeIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function GearPresetTabs({
  activeIndex,
  onSelect,
  disabled = false,
}: GearPresetTabsProps) {
  const { t } = useTranslation("player");

  return (
    <div
      className="gear-preset-tabs"
      role="tablist"
      aria-label={t("loadoutTabs.ariaLabel")}
    >
      {Array.from({ length: MAX_GEAR_PRESETS }, (_, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={["gear-preset-tab", isActive ? "active" : ""]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
            onClick={() => onSelect(index)}
          >
            {t("loadoutTabs.loadout", { number: index + 1 })}
          </button>
        );
      })}
    </div>
  );
}
