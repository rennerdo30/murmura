'use client';

import { useState, useEffect, useCallback, useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { Container, Button, Toggle } from '@/components/ui';
import { useLanguage } from '@/context/LanguageProvider';
import { SRSSettings, DEFAULT_SRS_SETTINGS } from '@/lib/reviewQueue';
import { IoSave, IoRefresh, IoNotifications, IoSpeedometer, IoTime, IoVolumeHigh, IoCheckmarkCircle } from 'react-icons/io5';
import settingsStyles from '../settings.module.css';
import styles from './srs.module.css';

const STORAGE_KEY = 'murmura_srs_settings';
const SAVED_NOTICE_MS = 2000;
const PERCENT = 100;
const THRESHOLD_OPTIONS = ['strict', 'moderate', 'relaxed'] as const;

type BooleanSettingKey = 'autoplayAudio' | 'showReadingHints' | 'reviewReminders';

interface SliderRowProps {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Visible value next to the slider. */
  display: ReactNode;
  /** Spoken value for screen readers. */
  valueText: string;
  onChange: (value: number) => void;
}

function SliderRow({ id, label, description, min, max, step = 1, value, display, valueText, onChange }: SliderRowProps) {
  return (
    <div className={settingsStyles.row}>
      <div className={settingsStyles.rowInfo}>
        <label htmlFor={id} className={settingsStyles.rowLabel}>{label}</label>
        <span id={`${id}-description`} className={settingsStyles.rowDescription}>{description}</span>
      </div>
      <div className={`${settingsStyles.rowControl} ${styles.sliderControl}`}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueText}
          aria-describedby={`${id}-description`}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className={styles.slider}
        />
        <span className={styles.sliderValue} aria-hidden="true">{display}</span>
      </div>
    </div>
  );
}

interface SectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

function Section({ id, icon, title, children }: SectionProps) {
  return (
    <section className={settingsStyles.section} aria-labelledby={id}>
      <h2 id={id} className={settingsStyles.sectionTitle}>
        <span className={settingsStyles.sectionIcon} aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className={settingsStyles.card}>{children}</div>
    </section>
  );
}

