'use client';

import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button, Toggle } from '@/components/ui';
import Select from '@/components/ui/Select';
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
  type KokoroLoadProgress,
  type KokoroVoice,
  type KokoroVoiceInfo,
} from '@/lib/kokoroTTS';
import { getAvailableLanguages } from '@/lib/language';
import { getLanguageName } from '@/lib/languageNames';
import {
  isEdgeTTSSupported,
  getEdgeVoicesForLanguage,
  getSelectedEdgeVoice,
  saveEdgeVoice,
  speakWithEdgeTTS,
} from '@/lib/edgeTTS';
import { contrastRatio, meetsWCAGAA } from '@/lib/colorContrast';
import {
  IoTrophy,
  IoTime,
  IoVolumeHigh,
  IoColorPalette,
  IoChevronForward,
  IoChevronDown,
  IoCloudOffline,
  IoDownload,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoPlay,
  IoMic,
  IoWarning,
  IoInformationCircle,
  IoSchool,
} from 'react-icons/io5';
import styles from './settings.module.css';

/** Theme ids selectable as global or per-language theme (besides auto and light). */
const LANGUAGE_THEME_IDS = ['ja', 'zh', 'ko', 'es', 'fr', 'it', 'en', 'de'] as const;

/** Colour picker defaults, used when no custom colour is set. */
const DEFAULT_COLORS: Required<Settings['customColors']> = {
  bgPrimary: '#0a0a0a',
  bgSecondary: '#1a1a1a',
  textPrimary: '#ffffff',
  accentPrimary: '#d4a574',
  accentGold: '#d4a574',
};

const COLOR_KEYS = ['bgPrimary', 'bgSecondary', 'textPrimary', 'accentPrimary', 'accentGold'] as const;

const KOKORO_POLL_INTERVAL_MS = 500;
const TEST_SPEECH_RATE = 0.8;

