/**
 * workout-generator : une bibliothèque d'exercices et un générateur de
 * séances. Il ne sait rien de l'application qui l'utilise : pas de Vue, pas
 * de Laravel, aucune dépendance.
 */
export * from './library/index';
export { Random, seedFrom } from './random';
export { addDays, dayOf, daysBetween, fromDayNumber, hoursBetween, mondayOf, toDayNumber, toHours, weekdayOf } from './dates';
export { format, formatSeconds, normalize } from './i18n/format';
export type { Params } from './i18n/format';
