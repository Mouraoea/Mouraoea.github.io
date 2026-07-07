import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CAPE_MAX_TIER,
  gearSkillsInOrder,
  SKILL_GEAR_BY_SLUG,
  TOOL_MAX_TIER,
} from "../bonuses/gear-definitions.ts";
import type { PlayerGearSettings, SkillGearLoadout } from "../bonuses/gear-settings.ts";
import {
  clampPresetIndex,
  createDefaultGearSettings,
  createMaxPreset,
  createMinPreset,
  getActivePreset,
} from "../bonuses/gear-settings.ts";
import {
  formatSkillBonusesSummary,
  resolveSkillBonuses,
} from "../bonuses/resolve-bonuses.ts";
import { CharacterTabs } from "../components/CharacterTabs.tsx";
import { GearPresetTabs } from "../components/GearPresetTabs.tsx";
import {
  formatToolTierOption,
  translateGearPieceLabel,
  translateGearToggleLabel,
  translateSkillSlug,
} from "../i18n/game-labels.ts";
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
import type { SkillSlug } from "../recipes/types.ts";
import "./PlayerSettingsPage.css";
import "../components/GearPresetTabs.css";

function tierOptions(maxTier: number): number[] {
  return Array.from({ length: maxTier + 1 }, (_, tier) => tier);
}

