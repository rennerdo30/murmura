'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Navigation from '@/components/common/Navigation';
import { Container, Card, Text, Button, Toggle, Animated } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { useTargetLanguage } from '@/context/TargetLanguageProvider';
import { useSettings } from '@/context/SettingsProvider';
import { ThemeOverride, Settings } from '@/types/context';
import { useMobile } from '@/hooks/useMobile';
import { useKokoroVoice } from '@/hooks/useKokoroVoice';
import {
  loadKokoroModel,
  unloadKokoroModel,
  isKokoroLoaded,
  isKokoroLoading,
  getKokoroModelSize,
  checkKokoroSupport,
  KOKORO_VOICES,
  speakWithKokoro,
  getVoicesForTargetLanguage,
  isKokoroSupportedLanguage,
  type KokoroLoadProgress,
  type KokoroVoice,
} from '@/lib/kokoroTTS';
import {
  getAvailableLanguages,
  getLanguageDisplayInfo,
  LanguageCode
} from '@/lib/language';
import {
  isEdgeTTSSupported,
  getEdgeVoicesForLanguage,
  getSelectedEdgeVoice,
  saveEdgeVoice,
  speakWithEdgeTTS,
  type EdgeVoiceInfo,
} from '@/lib/edgeTTS';
import {
  IoSettings,
  IoTrophy,
  IoTime,
  IoVolumeHigh,
  IoColorPalette,
  IoChevronForward,
  IoCloudOffline,
  IoDownload,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoPlay,
  IoMic,
  IoWarning,
} from 'react-icons/io5';
import styles from './settings.module.css';

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  it: 'Italian',
  pt: 'Portuguese',
  en: 'English',
};

