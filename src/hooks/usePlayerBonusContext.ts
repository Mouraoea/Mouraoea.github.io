import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlayerGearSettings } from "../bonuses/gear-settings.ts";
import { clampPresetIndex } from "../bonuses/gear-settings.ts";
import type { UpgradeCatalog } from "../bonuses/types.ts";
import { loadUpgradeCatalog } from "../bonuses/upgrade-catalog.ts";
import { translateApiError } from "../i18n/game-labels.ts";
import { fetchPlayerBundle } from "../lib/player-api.ts";
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
  upsertPlayerCharacter,
} from "../lib/player-storage.ts";
import type { PlayerRoster } from "../lib/player-storage.ts";

export function usePlayerBonusContext() {
  const { t } = useTranslation(["profit", "common"]);

  const [roster, setRoster] = useState<PlayerRoster>(() => loadPlayerRoster());
  const [username, setUsername] = useState("");
  const playerBundle = useMemo(
    () => getActivePlayerBundle(roster),
    [roster],
  );
  const [upgradeCatalog, setUpgradeCatalog] = useState<UpgradeCatalog | null>(
    null,
  );
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [gearSettings, setGearSettings] = useState<PlayerGearSettings>(() =>
    loadPlayerGearSettings(loadPlayerRoster().activeUsername),
  );

  const hasPlayerBonuses = Boolean(playerBundle) || gearSettings.useManualGear;

  useEffect(() => {
    const initialRoster = loadPlayerRoster();
    setRoster(initialRoster);
    const active = getActivePlayerBundle(initialRoster);
    if (active) {
      setUsername(active.username);
      setGearSettings(loadPlayerGearSettings(active.username));
    }

    void loadUpgradeCatalog()
      .then(setUpgradeCatalog)
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setPlayerError(translateApiError(message));
      });

    const refreshGearSettings = () => {
      const current = loadPlayerRoster();
      setGearSettings(loadPlayerGearSettings(current.activeUsername));
    };

    refreshGearSettings();
    window.addEventListener("focus", refreshGearSettings);
    return () => window.removeEventListener("focus", refreshGearSettings);
  }, []);

  const selectCharacter = useCallback((name: string) => {
    const next = setActivePlayerCharacter(name);
    setRoster(next);
    setUsername(name);
    setGearSettings(loadPlayerGearSettings(name));
    setPlayerError(null);
  }, []);

  const selectGearPreset = useCallback(
    (index: number) => {
      const activeUsername = roster.activeUsername;
      if (!activeUsername) return;

      const nextSettings: PlayerGearSettings = {
        ...gearSettings,
        activePresetIndex: clampPresetIndex(index),
      };
      setGearSettings(nextSettings);
      savePlayerGearSettings(activeUsername, nextSettings);
    },
    [gearSettings, roster.activeUsername],
  );

  const removeCharacter = useCallback((name: string) => {
    removePlayerGearSettings(name);
    const next = removePlayerCharacter(name);
    setRoster(next);
    const active = getActivePlayerBundle(next);
    setUsername(active?.username ?? "");
    setGearSettings(loadPlayerGearSettings(active?.username ?? null));
    setPlayerError(null);
  }, []);

  const loadPlayer = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setPlayerError(t("common:errors.usernameRequired"));
      return;
    }

    setPlayerLoading(true);
    setPlayerError(null);
    try {
      const bundle = await fetchPlayerBundle(trimmed);
      const next = upsertPlayerCharacter(bundle);
      setRoster(next);
      setUsername(bundle.username);
      setGearSettings(loadPlayerGearSettings(bundle.username));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlayerError(translateApiError(message));
    } finally {
      setPlayerLoading(false);
    }
  }, [username, t]);

  return {
    t,
    roster,
    username,
    setUsername,
    playerBundle,
    upgradeCatalog,
    gearSettings,
    playerLoading,
    playerError,
    hasPlayerBonuses,
    selectCharacter,
    removeCharacter,
    selectGearPreset,
    loadPlayer,
  };
}

export type PlayerBonusContext = ReturnType<typeof usePlayerBonusContext>;