/** Strips emoji from voice trait labels (the voice list uses them as decoration). */
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;
const cleanTraits = (traits?: string) => (traits ?? '').replace(EMOJI_PATTERN, '').trim();

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
  const { t } = useLanguage();
  const { targetLanguage } = useTargetLanguage();
  const { settings, updateSetting } = useSettings();
  const isMobile = useMobile();
  const idPrefix = useId();

  // Leaderboard visibility
  const leaderboardVisible = useQuery(api.leaderboard.getLeaderboardVisibility);
  const setLeaderboardVisibility = useMutation(api.leaderboard.setLeaderboardVisibility);
  const myXPData = useQuery(api.leaderboard.getMyXPBreakdown);
  // undefined while loading, null when signed out
  const currentUser = useQuery(api.auth.getCurrentUser);
  const isSignedIn = Boolean(currentUser);

  // Advanced audio toggle
  const [showAdvancedAudio, setShowAdvancedAudio] = useState(false);

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
      }, KOKORO_POLL_INTERVAL_MS);

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
      setKokoroMessage(t('settings.audio.initializing'));

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
        setKokoroMessage(error instanceof Error ? error.message : t('settings.audio.loadError'));
      }
    } else {
      // Unload the model
      unloadKokoroModel();
      setKokoroStatus('idle');
      setKokoroProgress(0);
      setKokoroMessage('');
    }
  }, [t]);

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
      await speakWithKokoro(testText, selectedVoice, TEST_SPEECH_RATE);
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
      await speakWithEdgeTTS(testText, targetLanguage, TEST_SPEECH_RATE);
    } catch (error) {
      console.error('Edge TTS test failed:', error);
    } finally {
      setIsTestingEdgeVoice(false);
    }
  }, [edgeVoice, isTestingEdgeVoice, targetLanguage, edgeTTSAvailable]);

  const modelSize = getKokoroModelSize();
  const selectedVoiceInfo = KOKORO_VOICES.find((v) => v.id === selectedVoice);
  const languageName = getLanguageName(targetLanguage, t);

  // Contrast validation for custom colors
  const contrastWarnings = useMemo(() => {
    const bg = settings.customColors?.bgPrimary || DEFAULT_COLORS.bgPrimary;
    const text = settings.customColors?.textPrimary || DEFAULT_COLORS.textPrimary;
    const gold = settings.customColors?.accentGold || DEFAULT_COLORS.accentGold;
    const textRatio = contrastRatio(text, bg);
    const goldRatio = contrastRatio(gold, bg);
    return {
      textFails: !meetsWCAGAA(text, bg),
      textRatio: textRatio.toFixed(1),
      goldFails: !meetsWCAGAA(gold, bg),
      goldRatio: goldRatio.toFixed(1),
    };
  }, [settings.customColors?.bgPrimary, settings.customColors?.textPrimary, settings.customColors?.accentGold]);

  const genderLabel = (gender: KokoroVoiceInfo['gender']) =>
    gender === 'Female' ? t('settings.audio.female') : t('settings.audio.male');

  const renderKokoroOption = (voice: KokoroVoiceInfo) => {
    const traits = cleanTraits(voice.traits);
    return (
      <option key={voice.id} value={voice.id}>
        {traits
          ? t('settings.audio.voiceOptionWithTraits', { name: voice.name, quality: voice.quality, traits })
          : t('settings.audio.voiceOption', { name: voice.name, quality: voice.quality })}
      </option>
    );
  };

  const kokoroVoiceReady = kokoroStatus === 'ready' || (!isMobile && isKokoroLoaded());

  return (
    <Container variant="dashboard">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className={styles.sections}>
        {/* Leaderboard */}
        <section className={styles.section} aria-labelledby={`${idPrefix}-leaderboard`}>
          <h2 id={`${idPrefix}-leaderboard`} className={styles.sectionTitle}>
            <IoTrophy className={styles.sectionIcon} aria-hidden="true" />
            {t('settings.leaderboard.title')}
          </h2>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <span id={`${idPrefix}-lb-label`} className={styles.rowLabel}>
                  {t('settings.leaderboard.showOnLeaderboard')}
                </span>
                <span className={styles.rowDescription}>
                  {t('settings.leaderboard.showOnLeaderboardDescription')}
                </span>
                {currentUser === null && (
                  <span className={styles.rowHint}>
                    <IoInformationCircle aria-hidden="true" />
                    {t('settings.leaderboard.signInHint')}
                  </span>
                )}
              </div>
              <div className={styles.rowControl} role="group" aria-labelledby={`${idPrefix}-lb-label`}>
                <Toggle
                  options={[
                    { id: 'visible', label: t('settings.leaderboard.visible') },
                    { id: 'hidden', label: t('settings.leaderboard.hidden') },
                  ]}
                  value={isSignedIn && leaderboardVisible ? 'visible' : 'hidden'}
                  onChange={(value) => handleVisibilityToggle(value === 'visible')}
                  name="leaderboardVisibility"
                  disabled={!isSignedIn || leaderboardVisible === undefined}
                />
              </div>
            </div>

            {myXPData?.anonymousName && (
              <div className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowLabel}>{t('settings.leaderboard.anonymousName')}</span>
                  <span className={styles.rowDescription}>{t('settings.leaderboard.anonymousNameDescription')}</span>
                </div>
                <div className={styles.rowControl}>
                  <span className={styles.anonymousName}>{myXPData.anonymousName}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Learning */}
        <section className={styles.section} aria-labelledby={`${idPrefix}-learning`}>
          <h2 id={`${idPrefix}-learning`} className={styles.sectionTitle}>
            <IoSchool className={styles.sectionIcon} aria-hidden="true" />
            {t('settings.learningTitle')}
          </h2>
          <div className={styles.card}>
            <Link href="/settings/srs" className={styles.linkRow}>
              <span className={styles.linkIcon} aria-hidden="true"><IoTime /></span>
              <span className={styles.rowInfo}>
                <span className={styles.rowLabel}>{t('settings.srs.title')}</span>
                <span className={styles.rowDescription}>{t('settings.srs.description')}</span>
              </span>
              <IoChevronForward className={styles.linkChevron} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Audio & TTS */}
        <section className={styles.section} aria-labelledby={`${idPrefix}-audio`}>
          <h2 id={`${idPrefix}-audio`} className={styles.sectionTitle}>
            <IoVolumeHigh className={styles.sectionIcon} aria-hidden="true" />
            {t('settings.audio.title')}
          </h2>
          <div className={styles.card}>
            {/* Kokoro voice selection (when the model is ready) */}
            {kokoroVoiceReady && (
              <div className={`${styles.row} ${styles.rowStacked}`}>
                <div className={styles.rowInfo}>
                  <label htmlFor={`${idPrefix}-kokoro-voice`} className={`${styles.rowLabel} ${styles.rowLabelIcon}`}>
                    <IoMic aria-hidden="true" />
                    {t('settings.audio.voiceSelection', { language: languageName })}
                  </label>
                  {languageSupported && availableVoices.length > 0 && (
                    <span className={styles.rowDescription}>
                      {t('settings.audio.voiceSelectionNote', { language: languageName })}
                    </span>
                  )}
                </div>

                {!languageSupported ? (
                  <p className={`${styles.status} ${styles.statusWarning}`}>
                    <IoWarning aria-hidden="true" />
                    <span>{t('settings.audio.notSupportedWarning', { language: languageName })}</span>
                  </p>
                ) : availableVoices.length === 0 ? (
                  <p className={`${styles.status} ${styles.statusWarning}`}>
                    <IoWarning aria-hidden="true" />
                    <span>{t('settings.audio.noVoicesWarning', { language: languageName })}</span>
                  </p>
                ) : (
                  <>
                    <div className={styles.voiceSelector}>
                      <Select
                        id={`${idPrefix}-kokoro-voice`}
                        fullWidth
                        value={selectedVoice}
                        onChange={(e) => handleVoiceChange(e.target.value as KokoroVoice)}
                      >
                        {voicesByGender.female.length > 0 && (
                          <optgroup label={t('settings.audio.female')}>
                            {voicesByGender.female.map(renderKokoroOption)}
                          </optgroup>
                        )}
                        {voicesByGender.male.length > 0 && (
                          <optgroup label={t('settings.audio.male')}>
                            {voicesByGender.male.map(renderKokoroOption)}
                          </optgroup>
                        )}
                      </Select>
                      <Button
                        variant="secondary"
                        onClick={handleTestVoice}
                        disabled={isTestingVoice || !isKokoroLoaded()}
                        className={styles.testButton}
                      >
                        <IoPlay aria-hidden="true" />
                        {isTestingVoice ? t('settings.audio.playing') : t('settings.audio.test')}
                      </Button>
                    </div>

                    {selectedVoiceInfo && (
                      <span className={styles.rowDescription}>
                        {t('settings.audio.voiceDetail', {
                          language: selectedVoiceInfo.languageLabel,
                          gender: genderLabel(selectedVoiceInfo.gender),
                          quality: selectedVoiceInfo.quality,
                        })}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Edge TTS voice selection */}
            {edgeTTSAvailable && edgeVoices.length > 0 && (
              <div className={`${styles.row} ${styles.rowStacked}`}>
                <div className={styles.rowInfo}>
                  <label htmlFor={`${idPrefix}-edge-voice`} className={`${styles.rowLabel} ${styles.rowLabelIcon}`}>
                    <IoVolumeHigh aria-hidden="true" />
                    {t('settings.audio.edgeTitle', { language: languageName })}
                  </label>
                  <span className={styles.rowDescription}>{t('settings.audio.edgeDesc', { language: languageName })}</span>
                </div>
                <div className={styles.voiceSelector}>
                  <Select
                    id={`${idPrefix}-edge-voice`}
                    fullWidth
                    value={edgeVoice}
                    onChange={(e) => handleEdgeVoiceChange(e.target.value)}
                  >
                    {edgeVoicesByGender.female.length > 0 && (
                      <optgroup label={t('settings.audio.female')}>
                        {edgeVoicesByGender.female.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {edgeVoicesByGender.male.length > 0 && (
                      <optgroup label={t('settings.audio.male')}>
                        {edgeVoicesByGender.male.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={handleTestEdgeVoice}
                    disabled={isTestingEdgeVoice || !edgeVoice}
                    className={styles.testButton}
                  >
                    <IoPlay aria-hidden="true" />
                    {isTestingEdgeVoice ? t('settings.audio.playing') : t('settings.audio.test')}
                  </Button>
                </div>
              </div>
            )}

            {/* Advanced audio settings (collapsible) */}
            <button
              type="button"
              className={styles.disclosure}
              onClick={() => setShowAdvancedAudio(!showAdvancedAudio)}
              aria-expanded={showAdvancedAudio}
              aria-controls={`${idPrefix}-advanced-audio`}
            >
              <span>{t('settings.audio.advancedSettings')}</span>
              <IoChevronDown
                className={`${styles.disclosureIcon} ${showAdvancedAudio ? styles.disclosureIconOpen : ''}`}
                aria-hidden="true"
              />
            </button>

            {showAdvancedAudio && (
              <div id={`${idPrefix}-advanced-audio`} className={styles.advanced}>
                {/* Kokoro enable/disable (mobile only; desktop loads it automatically) */}
                {isMobile && (
                  <div className={styles.row}>
                    <div className={styles.rowInfo}>
                      <span id={`${idPrefix}-offline-label`} className={`${styles.rowLabel} ${styles.rowLabelIcon}`}>
                        <IoCloudOffline aria-hidden="true" />
                        {t('settings.audio.offlineTTS')}
                      </span>
                      <span className={styles.rowDescription}>
                        {t('settings.audio.offlineTTSDescription', { size: modelSize })}
                      </span>
                      {!kokoroSupported && kokoroSupported !== null && (
                        <span className={styles.rowError}>
                          {t('settings.audio.notSupported', { reason: kokoroSupportReason })}
                        </span>
                      )}
                    </div>
                    <div className={styles.rowControl} role="group" aria-labelledby={`${idPrefix}-offline-label`}>
                      <Toggle
                        options={[
                          { id: 'disabled', label: t('settings.audio.off') },
                          { id: 'enabled', label: t('settings.audio.on') },
                        ]}
                        value={kokoroStatus === 'ready' ? 'enabled' : 'disabled'}
                        onChange={handleKokoroToggle}
                        name="offlineTTS"
                        disabled={!kokoroSupported || kokoroStatus === 'loading'}
                      />
                    </div>
                  </div>
                )}

                {!isMobile && kokoroSupported && (
                  <p className={`${styles.status} ${styles.statusSuccess}`}>
                    <IoCheckmarkCircle aria-hidden="true" />
                    <span>{t('settings.audio.desktopNotice')}</span>
                  </p>
                )}

                {kokoroStatus === 'loading' && (
                  <div className={styles.progress}>
                    <div className={styles.progressHeader}>
                      <IoDownload className={styles.progressIcon} aria-hidden="true" />
                      <span>{kokoroMessage}</span>
                    </div>
                    <div
                      className={styles.progressTrack}
                      role="progressbar"
                      aria-valuenow={kokoroProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('settings.audio.offlineTTS')}
                    >
                      <div className={styles.progressFill} style={{ width: `${kokoroProgress}%` }} />
                    </div>
                  </div>
                )}

                {kokoroStatus === 'ready' && isMobile && (
                  <p className={`${styles.status} ${styles.statusSuccess}`}>
                    <IoCheckmarkCircle aria-hidden="true" />
                    <span>{t('settings.audio.readyNotice')}</span>
                  </p>
                )}

                {kokoroStatus === 'error' && (
                  <p className={`${styles.status} ${styles.statusError}`} role="alert">
                    <IoCloseCircle aria-hidden="true" />
                    <span>{kokoroMessage || t('settings.audio.loadError')}</span>
                  </p>
                )}

                <div className={styles.infoBox}>
                  <p className={styles.infoTitle}>{t('settings.audio.priorityTitle')}</p>
                  <ol className={styles.infoList}>
                    <li>{t('settings.audio.priority1')}</li>
                    <li>{t('settings.audio.priorityEdge', { language: languageName })}</li>
                    <li>
                      {t('settings.audio.priority2', {
                        status: isMobile ? t('settings.audio.ifEnabled') : t('settings.audio.autoLoaded'),
                        support: languageSupported ? languageName : t('settings.audio.englishOnly'),
                      })}
                    </li>
                    <li>{t('settings.audio.priority3')}</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Appearance */}
        <section className={styles.section} aria-labelledby={`${idPrefix}-appearance`}>
          <h2 id={`${idPrefix}-appearance`} className={styles.sectionTitle}>
            <IoColorPalette className={styles.sectionIcon} aria-hidden="true" />
            {t('settings.appearance.title')}
          </h2>

          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowInfo}>
                <label htmlFor={`${idPrefix}-global-theme`} className={styles.rowLabel}>
                  {t('settings.appearance.globalTheme')}
                </label>
                <span className={styles.rowDescription}>{t('settings.appearance.themeDescription')}</span>
              </div>
              <div className={styles.rowControl}>
                <Select
                  id={`${idPrefix}-global-theme`}
                  wrapperClassName={styles.select}
                  value={settings.globalTheme}
                  onChange={(e) => handleThemeChange(e.target.value)}
                >
                  <option value="auto">{t('settings.appearance.auto')}</option>
                  <option value="light">{t('settings.appearance.themes.light')}</option>
                  {LANGUAGE_THEME_IDS.map((themeId) => (
                    <option key={themeId} value={themeId}>{t(`settings.appearance.themes.${themeId}`)}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Per-language overrides */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>{t('settings.appearance.languageOverrides')}</h3>
            <p className={styles.subsectionText}>{t('settings.appearance.languageOverridesDescription')}</p>
            <div className={styles.card}>
              {getAvailableLanguages().map((langCode) => {
                const selectId = `${idPrefix}-theme-${langCode}`;
                return (
                  <div key={langCode} className={`${styles.row} ${styles.rowCompact}`}>
                    <label htmlFor={selectId} className={styles.rowLabel}>{getLanguageName(langCode, t)}</label>
                    <div className={styles.rowControl}>
                      <Select
                        id={selectId}
                        wrapperClassName={styles.select}
                        value={settings.languageThemes?.[langCode] || 'auto'}
                        onChange={(e) => handleLanguageThemeChange(langCode, e.target.value)}
                      >
                        <option value="auto">{t('settings.appearance.auto')}</option>
                        <option value="light">{t('settings.appearance.themes.light')}</option>
                        {LANGUAGE_THEME_IDS.map((themeId) => (
                          <option key={themeId} value={themeId}>{t(`settings.appearance.themes.${themeId}`)}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom colours */}
          <div className={styles.subsection}>
            <div className={styles.subsectionHeader}>
              <div>
                <h3 className={styles.subsectionTitle}>{t('settings.appearance.customColors')}</h3>
                <p className={styles.subsectionText}>{t('settings.appearance.customColorsDescription')}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleResetColors} className={styles.resetButton}>
                {t('settings.appearance.resetColors')}
              </Button>
            </div>

            <div className={styles.colorGrid}>
              {COLOR_KEYS.map((colorKey) => {
                const inputId = `${idPrefix}-color-${colorKey}`;
                return (
                  <div key={colorKey} className={styles.colorRow}>
                    <label htmlFor={inputId} className={styles.rowLabel}>
                      {t(`settings.appearance.colors.${colorKey}`)}
                    </label>
                    <input
                      id={inputId}
                      type="color"
                      className={styles.colorPicker}
                      value={settings.customColors?.[colorKey] || DEFAULT_COLORS[colorKey]}
                      onChange={(e) => handleColorChange(colorKey, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>

            {(contrastWarnings.textFails || contrastWarnings.goldFails) ? (
              <div className={`${styles.status} ${styles.statusError}`} role="status">
                <IoWarning aria-hidden="true" />
                <div className={styles.statusLines}>
                  {contrastWarnings.textFails && (
                    <span>
                      {t('settings.appearance.contrastWarningTextRatio', { ratio: contrastWarnings.textRatio })}
                    </span>
                  )}
                  {contrastWarnings.goldFails && (
                    <span>
                      {t('settings.appearance.contrastWarningAccentRatio', { ratio: contrastWarnings.goldRatio })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className={`${styles.status} ${styles.statusSuccess}`} role="status">
                <IoCheckmarkCircle aria-hidden="true" />
                <span>{t('settings.appearance.contrastOk')}</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </Container>
  );
}
