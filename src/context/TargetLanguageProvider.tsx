/**
 * TargetLanguageProvider
 * Provides global state for the target language being learned
 * All components consuming useTargetLanguage will re-render when language changes
 *
 * Now integrates with LanguageConfigProvider for dynamic configuration.
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  LanguageCode,
  LanguageConfig,
  LanguageLevel,
  ModuleName,
  getLanguageConfig as getStaticLanguageConfig,
  getDefaultLanguage as getStaticDefaultLanguage,
  getAvailableLanguages as getStaticAvailableLanguages,
  isModuleAvailable as staticIsModuleAvailable,
  getAvailableModules as staticGetAvailableModules,
  getLanguageLevels as staticGetLanguageLevels,
  getLanguageDataPath as staticGetLanguageDataPath,
  requiresScriptLearning as staticRequiresScriptLearning,
  getTTSVoices as staticGetTTSVoices,
  isLanguageAvailable as staticIsLanguageAvailable,
} from '@/lib/language';
import { useLanguageConfigs } from './LanguageConfigProvider';
import { useSettings } from './SettingsProvider';
import { TARGET_LANGUAGE_STORAGE_KEY } from '@/constants';

const TARGET_LANGUAGE_KEY = TARGET_LANGUAGE_STORAGE_KEY;

export interface TargetLanguageContextType {
  // Current state
  targetLanguage: LanguageCode;
  languageConfig: LanguageConfig | null;
  isLoading: boolean;

  // Language switching
  setTargetLanguage: (code: LanguageCode) => void;

  // Configuration helpers
  availableLanguages: LanguageCode[];
  availableModules: ModuleName[];
  levels: LanguageLevel[];
  dataPath: string;

  // Utility functions
  isModuleEnabled: (module: ModuleName) => boolean;
  needsScriptLearning: boolean;
  ttsVoice: string;

  // Data fetching helper
  getDataUrl: (filename: string) => string;
}

const TargetLanguageContext = createContext<TargetLanguageContextType | null>(null);

interface TargetLanguageProviderProps {
  children: ReactNode;
}

export function TargetLanguageProvider({ children }: TargetLanguageProviderProps) {
  const { settings } = useSettings();
  const { configs: dynamicConfigs, isLoading: configsLoading } = useLanguageConfigs();

  // Helper functions that use dynamic config with fallback to static
  const getLanguageConfig = useCallback((code: LanguageCode): LanguageConfig | null => {
    return dynamicConfigs.languages[code] || getStaticLanguageConfig(code);
  }, [dynamicConfigs.languages]);

  const getDefaultLanguage = useCallback((): LanguageCode => {
    return dynamicConfigs.defaultLanguage || getStaticDefaultLanguage();
  }, [dynamicConfigs.defaultLanguage]);

  const getAvailableLanguages = useCallback((): LanguageCode[] => {
    return dynamicConfigs.availableLanguages.length > 0
      ? dynamicConfigs.availableLanguages
      : getStaticAvailableLanguages();
  }, [dynamicConfigs.availableLanguages]);

  const isLanguageAvailable = useCallback((code: string): boolean => {
    return dynamicConfigs.availableLanguages.includes(code) || staticIsLanguageAvailable(code);
  }, [dynamicConfigs.availableLanguages]);

  const isModuleAvailable = useCallback((languageCode: LanguageCode, module: ModuleName): boolean => {
    const config = getLanguageConfig(languageCode);
    if (config) return config.modules[module];
    return staticIsModuleAvailable(languageCode, module);
  }, [getLanguageConfig]);

  const getAvailableModules = useCallback((languageCode: LanguageCode): ModuleName[] => {
    const config = getLanguageConfig(languageCode);
    if (config) {
      const modules: ModuleName[] = [];
      (Object.entries(config.modules) as [ModuleName, boolean][]).forEach(([module, available]) => {
        if (available) modules.push(module);
      });
      return modules;
    }
    return staticGetAvailableModules(languageCode);
  }, [getLanguageConfig]);

  const getLanguageLevels = useCallback((languageCode: LanguageCode): LanguageLevel[] => {
    const config = getLanguageConfig(languageCode);
    return config?.levels || staticGetLanguageLevels(languageCode);
  }, [getLanguageConfig]);

  const getLanguageDataPath = useCallback((languageCode: LanguageCode): string => {
    const config = getLanguageConfig(languageCode);
    return config?.dataPath || staticGetLanguageDataPath(languageCode);
  }, [getLanguageConfig]);

  const requiresScriptLearning = useCallback((languageCode: LanguageCode): boolean => {
    const config = getLanguageConfig(languageCode);
    if (config) {
      return config.scripts.some(script => script.required);
    }
    return staticRequiresScriptLearning(languageCode);
  }, [getLanguageConfig]);

  const getTTSVoices = useCallback((languageCode: LanguageCode) => {
    const config = getLanguageConfig(languageCode);
    return config?.ttsVoices || staticGetTTSVoices(languageCode);
  }, [getLanguageConfig]);

  const [targetLanguage, setTargetLanguageState] = useState<LanguageCode>(getStaticDefaultLanguage());
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TARGET_LANGUAGE_KEY);
      if (saved && isLanguageAvailable(saved)) {
        setTargetLanguageState(saved);
      }
    } catch (error) {
      console.error('Failed to load target language from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Apply theme based on target language (for dynamic theme switching)
  // Or override if user has selected a specific global or per-language theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      let themeToApply: string = targetLanguage;

      // 1. Check for global override
      if (settings.globalTheme && settings.globalTheme !== 'auto') {
        themeToApply = settings.globalTheme;
      }
      // 2. Check for per-language override
      else if (settings.languageThemes && settings.languageThemes[targetLanguage] && settings.languageThemes[targetLanguage] !== 'auto') {
        themeToApply = settings.languageThemes[targetLanguage];
      }

      document.documentElement.setAttribute('data-theme', themeToApply);

      // 3. Apply custom colors if any
      const root = document.documentElement;
      const colors = settings.customColors || {};

      const colorMap: Record<string, string | undefined> = {
        '--bg-primary': colors.bgPrimary,
        '--bg-secondary': colors.bgSecondary,
        '--text-primary': colors.textPrimary,
        '--accent-primary': colors.accentPrimary,
        '--accent-gold': colors.accentGold,
      };

      Object.entries(colorMap).forEach(([variable, value]) => {
        if (value) {
          root.style.setProperty(variable, value);
        } else {
          root.style.removeProperty(variable);
        }
      });
    }
  }, [targetLanguage, settings.globalTheme, settings.languageThemes, settings.customColors]);

  // Set and persist target language
  const setTargetLanguage = useCallback((code: LanguageCode) => {
    if (!isLanguageAvailable(code)) {
      console.error(`Language ${code} is not available`);
      return;
    }

    setTargetLanguageState(code);
    try {
      localStorage.setItem(TARGET_LANGUAGE_KEY, code);
    } catch (error) {
      console.error('Failed to save target language to localStorage:', error);
    }
  }, [isLanguageAvailable]);

  // Memoized configuration
  const languageConfig = useMemo(() => getLanguageConfig(targetLanguage), [targetLanguage, getLanguageConfig]);
  const availableLanguages = useMemo(() => getAvailableLanguages(), [getAvailableLanguages]);
  const availableModules = useMemo(() => getAvailableModules(targetLanguage), [targetLanguage, getAvailableModules]);
  const levels = useMemo(() => getLanguageLevels(targetLanguage), [targetLanguage, getLanguageLevels]);
  const dataPath = useMemo(() => getLanguageDataPath(targetLanguage), [targetLanguage, getLanguageDataPath]);
  const needsScriptLearning = useMemo(() => requiresScriptLearning(targetLanguage), [targetLanguage, requiresScriptLearning]);
  const ttsVoices = useMemo(() => getTTSVoices(targetLanguage), [targetLanguage, getTTSVoices]);

  // Check if a specific module is enabled for current language
  const isModuleEnabled = useCallback(
    (module: ModuleName) => isModuleAvailable(targetLanguage, module),
    [targetLanguage, isModuleAvailable]
  );

  // Get the appropriate TTS voice (prefer web speech for simplicity)
  const ttsVoice = useMemo(() => ttsVoices?.webSpeech || 'en-US', [ttsVoices]);

  // Helper to construct data URLs for the current language
  const getDataUrl = useCallback(
    (filename: string) => `${dataPath}/${filename}`,
    [dataPath]
  );

  const contextValue: TargetLanguageContextType = useMemo(() => ({
    targetLanguage,
    languageConfig,
    isLoading,
    setTargetLanguage,
    availableLanguages,
    availableModules,
    levels,
    dataPath,
    isModuleEnabled,
    needsScriptLearning,
    ttsVoice,
    getDataUrl,
  }), [
    targetLanguage,
    languageConfig,
    isLoading,
    setTargetLanguage,
    availableLanguages,
    availableModules,
    levels,
    dataPath,
    isModuleEnabled,
    needsScriptLearning,
    ttsVoice,
    getDataUrl,
  ]);

  return (
    <TargetLanguageContext.Provider value={contextValue}>
      {children}
    </TargetLanguageContext.Provider>
  );
}

/**
 * Hook to access target language context
 * Must be used within TargetLanguageProvider
 */
export function useTargetLanguage(): TargetLanguageContextType {
  const context = useContext(TargetLanguageContext);
  if (!context) {
    throw new Error('useTargetLanguage must be used within TargetLanguageProvider');
  }
  return context;
}

// Re-export the type for backward compatibility
export type UseTargetLanguageReturn = TargetLanguageContextType;
