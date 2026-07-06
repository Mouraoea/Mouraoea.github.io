import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CAPE_MAX_TIER,
  formatToolTierOption,
  gearSkillsInOrder,
  SKILL_GEAR_BY_SLUG,
  TOOL_MAX_TIER,
} from "../bonuses/gear-definitions.ts";
import type { PlayerGearSettings, SkillGearLoadout } from "../bonuses/gear-settings.ts";
import { createDefaultGearSettings } from "../bonuses/gear-settings.ts";
import {
  formatSkillBonusesSummary,
  resolveSkillBonuses,
} from "../bonuses/resolve-bonuses.ts";
import { CharacterTabs } from "../components/CharacterTabs.tsx";
import {
  loadPlayerGearSettings,
  removePlayerGearSettings,
  savePlayerGearSettings,
} from "../lib/player-gear-storage.ts";
import {
  getActivePlayerBundle,
  loadPlayerRoster,
  removePlayerCharacter,
  setActivePlayerCharacter,
} from "../lib/player-storage.ts";
import type { PlayerRoster } from "../lib/player-storage.ts";
import { formatSkillLabel } from "../recipes/skills.ts";
import type { SkillSlug } from "../recipes/types.ts";
import "./PlayerSettingsPage.css";
import "./RecipesPage.css";

function tierOptions(maxTier: number): number[] {
  return Array.from({ length: maxTier + 1 }, (_, tier) => tier);
}