export function PlayerSettingsPage() {
  const { t } = useTranslation(["player", "common"]);
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

  const selectPreset = useCallback(
    (index: number) => {
      if (!activeUsername) return;
      persist({
        ...settings,
        activePresetIndex: clampPresetIndex(index),
      });
    },
    [activeUsername, persist, settings],
  );

  const updateLoadout = useCallback(
    (skill: SkillSlug, patch: Partial<SkillGearLoadout>) => {
      if (!activeUsername) return;
      const presetIndex = clampPresetIndex(settings.activePresetIndex);
      const activePreset = getActivePreset(settings);
      const nextPresets = [...settings.presets] as PlayerGearSettings["presets"];
      nextPresets[presetIndex] = {
        loadouts: {
          ...activePreset.loadouts,
          [skill]: {
            ...activePreset.loadouts[skill]!,
            ...patch,
          },
        },
      };
      persist({
        ...settings,
        useManualGear: true,
        presets: nextPresets,
      });
    },
    [activeUsername, persist, settings],
  );

  const setActivePresetToMin = useCallback(() => {
    if (!activeUsername) return;
    const presetIndex = clampPresetIndex(settings.activePresetIndex);
    const nextPresets = [...settings.presets] as PlayerGearSettings["presets"];
    nextPresets[presetIndex] = createMinPreset();
    persist({
      ...settings,
      useManualGear: true,
      presets: nextPresets,
    });
  }, [activeUsername, persist, settings]);

  const setActivePresetToMax = useCallback(() => {
    if (!activeUsername) return;
    const presetIndex = clampPresetIndex(settings.activePresetIndex);
    const nextPresets = [...settings.presets] as PlayerGearSettings["presets"];
    nextPresets[presetIndex] = createMaxPreset();
    persist({
      ...settings,
      useManualGear: true,
      presets: nextPresets,
    });
  }, [activeUsername, persist, settings]);

  const resetAllLoadouts = useCallback(() => {
    if (!activeUsername) return;
    persist(createDefaultGearSettings());
  }, [activeUsername, persist]);

  const activePresetLoadouts = getActivePreset(settings).loadouts;
  const skills = gearSkillsInOrder();
  const emDash = t("common:labels.emDash");

  return (
    <main className="page player-settings-page">
      <header className="page-header">
        <h1>{t("player:title")}</h1>
        <p
          className="page-subtitle"
          dangerouslySetInnerHTML={{ __html: t("player:subtitle") }}
        />
      </header>

      <nav className="page-nav-row">
        <Link to="/idleclans/profit">{t("common:nav.profitCalculatorBack")}</Link>
        {savedHint && <span className="player-settings-saved">{t("common:actions.saved")}</span>}
      </nav>

      <CharacterTabs
        roster={roster}
        onSelect={selectCharacter}
        onRemove={removeCharacter}
      />

      <GearPresetTabs
        activeIndex={settings.activePresetIndex}
        onSelect={selectPreset}
        disabled={!activeUsername}
      />

      {activeBundle ? (
        <p
          className="card card-info"
          dangerouslySetInnerHTML={{
            __html: t("player:editingFor", {
              username: activeBundle.profile.username,
              guild: activeBundle.profile.guildName
                ? t("player:guildSuffix", { guild: activeBundle.profile.guildName })
                : "",
            }),
          }}
        />
      ) : (
        <p className="card card-warning">
          {t("player:selectCharacter")}
        </p>
      )}

      <section className="control-bar player-settings-controls">
        <label className="field-toggle">
          <input
            type="checkbox"
            checked={settings.useManualGear}
            disabled={!activeUsername}
            onChange={(e) =>
              persist({ ...settings, useManualGear: e.target.checked })
            }
          />
          {t("player:useManualGear")}
        </label>
        <button type="button" className="btn" onClick={setActivePresetToMin} disabled={!activeUsername}>
          {t("player:actions.setAllToNone")}
        </button>
        <button type="button" className="btn" onClick={setActivePresetToMax} disabled={!activeUsername}>
          {t("player:actions.setAllToMax")}
        </button>
        <button type="button" className="btn" onClick={resetAllLoadouts} disabled={!activeUsername}>
          {t("player:actions.resetAllLoadouts")}
        </button>
      </section>

      <div className="table-wrap">
        <table className="data-table player-settings-table">
          <thead>
            <tr>
              <th>{t("player:table.skill")}</th>
              <th>{t("player:table.skillingSet")}</th>
              <th>{t("player:table.gloves")}</th>
              <th>{t("player:table.toolTier")}</th>
              <th>{t("player:table.capeTier")}</th>
              <th>{t("player:table.jewelryEnchant")}</th>
              <th>{t("player:table.bonuses")}</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const definition = SKILL_GEAR_BY_SLUG.get(skill)!;
              const loadout = activePresetLoadouts[skill]!;
              const preview = resolveSkillBonuses(
                skill,
                null,
                null,
                null,
                settings.useManualGear && activeUsername ? settings : null,
              );
              const skillLabel = translateSkillSlug(skill);

              return (
                <tr key={skill}>
                  <td>{skillLabel}</td>
                  <td>
                    {definition.skillingSetPieces ? (
                      <div className="player-settings-set-pieces">
                        {definition.skillingSetPieces.map((piece) => {
                          const pieceLabel = translateGearPieceLabel(skill, piece.id);
                          return (
                            <label
                              key={piece.id}
                              className="player-settings-check"
                              title={pieceLabel}
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
                              {pieceLabel}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      emDash
                    )}
                  </td>
                  <td>
                    {definition.gloves ? (
                      <label
                        className="player-settings-check"
                        title={translateGearToggleLabel(skill, "gloves")}
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
                        {translateGearToggleLabel(skill, "gloves")}
                      </label>
                    ) : (
                      emDash
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
                        aria-label={t("player:toolTierAria", {
                          tool: translateGearToggleLabel(skill, "tool"),
                          skill: skillLabel,
                        })}
                      >
                        {tierOptions(TOOL_MAX_TIER).map((tier) => (
                          <option key={tier} value={tier}>
                            {formatToolTierOption(
                              tier,
                              translateGearToggleLabel(skill, "tool"),
                            )}
                          </option>
                        ))}
                      </select>
                    ) : (
                      emDash
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
                        aria-label={t("player:capeTierAria", {
                          cape: translateGearToggleLabel(skill, "cape"),
                          skill: skillLabel,
                        })}
                      >
                        {tierOptions(CAPE_MAX_TIER).map((tier) => (
                          <option key={tier} value={tier}>
                            {tier === 0
                              ? t("common:labels.none")
                              : t("player:capeTierOption", {
                                  tier,
                                  cape: translateGearToggleLabel(skill, "cape"),
                                })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      emDash
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="player-settings-enchant-input"
                      placeholder={t("player:jewelryEnchantPlaceholder")}
                      value={loadout.jewelryEnchantmentSpeed}
                      disabled={!settings.useManualGear || !activeUsername}
                      onChange={(e) =>
                        updateLoadout(skill, {
                          jewelryEnchantmentSpeed: e.target.value,
                        })
                      }
                      aria-label={t("player:jewelryEnchantAria", {
                        skill: skillLabel,
                      })}
                      title={t("player:jewelryEnchantTitle")}
                    />
                  </td>
                  <td className="player-settings-bonuses">
                    {settings.useManualGear && activeUsername
                      ? formatSkillBonusesSummary(preview)
                      : emDash}
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
