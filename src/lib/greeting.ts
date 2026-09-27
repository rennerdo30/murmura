/** Hour boundaries (local time) for the time-of-day greeting. */
const NIGHT_END_HOUR = 5;
const MORNING_END_HOUR = 12;
const AFTERNOON_END_HOUR = 17;
const EVENING_END_HOUR = 21;

/** Translated greeting for the current local time of day. */
export function getGreeting(t: (key: string) => string, date: Date = new Date()): string {
    const hour = date.getHours();
    if (hour < NIGHT_END_HOUR) return t('dashboard.greetings.goodNight');
    if (hour < MORNING_END_HOUR) return t('dashboard.greetings.goodMorning');
    if (hour < AFTERNOON_END_HOUR) return t('dashboard.greetings.goodAfternoon');
    if (hour < EVENING_END_HOUR) return t('dashboard.greetings.goodEvening');
    return t('dashboard.greetings.goodNight');
}