export default function SRSSettingsPage() {
  const { t, language } = useLanguage();
  const idPrefix = useId();
  const [settings, setSettings] = useState<SRSSettings>(DEFAULT_SRS_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const percentFormat = useMemo(() => new Intl.NumberFormat(language, { style: 'percent' }), [language]);
  const signedPercentFormat = useMemo(
    () => new Intl.NumberFormat(language, { style: 'percent', signDisplay: 'exceptZero' }),
    [language]
  );
  const multiplierFormat = useMemo(
    () => new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [language]
  );

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SRS_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load SRS settings:', error);
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof SRSSettings>(key: K, value: SRSSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  // Save settings
  const handleSave = useCallback(() => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), SAVED_NOTICE_MS);
    } catch (error) {
      console.error('Failed to save SRS settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SRS_SETTINGS);
    setSaved(false);
  }, []);

  const renderToggleRow = (key: BooleanSettingKey, label: string, description: string) => {
    const labelId = `${idPrefix}-${key}-label`;
    return (
      <div className={settingsStyles.row}>
        <div className={settingsStyles.rowInfo}>
          <span id={labelId} className={settingsStyles.rowLabel}>{label}</span>
          <span className={settingsStyles.rowDescription}>{description}</span>
        </div>
        <div className={settingsStyles.rowControl} role="group" aria-labelledby={labelId}>
          <Toggle
            options={[
              { id: 'on', label: t('settings.audio.on') },
              { id: 'off', label: t('settings.audio.off') },
            ]}
            value={settings[key] ? 'on' : 'off'}
            onChange={(value) => updateSetting(key, value === 'on')}
            name={key}
          />
        </div>
      </div>
    );
  };

  const easeBonusText = signedPercentFormat.format(settings.easeBonus);
  const reviewLimitText = settings.dailyReviewLimit === 0
    ? t('settings.srsPage.unlimited')
    : String(settings.dailyReviewLimit);
  const thresholdLabelId = `${idPrefix}-threshold-label`;

  return (
    <Container variant="dashboard">
      <PageHeader title={t('srs.title')} subtitle={t('srs.subtitle')} backHref="/settings" />

      <div className={settingsStyles.sections}>
        {/* Review scheduling */}
        <Section id={`${idPrefix}-scheduling`} icon={<IoTime />} title={t('srs.scheduling.title')}>
          <SliderRow
            id={`${idPrefix}-new-items`}
            label={t('srs.scheduling.newItemsLimit')}
            description={t('srs.scheduling.newItemsDescription')}
            min={5}
            max={50}
            value={settings.dailyNewItemsLimit}
            display={settings.dailyNewItemsLimit}
            valueText={String(settings.dailyNewItemsLimit)}
            onChange={(value) => updateSetting('dailyNewItemsLimit', value)}
          />
          <SliderRow
            id={`${idPrefix}-review-limit`}
            label={t('srs.scheduling.reviewLimit')}
            description={t('srs.scheduling.reviewLimitDescription')}
            min={0}
            max={200}
            step={10}
            value={settings.dailyReviewLimit}
            display={settings.dailyReviewLimit === 0 ? '∞' : settings.dailyReviewLimit}
            valueText={reviewLimitText}
            onChange={(value) => updateSetting('dailyReviewLimit', value)}
          />
          <div className={settingsStyles.row}>
            <div className={settingsStyles.rowInfo}>
              <span id={thresholdLabelId} className={settingsStyles.rowLabel}>{t('srs.scheduling.threshold')}</span>
              <span className={settingsStyles.rowDescription}>{t('srs.scheduling.thresholdDescription')}</span>
            </div>
            <div className={settingsStyles.rowControl}>
              <div className={styles.segmented} role="group" aria-labelledby={thresholdLabelId}>
                {THRESHOLD_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.segment} ${settings.reviewThreshold === option ? styles.segmentActive : ''}`}
                    aria-pressed={settings.reviewThreshold === option}
                    onClick={() => updateSetting('reviewThreshold', option)}
                  >
                    {t(`srs.scheduling.threshold${option.charAt(0).toUpperCase() + option.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Difficulty adjustments */}
        <Section id={`${idPrefix}-difficulty`} icon={<IoSpeedometer />} title={t('srs.difficulty.title')}>
          <SliderRow
            id={`${idPrefix}-ease-bonus`}
            label={t('srs.difficulty.easeBonus')}
            description={t('srs.difficulty.easeBonusDescription', {
              value: `${settings.easeBonus >= 0 ? '+' : ''}${Math.round(settings.easeBonus * PERCENT)}`,
            })}
            min={-20}
            max={20}
            value={Math.round(settings.easeBonus * PERCENT)}
            display={easeBonusText}
            valueText={easeBonusText}
            onChange={(value) => updateSetting('easeBonus', value / PERCENT)}
          />
          <SliderRow
            id={`${idPrefix}-interval`}
            label={t('srs.difficulty.intervalMultiplier')}
            description={t('srs.difficulty.intervalMultiplierDescription')}
            min={50}
            max={200}
            value={Math.round(settings.intervalMultiplier * PERCENT)}
            display={t('settings.srsPage.multiplier', { value: multiplierFormat.format(settings.intervalMultiplier) })}
            valueText={t('settings.srsPage.multiplier', { value: multiplierFormat.format(settings.intervalMultiplier) })}
            onChange={(value) => updateSetting('intervalMultiplier', value / PERCENT)}
          />
          <SliderRow
            id={`${idPrefix}-lapse`}
            label={t('srs.difficulty.lapseInterval')}
            description={t('srs.difficulty.lapseIntervalDescription')}
            min={0}
            max={100}
            value={Math.round(settings.lapseNewInterval * PERCENT)}
            display={percentFormat.format(settings.lapseNewInterval)}
            valueText={percentFormat.format(settings.lapseNewInterval)}
            onChange={(value) => updateSetting('lapseNewInterval', value / PERCENT)}
          />
        </Section>

        {/* Review options */}
        <Section id={`${idPrefix}-options`} icon={<IoVolumeHigh />} title={t('srs.options.title')}>
          {renderToggleRow('autoplayAudio', t('srs.options.autoplayAudio'), t('srs.options.autoplayAudioDescription'))}
          {renderToggleRow('showReadingHints', t('srs.options.showReadingHints'), t('srs.options.readingHintsDescription'))}
          <SliderRow
            id={`${idPrefix}-accuracy`}
            label={t('srs.options.accuracy')}
            description={t('srs.options.accuracyDescription', { value: Math.round(settings.requiredAccuracy * PERCENT) })}
            min={60}
            max={100}
            value={Math.round(settings.requiredAccuracy * PERCENT)}
            display={percentFormat.format(settings.requiredAccuracy)}
            valueText={percentFormat.format(settings.requiredAccuracy)}
            onChange={(value) => updateSetting('requiredAccuracy', value / PERCENT)}
          />
        </Section>

        {/* Notifications */}
        <Section id={`${idPrefix}-notifications`} icon={<IoNotifications />} title={t('srs.notifications.title')}>
          {renderToggleRow('reviewReminders', t('srs.notifications.reminders'), t('srs.notifications.remindersDescription'))}

          {settings.reviewReminders && (
            <>
              <div className={settingsStyles.row}>
                <div className={settingsStyles.rowInfo}>
                  <label htmlFor={`${idPrefix}-reminder-time`} className={settingsStyles.rowLabel}>
                    {t('srs.notifications.reminderTime')}
                  </label>
                  <span className={settingsStyles.rowDescription}>{t('srs.notifications.reminderTimeDescription')}</span>
                </div>
                <div className={settingsStyles.rowControl}>
                  <input
                    id={`${idPrefix}-reminder-time`}
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) => updateSetting('reminderTime', e.target.value)}
                    className={styles.timeInput}
                  />
                </div>
              </div>

              <SliderRow
                id={`${idPrefix}-reminder-threshold`}
                label={t('srs.notifications.reminderThreshold')}
                description={t('srs.notifications.reminderThresholdDescription')}
                min={1}
                max={50}
                value={settings.reminderThreshold}
                display={settings.reminderThreshold}
                valueText={String(settings.reminderThreshold)}
                onChange={(value) => updateSetting('reminderThreshold', value)}
              />
            </>
          )}
        </Section>

        <div className={styles.actions}>
          <Button onClick={handleReset} variant="ghost">
            <IoRefresh aria-hidden="true" /> {t('srs.actions.reset')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {saved ? <IoCheckmarkCircle aria-hidden="true" /> : <IoSave aria-hidden="true" />}
            {saved ? t('srs.actions.saved') : t('srs.actions.save')}
          </Button>
          <span className={styles.srOnly} role="status" aria-live="polite">
            {saved ? t('srs.actions.saved') : ''}
          </span>
        </div>
      </div>
    </Container>
  );
}
