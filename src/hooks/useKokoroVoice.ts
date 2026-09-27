'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  type KokoroVoice,
  KOKORO_VOICES,
  getSavedVoice as getLocalVoice,
  saveVoice as saveLocalVoice,
  getDefaultVoiceForLanguage,
  isKokoroSupportedLanguage,
} from '@/lib/kokoroTTS';

type KokoroLanguageCode = 'ja' | 'zh' | 'es' | 'fr' | 'hi' | 'it' | 'pt' | 'en';

/**
 * Hook for managing Kokoro voice preferences per language
 * - Uses Convex when logged in
 * - Falls back to localStorage when logged out
 * - Syncs localStorage to Convex on login
 */
export function useKokoroVoice(targetLanguage?: string) {
  const [voice, setVoiceState] = useState<KokoroVoice>(
    getDefaultVoiceForLanguage(targetLanguage || 'en')
  );
  const [isLoading, setIsLoading] = useState(true);

  // Convex queries and mutations
  // Skip the settings query while logged out; getSettings requires auth.
  const currentUser = useQuery(api.auth.getCurrentUser);
  const settingsResult = useQuery(
    api.settings.getSettings,
    currentUser ? {} : 'skip'
  );
  // null = logged out, undefined = still loading
  const settings = currentUser === null ? null : settingsResult;
  const updateKokoroVoice = useMutation(api.settings.updateKokoroVoice);

  // Check if user is logged in (settings query returns data, not undefined)
  const isLoggedIn = settings !== undefined && settings !== null;

  // Get the correct language code for voice preferences
  const langCode = (targetLanguage || 'en') as KokoroLanguageCode;

  // Check if language is supported by Kokoro
  const isSupported = targetLanguage ? isKokoroSupportedLanguage(targetLanguage) : true;

  // Get convex voice for this language
  const convexVoices = settings?.kokoroVoices as Record<string, string> | undefined;
  const convexVoice = convexVoices?.[langCode] as KokoroVoice | undefined;

  // Initialize voice from appropriate source
  useEffect(() => {
    if (settings === undefined) {
      // Still loading from Convex, use localStorage for now
      const localVoice = getLocalVoice(langCode);
      setVoiceState(localVoice);
      return;
    }

    setIsLoading(false);

    if (settings === null) {
      // Not logged in, use localStorage
      const localVoice = getLocalVoice(langCode);
      setVoiceState(localVoice);
    } else {
      // Logged in
      if (convexVoice && KOKORO_VOICES.some((v) => v.id === convexVoice)) {
        // Use Convex voice
        setVoiceState(convexVoice);
        // Also save to localStorage for offline access
        saveLocalVoice(convexVoice, langCode);
      } else {
        // No voice in Convex for this language, sync from localStorage
        const localVoice = getLocalVoice(langCode);
        setVoiceState(localVoice);
        // Sync localStorage voice to Convex
        updateKokoroVoice({ language: langCode, voice: localVoice }).catch((err) =>
          console.warn('Failed to sync voice to Convex:', err)
        );
      }
    }
  }, [settings, convexVoice, langCode, updateKokoroVoice]);

  // Save voice preference
  const setVoice = useCallback(
    async (newVoice: KokoroVoice) => {
      // Validate voice
      if (!KOKORO_VOICES.some((v) => v.id === newVoice)) {
        console.warn('Invalid voice:', newVoice);
        return;
      }

      // Update local state immediately
      setVoiceState(newVoice);

      // Always save to localStorage (for offline access)
      saveLocalVoice(newVoice, langCode);

      // If logged in, also save to Convex
      if (isLoggedIn) {
        try {
          await updateKokoroVoice({ language: langCode, voice: newVoice });
        } catch (err) {
          console.warn('Failed to save voice to Convex:', err);
        }
      }
    },
    [isLoggedIn, langCode, updateKokoroVoice]
  );

  return {
    voice,
    setVoice,
    isLoading,
    isLoggedIn,
    isSupported,
    targetLanguage: langCode,
  };
}
