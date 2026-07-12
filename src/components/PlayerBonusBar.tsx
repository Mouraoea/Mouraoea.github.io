import { Link } from "react-router-dom";
import { CharacterTabs } from "./CharacterTabs.tsx";
import { GearPresetTabs } from "./GearPresetTabs.tsx";
import type { PlayerBonusContext } from "../hooks/usePlayerBonusContext.ts";
import "./PlayerBonusBar.css";
import "./GearPresetTabs.css";

interface PlayerBonusBarProps {
  context: PlayerBonusContext;
  bonusSummaryKey?: string;
}

export function PlayerBonusBar({
  context,
  bonusSummaryKey = "profit:bonusSummary",
}: PlayerBonusBarProps) {
  const {
    t,
    roster,
    username,
    setUsername,
    playerBundle,
    gearSettings,
    playerLoading,
    playerError,
    hasPlayerBonuses,
    selectCharacter,
    removeCharacter,
    selectGearPreset,
    loadPlayer,
  } = context;

  return (
    <section className="card player-bonus-bar">
      <CharacterTabs
        roster={roster}
        onSelect={selectCharacter}
        onRemove={removeCharacter}
      />

      {playerBundle && (
        <GearPresetTabs
          activeIndex={gearSettings.activePresetIndex}
          onSelect={selectGearPreset}
        />
      )}

      <label className="field">
        {t("profit:player")}
        <input
          type="text"
          placeholder={t("profit:usernamePlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void loadPlayer();
            }
          }}
          disabled={playerLoading}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void loadPlayer()}
        disabled={playerLoading}
      >
        {playerLoading ? t("common:actions.loading") : t("common:actions.load")}
      </button>

      <Link
        to="/idleclans/player"
        className="btn btn-ghost player-bonus-gear-link"
        state={{ username: roster.activeUsername }}
      >
        {t("common:nav.gearLoadout")}
      </Link>

      {playerBundle && (
        <p className="player-bonus-status">
          <strong>{playerBundle.profile.username}</strong>
          {playerBundle.profile.guildName
            ? ` · ${playerBundle.profile.guildName}`
            : ` · ${t("profit:noClan")}`}
        </p>
      )}

      {playerError && (
        <p className="status-error player-bonus-error">{playerError}</p>
      )}

      {hasPlayerBonuses && (
        <p className="player-bonus-summary">
          {t(bonusSummaryKey, {
            manualGear: gearSettings.useManualGear
              ? t("profit:manualGearOn")
              : "",
            activeLoadout: gearSettings.useManualGear
              ? t("profit:activeLoadout", {
                  number: gearSettings.activePresetIndex + 1,
                })
              : "",
          })}
        </p>
      )}
    </section>
  );
}
