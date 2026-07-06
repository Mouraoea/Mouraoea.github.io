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
  if (roster.characters.length === 0) {
    return (
      <p className="character-tabs-empty">
        No characters saved yet. Load a username below (up to{" "}
        {MAX_PLAYER_CHARACTERS}).
      </p>
    );
  }

  return (
    <div className="character-tabs" role="tablist" aria-label="Characters">
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
              aria-label={`Remove ${character.username}`}
              title={`Remove ${character.username}`}
              onClick={() => onRemove(character.username)}
            >
              ×
            </button>
          </div>
        );
      })}
      {roster.characters.length < MAX_PLAYER_CHARACTERS && (
        <span className="character-tabs-hint">
          {MAX_PLAYER_CHARACTERS - roster.characters.length} slot
          {MAX_PLAYER_CHARACTERS - roster.characters.length === 1 ? "" : "s"}{" "}
          free
        </span>
      )}
    </div>
  );
}
