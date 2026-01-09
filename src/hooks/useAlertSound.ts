import { useCallback, useEffect, useRef } from 'react';
import { ALERT_SOUND_LEVELS, ALERT_SOUND_MIN_LEVEL, ALERT_SOUND_WINDOW_MS } from '../config/appRuntime';
import { EVENT_LEVEL_SOUNDS } from '../constants';
import type { EventLevels } from '../types';

type UseAlertSoundOptions = {
  isMuted: boolean;
};

export const useAlertSound = ({ isMuted }: UseAlertSoundOptions) => {
  const alertSoundsRef = useRef<Partial<Record<EventLevels, HTMLAudioElement>> | null>(null);
  const alertCooldownTimerRef = useRef<number | null>(null);
  const pendingAlertLevelRef = useRef<EventLevels | null>(null);

  const prepareAlertSounds = useCallback(() => {
    if (alertSoundsRef.current) {
      return;
    }
    const sounds: Partial<Record<EventLevels, HTMLAudioElement>> = {};
    for (let i = 0; i < ALERT_SOUND_LEVELS.length; i += 1) {
      const level = ALERT_SOUND_LEVELS[i];
      const source = EVENT_LEVEL_SOUNDS[level];
      if (!source) {
        continue;
      }
      const audio = new Audio(source);
      audio.preload = 'auto';
      sounds[level] = audio;
    }
    alertSoundsRef.current = sounds;
  }, []);

  const playAlertSound = useCallback(
    (level: EventLevels) => {
      if (isMuted) {
        return;
      }
      prepareAlertSounds();
      const audio = alertSoundsRef.current?.[level];
      if (!audio) {
        return;
      }
      audio.currentTime = 0;
      void audio.play().catch((error: unknown) => {
        console.warn('알림음을 재생하지 못했습니다.', error);
      });
    },
    [isMuted, prepareAlertSounds],
  );

  const scheduleAlertWindow = useCallback(() => {
    if (alertCooldownTimerRef.current) {
      return;
    }
    alertCooldownTimerRef.current = window.setTimeout(() => {
      alertCooldownTimerRef.current = null;
      const pendingLevel = pendingAlertLevelRef.current;
      pendingAlertLevelRef.current = null;
      if (pendingLevel != null) {
        playAlertSound(pendingLevel);
      }
    }, ALERT_SOUND_WINDOW_MS);
  }, [playAlertSound]);

  const handleAlertLevel = useCallback(
    (level: EventLevels) => {
      if (level < ALERT_SOUND_MIN_LEVEL) {
        return;
      }
      const pendingLevel = pendingAlertLevelRef.current;
      if (pendingLevel == null || level > pendingLevel) {
        pendingAlertLevelRef.current = level;
      }
      scheduleAlertWindow();
    },
    [scheduleAlertWindow],
  );

  useEffect(() => {
    return () => {
      if (alertCooldownTimerRef.current) {
        window.clearTimeout(alertCooldownTimerRef.current);
      }
    };
  }, []);

  return { handleAlertLevel };
};