// Test phrases per language
const TEST_PHRASES: Record<string, string> = {
  ja: 'こんにちは、これはテストです。',
  zh: '你好，这是一个测试。',
  es: 'Hola, esta es una prueba.',
  fr: 'Bonjour, ceci est un test.',
  hi: 'नमस्ते, यह एक परीक्षण है।',
  it: 'Ciao, questo è un test.',
  pt: 'Olá, isto é um teste.',
  en: 'Hello, this is a test.',
};

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  const { settings, updateSetting } = useSettings();
  const isMobile = useMobile();

  // Leaderboard visibility
  const leaderboardVisible = useQuery(api.leaderboard.getLeaderboardVisibility);
  const setLeaderboardVisibility = useMutation(api.leaderboard.setLeaderboardVisibility);
  const myXPData = useQuery(api.leaderboard.getMyXPBreakdown);

  // Offline TTS state
  const [kokoroStatus, setKokoroStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [kokoroProgress, setKokoroProgress] = useState(0);
  const [kokoroMessage, setKokoroMessage] = useState('');
  const [kokoroSupported, setKokoroSupported] = useState<boolean | null>(null);
  const [kokoroSupportReason, setKokoroSupportReason] = useState<string>('');

  // Voice selection - uses Convex when logged in, localStorage otherwise
  const { voice: selectedVoice, setVoice: setSelectedVoice, isSupported: languageSupported } = useKokoroVoice(targetLanguage);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Get available voices for the current target language
  const availableVoices = useMemo(() => {
    return getVoicesForTargetLanguage(targetLanguage);
  }, [targetLanguage]);

  // Group voices by gender
  const voicesByGender = useMemo(() => {
    const female = availableVoices.filter((v) => v.gender === 'Female');
    const male = availableVoices.filter((v) => v.gender === 'Male');
    return { female, male };
  }, [availableVoices]);

  // Edge TTS state
  const [edgeVoice, setEdgeVoice] = useState<string>('');
  const [isTestingEdgeVoice, setIsTestingEdgeVoice] = useState(false);
  const edgeTTSAvailable = useMemo(() => isEdgeTTSSupported(targetLanguage), [targetLanguage]);
  const edgeVoices = useMemo(() => getEdgeVoicesForLanguage(targetLanguage), [targetLanguage]);
  const edgeVoicesByGender = useMemo(() => {
    const female = edgeVoices.filter((v) => v.gender === 'Female');
    const male = edgeVoices.filter((v) => v.gender === 'Male');
    return { female, male };
  }, [edgeVoices]);

  // Load saved Edge TTS voice on mount
  useEffect(() => {
    if (edgeTTSAvailable) {
      const saved = getSelectedEdgeVoice(targetLanguage);
      setEdgeVoice(saved);
    }
  }, [targetLanguage, edgeTTSAvailable]);

  // Check Kokoro support and initial status on mount
  useEffect(() => {
    const support = checkKokoroSupport();
    setKokoroSupported(support.supported);
    setKokoroSupportReason(support.reason ?? '');

    // Check initial status
    if (isKokoroLoaded()) {
      setKokoroStatus('ready');
    } else if (isKokoroLoading()) {
      setKokoroStatus('loading');
    }

    // On desktop, auto-load Kokoro if not already loaded
    if (!isMobile && support.supported && !isKokoroLoaded() && !isKokoroLoading()) {
      setKokoroStatus('loading');
      setKokoroMessage(t('settings.audio.loading'));

      loadKokoroModel((progress) => {
        setKokoroProgress(progress.progress);
        setKokoroMessage(progress.message);
        if (progress.status === 'ready') {
          setKokoroStatus('ready');
        } else if (progress.status === 'error') {
          setKokoroStatus('error');
        }
      }).catch((error) => {
        setKokoroStatus('error');
        setKokoroMessage(error instanceof Error ? error.message : t('settings.audio.loadError'));
      });
    }

    // Poll for Kokoro load completion (in case it's loading elsewhere)
    if (!isMobile && support.supported) {
      const checkInterval = setInterval(() => {
        if (isKokoroLoaded() && kokoroStatus !== 'ready') {
          setKokoroStatus('ready');
          clearInterval(checkInterval);
        }
      }, 500);

      // Cleanup
      return () => clearInterval(checkInterval);
    }
  }, [isMobile, kokoroStatus]);

  const handleVisibilityToggle = useCallback(async (visible: boolean) => {
    await setLeaderboardVisibility({ visible });
  }, [setLeaderboardVisibility]);

  const handleKokoroToggle = useCallback(async (enabled: string) => {
    if (enabled === 'enabled') {
      // Start loading the model
      setKokoroStatus('loading');
      setKokoroProgress(0);
      setKokoroMessage('Initializing...');

      try {
        await loadKokoroModel((progress: KokoroLoadProgress) => {
          setKokoroProgress(progress.progress);
          setKokoroMessage(progress.message);
          if (progress.status === 'ready') {
            setKokoroStatus('ready');
          } else if (progress.status === 'error') {
            setKokoroStatus('error');
          }
        });
      } catch (error) {
        setKokoroStatus('error');
        setKokoroMessage(error instanceof Error ? error.message : 'Failed to load model');
      }
    } else {
      // Unload the model
      unloadKokoroModel();
      setKokoroStatus('idle');
      setKokoroProgress(0);
      setKokoroMessage('');
    }
  }, []);

  const handleThemeChange = useCallback((theme: string) => {
    updateSetting('globalTheme', theme as ThemeOverride);
  }, [updateSetting]);

  const handleLanguageThemeChange = useCallback((langCode: string, theme: string) => {
    const newLanguageThemes = { ...settings.languageThemes, [langCode]: theme as ThemeOverride };
    updateSetting('languageThemes', newLanguageThemes);
  }, [settings.languageThemes, updateSetting]);

  const handleColorChange = useCallback((key: keyof Settings['customColors'], value: string) => {
    const newCustomColors = { ...settings.customColors, [key]: value };
    updateSetting('customColors', newCustomColors);
  }, [settings.customColors, updateSetting]);

  const handleResetColors = useCallback(() => {
    updateSetting('customColors', {});
  }, [updateSetting]);

  const handleVoiceChange = useCallback((voiceId: KokoroVoice) => {
    setSelectedVoice(voiceId);
  }, [setSelectedVoice]);

  const handleTestVoice = useCallback(async () => {
    if (!isKokoroLoaded() || isTestingVoice) return;

    setIsTestingVoice(true);
    try {
      const testText = TEST_PHRASES[targetLanguage] || TEST_PHRASES.en;
      await speakWithKokoro(testText, selectedVoice, 0.8);
    } catch (error) {
      console.error('Voice test failed:', error);
    } finally {
      setIsTestingVoice(false);
    }
  }, [selectedVoice, isTestingVoice, targetLanguage]);

  // Edge TTS handlers
  const handleEdgeVoiceChange = useCallback((voiceId: string) => {
    setEdgeVoice(voiceId);
    saveEdgeVoice(targetLanguage, voiceId);
  }, [targetLanguage]);

  const handleTestEdgeVoice = useCallback(async () => {
    if (!edgeTTSAvailable || isTestingEdgeVoice || !edgeVoice) return;

    setIsTestingEdgeVoice(true);
    try {
      const testText = TEST_PHRASES[targetLanguage] || TEST_PHRASES.en;
      await speakWithEdgeTTS(testText, targetLanguage, 0.8);
    } catch (error) {
      console.error('Edge TTS test failed:', error);
    } finally {
      setIsTestingEdgeVoice(false);
    }
  }, [edgeVoice, isTestingEdgeVoice, targetLanguage, edgeTTSAvailable]);

  const modelSize = getKokoroModelSize();
  const selectedVoiceInfo = KOKORO_VOICES.find((v) => v.id === selectedVoice);
  const languageName = t(`languages.${targetLanguage}`);

  return (
    <Container variant="centered">
      <Navigation />

      <Animated animation="fadeInDown">
        <div className={styles.pageHeader}>
          <IoSettings className={styles.headerIcon} />
          <Text variant="h1" color="gold" className={styles.pageTitle}>
            {t('settings.title')}
          </Text>
        </div>
        <Text color="muted" align="center" className={styles.pageSubtitle}>
          {t('settings.subtitle')}
        </Text>
      </Animated>

      {/* Leaderboard Settings */}
      <Card variant="glass" className={styles.settingsSection}>
        <div className={styles.sectionHeader}>
          <IoTrophy className={styles.sectionIcon} />
          <Text variant="h3">{t('settings.leaderboard.title')}</Text>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <Text className={styles.settingLabel}>{t('settings.leaderboard.showOnLeaderboard')}</Text>
            <Text variant="label" color="muted">
              {t('settings.leaderboard.showOnLeaderboardDescription')}
            </Text>
          </div>
          <div className={styles.settingControl}>
            {leaderboardVisible !== undefined && (
              <Toggle
                options={[
                  { id: 'visible', label: t('settings.leaderboard.visible') },
                  { id: 'hidden', label: t('settings.leaderboard.hidden') },
                ]}
                value={leaderboardVisible ? 'visible' : 'hidden'}
                onChange={(value) => handleVisibilityToggle(value === 'visible')}
                name="leaderboardVisibility"
              />
            )}
          </div>
        </div>

        {myXPData?.anonymousName && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <Text className={styles.settingLabel}>{t('settings.leaderboard.anonymousName')}</Text>
              <Text variant="label" color="muted">
                {t('settings.leaderboard.anonymousNameDescription')}
              </Text>
            </div>
            <div className={styles.settingControl}>
              <Text color="gold" className={styles.anonymousName}>
                {myXPData.anonymousName}
              </Text>
            </div>
          </div>
        )}
      </Card>

      {/* SRS Settings Link */}
      <Link href="/settings/srs" className={styles.settingsLink}>
        <Card variant="glass" hover className={styles.settingsSection}>
          <div className={styles.linkContent}>
            <div className={styles.linkLeft}>
              <IoTime className={styles.sectionIcon} />
              <div>
                <Text variant="h3">{t('settings.srs.title')}</Text>
                <Text variant="label" color="muted">
                  {t('settings.srs.description')}
                </Text>
              </div>
            </div>
            <IoChevronForward className={styles.chevron} />
          </div>
        </Card>
      </Link>

      {/* Audio & TTS Settings */}
      <Card variant="glass" className={styles.settingsSection}>
        <div className={styles.sectionHeader}>
          <IoVolumeHigh className={styles.sectionIcon} />
          <Text variant="h3">{t('settings.audio.title')}</Text>
        </div>

        {/* Kokoro TTS Enable/Disable (mobile only shows toggle) */}
        {isMobile && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabelRow}>
                <IoCloudOffline className={styles.settingLabelIcon} />
                <Text className={styles.settingLabel}>{t('settings.audio.offlineTTS')}</Text>
              </div>
              <Text variant="label" color="muted">
                {t('settings.audio.offlineTTSDescription', { size: modelSize })}
              </Text>
              {!kokoroSupported && kokoroSupported !== null && (
                <Text variant="label" color="error" className={styles.warningText}>
                  {t('settings.audio.notSupported', { reason: kokoroSupportReason })}
                </Text>
              )}
            </div>
            <div className={styles.settingControl}>
              {kokoroSupported && (
                <Toggle
                  options={[
                    { id: 'disabled', label: t('settings.audio.off') },
                    { id: 'enabled', label: t('settings.audio.on') },
                  ]}
                  value={kokoroStatus === 'ready' ? 'enabled' : 'disabled'}
                  onChange={handleKokoroToggle}
                  name="offlineTTS"
                  disabled={kokoroStatus === 'loading'}
                />
              )}
            </div>
          </div>
        )}

        {/* Desktop auto-load notice */}
        {!isMobile && kokoroSupported && (
          <div className={styles.statusSection}>
            <IoCheckmarkCircle className={styles.successIcon} />
            <Text variant="label" color="success">
              {t('settings.audio.desktopNotice')}
            </Text>
          </div>
        )}

        {/* Kokoro Loading Progress */}
        {kokoroStatus === 'loading' && (
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <IoDownload className={styles.progressIcon} />
              <Text variant="label">{kokoroMessage}</Text>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${kokoroProgress}%` }}
              />
            </div>
            <Text variant="label" color="muted" className={styles.progressPercent}>
              {kokoroProgress}%
            </Text>
          </div>
        )}

        {/* Kokoro Ready Status */}
        {kokoroStatus === 'ready' && isMobile && (
          <div className={styles.statusSection}>
            <IoCheckmarkCircle className={styles.successIcon} />
            <Text variant="label" color="success">
              {t('settings.audio.readyNotice')}
            </Text>
          </div>
        )}

        {/* Kokoro Error Status */}
        {kokoroStatus === 'error' && (
          <div className={styles.statusSection}>
            <IoCloseCircle className={styles.errorIcon} />
            <Text variant="label" color="error">
              {kokoroMessage || t('settings.audio.loadError')}
            </Text>
          </div>
        )}

        {/* Voice Selection (only when Kokoro is ready) */}
        {(kokoroStatus === 'ready' || (!isMobile && isKokoroLoaded())) && (
          <>
            <div className={styles.voiceSelectionHeader}>
              <IoMic className={styles.settingLabelIcon} />
              <Text className={styles.settingLabel}>{t('settings.audio.voiceSelection', { language: languageName })}</Text>
            </div>

            {/* Show warning if language not supported by Kokoro */}
            {!languageSupported ? (
              <div className={styles.statusSection}>
                <IoWarning className={styles.warningIcon} />
                <Text variant="label" color="muted" className={styles.warningText}>
                  {t('settings.audio.notSupportedWarning', { language: languageName })}
                </Text>
              </div>
            ) : availableVoices.length === 0 ? (
              <div className={styles.statusSection}>
                <IoWarning className={styles.warningIcon} />
                <Text variant="label" color="muted" className={styles.warningText}>
                  {t('settings.audio.noVoicesWarning', { language: languageName })}
                </Text>
              </div>
            ) : (
              <>
                <Text variant="label" color="muted" className={styles.voiceSelectionNote}>
                  {t('settings.audio.voiceSelectionNote', { language: languageName })}
                </Text>

                {/* Voice Selector */}
                <div className={styles.voiceSelector}>
                  <select
                    className={styles.voiceSelect}
                    value={selectedVoice}
                    onChange={(e) => handleVoiceChange(e.target.value as KokoroVoice)}
                  >
                    {voicesByGender.female.length > 0 && (
                      <optgroup label="Female">
                        {voicesByGender.female.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} ({voice.quality}) {voice.traits || ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {voicesByGender.male.length > 0 && (
                      <optgroup label="Male">
                        {voicesByGender.male.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} ({voice.quality}) {voice.traits || ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <Button
                    variant="secondary"
                    onClick={handleTestVoice}
                    disabled={isTestingVoice || !isKokoroLoaded()}
                    className={styles.testVoiceButton}
                  >
                    <IoPlay />
                    {isTestingVoice ? t('settings.audio.playing') : t('settings.audio.test')}
                  </Button>
                </div>

                {/* Selected Voice Info */}
                {selectedVoiceInfo && (
                  <div className={styles.voiceInfo}>
                    <Text variant="label" color="muted">
                      {t('settings.audio.voiceDetail', {
                        language: selectedVoiceInfo.languageLabel,
                        gender: selectedVoiceInfo.gender,
                        quality: selectedVoiceInfo.quality
                      })}
                    </Text>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Edge TTS Voice Selection (Microsoft Neural Voices) */}
        {edgeTTSAvailable && edgeVoices.length > 0 && (
          <>
            <div className={styles.voiceSelectionHeader} style={{ marginTop: '1.5rem' }}>
              <IoVolumeHigh className={styles.settingLabelIcon} />
              <Text className={styles.settingLabel}>{t('settings.audio.edgeTitle', { language: languageName })}</Text>
            </div>
            <Text variant="label" color="muted" className={styles.voiceSelectionNote}>{t('settings.audio.edgeDesc', { language: languageName })}</Text>

            <div className={styles.voiceSelector}>
              <select
                className={styles.voiceSelect}
                value={edgeVoice}
                onChange={(e) => handleEdgeVoiceChange(e.target.value)}
              >
                {edgeVoicesByGender.female.length > 0 && (
                  <optgroup label="Female">
                    {edgeVoicesByGender.female.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {edgeVoicesByGender.male.length > 0 && (
                  <optgroup label="Male">
                    {edgeVoicesByGender.male.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <Button
                variant="secondary"
                onClick={handleTestEdgeVoice}
                disabled={isTestingEdgeVoice || !edgeVoice}
                className={styles.testVoiceButton}
              >
                <IoPlay />
                {isTestingEdgeVoice ? t('settings.audio.playing') : t('settings.audio.test')}
              </Button>
            </div>
          </>
        )}

        {/* TTS Tiers Explanation */}
        <div className={styles.ttsInfo}>
          <Text variant="label" color="muted" className={styles.ttsInfoTitle}>
            {t('settings.audio.priorityTitle')}
          </Text>
          <ol className={styles.ttsTierList}>
            <li>{t('settings.audio.priority1')}</li>
            <li>Edge TTS (Microsoft neural voices for {languageName})</li>
            <li>
              {t('settings.audio.priority2', {
                status: isMobile ? t('settings.audio.ifEnabled') : t('settings.audio.autoLoaded'),
                support: languageSupported ? languageName : t('settings.audio.englishOnly')
              })}
            </li>
            <li>{t('settings.audio.priority3')}</li>
          </ol>
        </div>
      </Card>

      <Card variant="glass" className={styles.settingsSection}>
        <div className={styles.sectionHeader}>
          <IoColorPalette className={styles.sectionIcon} />
          <Text variant="h3">{t('settings.appearance.title')}</Text>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <Text className={styles.settingLabel}>{t('settings.appearance.globalTheme')}</Text>
            <Text variant="label" color="muted">
              {t('settings.appearance.themeDescription')}
            </Text>
          </div>
          <div className={styles.settingControl}>
            <select
              className={styles.voiceSelect}
              value={settings.globalTheme}
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              <option value="auto">{t('settings.appearance.auto')}</option>
              <option value="ja">Japanese (Zen Garden)</option>
              <option value="zh">Chinese (Silk Road)</option>
              <option value="ko">Korean (Hanok)</option>
              <option value="es">Spanish (Sol y Sombra)</option>
              <option value="fr">French (Château)</option>
              <option value="it">Italian (Rinascimento)</option>
              <option value="en">English (Oxford Library)</option>
              <option value="de">German (Schwarzwald)</option>
            </select>
          </div>
        </div>

        {/* Per-Language Overrides */}
        <div className={styles.languageOverridesSection}>
          <Text variant="h3" className={styles.overridesTitle}>{t('settings.appearance.languageOverrides')}</Text>
          <Text variant="label" color="muted" className={styles.overridesSubtitle}>
            {t('settings.appearance.languageOverridesDescription')}
          </Text>

          <div className={styles.overridesGrid}>
            {getAvailableLanguages().map((langCode) => {
              const info = getLanguageDisplayInfo(langCode);
              return (
                <div key={langCode} className={styles.overrideRow}>
                  <Text className={styles.overrideLangName}>{info?.name || langCode}</Text>
                  <select
                    className={styles.overrideSelect}
                    value={settings.languageThemes?.[langCode] || 'auto'}
                    onChange={(e) => handleLanguageThemeChange(langCode, e.target.value)}
                  >
                    <option value="auto">{t('settings.appearance.auto')}</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                    <option value="ko">Korean</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="it">Italian</option>
                    <option value="en">English</option>
                    <option value="de">German</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Colors Section */}
        <div className={styles.customColorsSection}>
          <div className={styles.overridesHeader}>
            <div>
              <Text variant="h3" className={styles.overridesTitle}>{t('settings.appearance.customColors')}</Text>
              <Text variant="label" color="muted" className={styles.overridesSubtitle}>
                {t('settings.appearance.customColorsDescription')}
              </Text>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetColors}
              className={styles.resetButton}
            >
              {t('settings.appearance.resetColors')}
            </Button>
          </div>

          <div className={styles.colorGrid}>
            <div className={styles.colorRow}>
              <Text className={styles.colorLabel}>{t('settings.appearance.colors.bgPrimary')}</Text>
              <input
                type="color"
                className={styles.colorPicker}
                value={settings.customColors?.bgPrimary || '#0a0a0a'}
                onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
                aria-label={t('settings.appearance.colors.bgPrimary')}
              />
            </div>
            <div className={styles.colorRow}>
              <Text className={styles.colorLabel}>{t('settings.appearance.colors.bgSecondary')}</Text>
              <input
                type="color"
                className={styles.colorPicker}
                value={settings.customColors?.bgSecondary || '#1a1a1a'}
                onChange={(e) => handleColorChange('bgSecondary', e.target.value)}
                aria-label={t('settings.appearance.colors.bgSecondary')}
              />
            </div>
            <div className={styles.colorRow}>
              <Text className={styles.colorLabel}>{t('settings.appearance.colors.textPrimary')}</Text>
              <input
                type="color"
                className={styles.colorPicker}
                value={settings.customColors?.textPrimary || '#ffffff'}
                onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                aria-label={t('settings.appearance.colors.textPrimary')}
              />
            </div>
            <div className={styles.colorRow}>
              <Text className={styles.colorLabel}>{t('settings.appearance.colors.accentPrimary')}</Text>
              <input
                type="color"
                className={styles.colorPicker}
                value={settings.customColors?.accentPrimary || '#d4a574'}
                onChange={(e) => handleColorChange('accentPrimary', e.target.value)}
                aria-label={t('settings.appearance.colors.accentPrimary')}
              />
            </div>
            <div className={styles.colorRow}>
              <Text className={styles.colorLabel}>{t('settings.appearance.colors.accentGold')}</Text>
              <input
                type="color"
                className={styles.colorPicker}
                value={settings.customColors?.accentGold || '#d4a574'}
                onChange={(e) => handleColorChange('accentGold', e.target.value)}
                aria-label={t('settings.appearance.colors.accentGold')}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/')} className={styles.backButton}>
        {t('settings.backToDashboard')}
      </Button>
    </Container>
  );
}
