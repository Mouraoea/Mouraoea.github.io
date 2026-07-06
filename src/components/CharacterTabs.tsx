import { useTranslation } from "react-i18next";
import type { PlayerRoster } from "../lib/player-storage.ts";
import { MAX_PLAYER_CHARACTERS } from "../lib/player-storage.ts";
import "./CharacterTabs.css";

interface CharacterTabsProps {
  roster: PlayerRoster;
  onSelect: (username: string) => void;
  onRemove: (username: string) => void;
}

export function CharacterTabs({
  roster,
  onSelect,
  onRemove,
}: CharacterTabsProps) {
  const { t } = useTranslation("common");

  if (roster.characters.length === 0) {
    return (
      <p className="character-tabs-empty">
        {t("characters.empty", { max: MAX_PLAYER_CHARACTERS })}
      </p>
    );
  }

  const freeSlots = MAX_PLAYER_CHARACTERS - roster.characters.length;

  return (
    <div className="character-tabs" role="tablist" aria-label={t("characters.ariaLabel")}>
      {roster.characters.map((character) => {
        const isActive = character.username === roster.activeUsername;
        return (
          <div key={character.username} className="character-tab-wrap">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              className={["character-tab", isActive ? "active" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(character.username)}
            >
              {character.username}
            </button>
            <button
              type="button"
              className="character-tab-remove"
              aria-label={t("characters.remove", { username: character.username })}
              title={t("characters.remove", { username: character.username })}
              onClick={() => onRemove(character.username)}
            >
              ×
            </button>
          </div>
        );
      })}
      {freeSlots > 0 && (
        <span className="character-tabs-hint">
          {t("characters.slotsFree", { count: freeSlots })}
        </span>
      )}
    </div>
  );
}