export function PlayerSettingsPage() {
  const location = useLocation();
  const routedUsername =
    typeof location.state === "object" &&
    location.state !== null &&
    "username" in location.state &&
    typeof (location.state as { username?: unknown }).username === "string"
      ? (location.state as { username: string }).username
      : null;

  const [roster, setRoster] = useState<PlayerRoster>(() => loadPlayerRoster());
  const activeUsername = roster.activeUsername;
  const activeBundle = useMemo(
    () => getActivePlayerBundle(roster),
    [roster],
  );

  const [settings, setSettings] = useState<PlayerGearSettings>(
    createDefaultGearSettings,
  );
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    const loaded = loadPlayerRoster();
    if (routedUsername) {
      const next = loaded.characters.some((c) => c.username === routedUsername)
        ? setActivePlayerCharacter(routedUsername)
        : loaded;
      setRoster(next);
      setSettings(loadPlayerGearSettings(next.activeUsername));
      return;
    }
    setRoster(loaded);
    setSettings(loadPlayerGearSettings(loaded.activeUsername));
  }, [routedUsername]);

  const persist = useCallback(
    (next: PlayerGearSettings, username = activeUsername) => {
      if (!username) return;
      setSettings(next);
      savePlayerGearSettings(username, next);
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 1500);
    },
    [activeUsername],
  );

  const selectCharacter = useCallback(
    (username: string) => {
      if (activeUsername) {
        savePlayerGearSettings(activeUsername, settings);
      }
      const next = setActivePlayerCharacter(username);
      setRoster(next);
      setSettings(loadPlayerGearSettings(username));
    },
    [activeUsername, settings],
  );

  const removeCharacter = useCallback(
    (username: string) => {
      if (activeUsername && activeUsername !== username) {
        savePlayerGearSettings(activeUsername, settings);
      }
      removePlayerGearSettings(username);
      const next = removePlayerCharacter(username);
      setRoster(next);
      setSettings(loadPlayerGearSettings(next.activeUsername));
    },
    [activeUsername, settings],
  );

  const updateLoadout = useCallback(
    (skill: SkillSlug, patch: Partial<SkillGearLoadout>) => {
      if (!activeUsername) return;
      persist({
        ...settings,
        useManualGear: true,
        loadouts: {
          ...settings.loadouts,
          [skill]: {
            ...settings.loadouts[skill],
            ...patch,
          },
        },
      });
    },
    [activeUsername, persist, settings],
  );

  const resetAll = useCallback(() => {
    if (!activeUsername) return;
    persist(createDefaultGearSettings());
  }, [activeUsername, persist]);

  const skills = gearSkillsInOrder();

  return (
    <main className="recipes-page player-settings-page">
      <header className="recipes-header">
        <h1>Player gear loadout</h1>
        <p className="recipes-subtitle">
          Configure skilling gear per character and skill. Saved in{" "}
          <code>localStorage</code> (up to 3 characters).
        </p>
      </header>

      <nav className="player-settings-nav">
        <Link to="/idleclans/profit">← Profit calculator</Link>
        {savedHint && <span className="player-settings-saved">Saved</span>}
      </nav>

      <CharacterTabs
        roster={roster}
        onSelect={selectCharacter}
        onRemove={removeCharacter}
      />

      {activeBundle ? (
        <p className="player-settings-player">
          Editing gear for <strong>{activeBundle.profile.username}</strong>
          {activeBundle.profile.guildName
            ? ` (${activeBundle.profile.guildName})`
            : ""}
          . Upgrades come from the loaded profile; gear is set manually below.
        </p>
      ) : (
        <p className="player-settings-player player-settings-player-empty">
          Select a character tab or load a username from the profit calculator
          first.
        </p>
      )}

      <section className="player-settings-controls">
        <label className="player-settings-toggle">
          <input
            type="checkbox"
            checked={settings.useManualGear}
            disabled={!activeUsername}
            onChange={(e) =>
              persist({ ...settings, useManualGear: e.target.checked })
            }
          />
          Use manual gear loadout in profit calculator
        </label>
        <button type="button" onClick={resetAll} disabled={!activeUsername}>
          Reset all
        </button>
      </section>

      <div className="recipes-table-wrap">
        <table className="recipes-table player-settings-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Skilling set</th>
              <th>Gloves</th>
              <th>Tool tier</th>
              <th>Cape tier</th>
              <th>Jewelry enchant</th>
              <th>Bonuses</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const definition = SKILL_GEAR_BY_SLUG.get(skill)!;
              const loadout = settings.loadouts[skill];
              const preview = resolveSkillBonuses(
                skill,
                null,
                null,
                null,
                settings.useManualGear && activeUsername ? settings : null,
              );

              return (
                <tr key={skill}>
                  <td>{formatSkillLabel(skill)}</td>
                  <td>
                    {definition.skillingSetPieces ? (
                      <div className="player-settings-set-pieces">
                        {definition.skillingSetPieces.map((piece) => (
                          <label
                            key={piece.id}
                            className="player-settings-check"
                            title={piece.label}
                          >
                            <input
                              type="checkbox"
                              checked={loadout.setPieces[piece.id]}
                              disabled={
                                !settings.useManualGear || !activeUsername
                              }
                              onChange={(e) =>
                                updateLoadout(skill, {
                                  setPieces: {
                                    ...loadout.setPieces,
                                    [piece.id]: e.target.checked,
                                  },
                                })
                              }
                            />
                            {piece.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {definition.gloves ? (
                      <label
                        className="player-settings-check"
                        title={definition.gloves.label}
                      >
                        <input
                          type="checkbox"
                          checked={loadout.gloves}
                          disabled={
                            !settings.useManualGear || !activeUsername
                          }
                          onChange={(e) =>
                            updateLoadout(skill, { gloves: e.target.checked })
                          }
                        />
                        {definition.gloves.label}
                      </label>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {definition.tool ? (
                      <select
                        value={loadout.toolTier}
                        disabled={!settings.useManualGear || !activeUsername}
                        onChange={(e) =>
                          updateLoadout(skill, {
                            toolTier: Number(e.target.value),
                          })
                        }
                        aria-label={`${definition.tool.label} tier for ${formatSkillLabel(skill)}`}
                      >
                        {tierOptions(TOOL_MAX_TIER).map((tier) => (
                          <option key={tier} value={tier}>
                            {formatToolTierOption(tier, definition.tool!.label)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {definition.cape ? (
                      <select
                        value={loadout.capeTier}
                        disabled={!settings.useManualGear || !activeUsername}
                        onChange={(e) =>
                          updateLoadout(skill, {
                            capeTier: Number(e.target.value),
                          })
                        }
                        aria-label={`${definition.cape.label} tier for ${formatSkillLabel(skill)}`}
                      >
                        {tierOptions(CAPE_MAX_TIER).map((tier) => (
                          <option key={tier} value={tier}>
                            {tier === 0
                              ? "None"
                              : `Tier ${tier} (${definition.cape!.label})`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="player-settings-enchant-input"
                      placeholder="0–20%"
                      value={loadout.jewelryEnchantmentSpeed}
                      disabled={!settings.useManualGear || !activeUsername}
                      onChange={(e) =>
                        updateLoadout(skill, {
                          jewelryEnchantmentSpeed: e.target.value,
                        })
                      }
                      aria-label={`Jewelry enchantment speed for ${formatSkillLabel(skill)}`}
                      title="Speed bonus from jewelry enchantment (0–20%)"
                    />
                  </td>
                  <td className="player-settings-bonuses">
                    {settings.useManualGear && activeUsername
                      ? formatSkillBonusesSummary(preview)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
