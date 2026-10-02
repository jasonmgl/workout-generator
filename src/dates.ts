/**
 * Les dates du moteur sont des textes ISO : « 2026-10-02 » pour un jour,
 * « 2026-10-02T18:30 » ou « 2026-10-02T18:30:00Z » pour un instant.
 *
 * Le moteur ne lit jamais l'horloge : « aujourd'hui » lui est toujours donné.
 * Il ne connaît pas non plus de fuseau : un instant sans heure est pris à
 * midi, et tout se compte en heures écoulées entre deux instants, ce qui
 * suffit pour savoir si un muscle a eu le temps de récupérer.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME = /T(\d{2}):(\d{2})(?::(\d{2}))?/;

/** Un instant en heures depuis l'époque Unix. Lève une erreur sur un texte qui n'est pas une date. */
export function toHours(date: string): number {
    const day = DAY.exec(date);

    if (!day) {
        throw new Error(`Date illisible : « ${date} » (attendu : AAAA-MM-JJ)`);
    }

    const time = TIME.exec(date);
    const hours = time ? Number(time[1]) + Number(time[2]) / 60 + Number(time[3] ?? 0) / 3600 : 12;
    const milliseconds = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));

    if (Number.isNaN(milliseconds)) {
        throw new Error(`Date illisible : « ${date} »`);
    }

    return milliseconds / 3_600_000 + hours;
}

/** Le numéro du jour depuis l'époque Unix (l'heure est ignorée). */
export function toDayNumber(date: string): number {
    return Math.floor((toHours(date.slice(0, 10)) - 12) / 24);
}

/** Le jour « AAAA-MM-JJ » d'un numéro de jour. */
export function fromDayNumber(day: number): string {
    return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Le jour seul d'une date ou d'un instant. */
export function dayOf(date: string): string {
    return fromDayNumber(toDayNumber(date));
}

/** Les heures écoulées de `from` à `to` (négatif si `from` est après `to`). */
export function hoursBetween(from: string, to: string): number {
    return toHours(to) - toHours(from);
}

/** Les jours entiers de `from` à `to`, d'après le calendrier : hier soir à ce matin, c'est 1. */
export function daysBetween(from: string, to: string): number {
    return toDayNumber(to) - toDayNumber(from);
}

/** Le jour décalé de `days` jours. */
export function addDays(date: string, days: number): string {
    return fromDayNumber(toDayNumber(date) + days);
}

/** Le jour de la semaine, de 1 (lundi) à 7 (dimanche), comme l'ISO. */
export function weekdayOf(date: string): number {
    // Le 1er janvier 1970 était un jeudi.
    return ((((toDayNumber(date) + 3) % 7) + 7) % 7) + 1;
}

/** Le lundi de la semaine d'une date. */
export function mondayOf(date: string): string {
    return addDays(date, 1 - weekdayOf(date));
}
