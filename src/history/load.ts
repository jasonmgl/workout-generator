/**
 * La charge d'entraînement : combien on s'entraîne, depuis quand sans repos,
 * et si la semaine monte trop vite par rapport à l'habitude.
 *
 * La charge d'une séance est sa durée multipliée par son effort perçu
 * (méthode de Foster, publique). Le rapport entre la charge des 7 derniers
 * jours et la moyenne hebdomadaire des 28 derniers dit si l'on force : une
 * semaine bien au-dessus de son habitude est celle où l'on se blesse.
 */
import { daysBetween, dayOf, hoursBetween, toHours } from '../dates';
import type { Effort, PastSession } from '../types';

/** L'effort perçu sur 10 qu'on prête à chaque cran du ressenti. */
const EFFORT_RPE: Readonly<Record<Effort, number>> = { easy: 3, right: 5, hard: 7 };

/** La durée qu'on suppose à une séance sans durée : une minute et demie par série notée, 30 minutes sinon. */
export function sessionMinutes(session: PastSession): number {
    if (session.minutes !== undefined) {
        return Math.max(0, session.minutes);
    }

    const sets = (session.exercises ?? []).reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const activities = (session.activities ?? []).reduce((sum, activity) => sum + activity.minutes, 0);

    return sets > 0 || activities > 0 ? sets * 1.5 + activities : 30;
}

/** L'effort perçu d'une séance sur 10 (5 quand on ne sait pas). */
export function sessionRpe(session: PastSession): number {
    if (session.rpe !== undefined) {
        return Math.min(10, Math.max(1, session.rpe));
    }

    return session.effort ? EFFORT_RPE[session.effort] : 5;
}

/** La charge d'une séance : minutes × effort perçu. */
export function sessionLoad(session: PastSession): number {
    return sessionMinutes(session) * sessionRpe(session);
}

export interface TrainingLoad {
    /** Les séances des 7 derniers jours (aujourd'hui compris). */
    readonly sessions7: number;
    readonly minutes7: number;
    /** Les minutes des 7 jours d'avant. */
    readonly minutesPrevious7: number;
    /** Charge des 7 derniers jours. */
    readonly acute: number;
    /** Charge hebdomadaire moyenne des 28 derniers jours. */
    readonly chronic: number;
    /** Aigu sur chronique ; absent tant qu'on n'a pas trois semaines d'historique. */
    readonly ratio?: number;
    /** Les jours d'affilée avec une séance, jusqu'à hier (ou aujourd'hui s'il y en a déjà une). */
    readonly daysWithoutRest: number;
    /** Les jours depuis la dernière séance ; absent sans historique. */
    readonly daysSinceLast?: number;
    /** Le dernier ressenti donné dans les 7 derniers jours. */
    readonly lastEffort?: Effort;
    readonly lastSessionDate?: string;
    /** Le nombre de séances connues avant aujourd'hui. */
    readonly known: number;
}

/** Les séances passées (jusqu'à `now` compris), de la plus récente à la plus ancienne. */
export function pastSessions(history: readonly PastSession[], now: string): PastSession[] {
    // Une séance du jour notée sans heure (donc à midi) compte même s'il n'est que 8 h :
    // c'est de l'historique, elle a eu lieu.
    return history
        .filter((session) => hoursBetween(session.date, now) >= 0 || dayOf(session.date) === dayOf(now))
        .sort((a, b) => toHours(b.date) - toHours(a.date));
}

export function trainingLoad(history: readonly PastSession[], now: string, restDays: readonly string[] = []): TrainingLoad {
    const sessions = pastSessions(history, now);
    const today = dayOf(now);
    const ageInDays = (session: PastSession): number => daysBetween(session.date, today);
    const within = (from: number, to: number): PastSession[] => sessions.filter((session) => ageInDays(session) >= from && ageInDays(session) <= to);
    const lastWeek = within(0, 6);
    const acute = lastWeek.reduce((sum, session) => sum + sessionLoad(session), 0);
    const month = within(0, 27);
    const chronic = month.reduce((sum, session) => sum + sessionLoad(session), 0) / 4;
    const oldest = sessions[sessions.length - 1];
    const span = oldest ? ageInDays(oldest) : 0;
    const trainedDays = new Set(sessions.map((session) => dayOf(session.date)));
    const restSet = new Set(restDays.map(dayOf));

    let daysWithoutRest = 0;

    for (let offset = trainedDays.has(today) ? 0 : 1; offset < 60; offset++) {
        const day = sessions.find((session) => ageInDays(session) === offset);

        if (!day || restSet.has(dayOf(day.date))) {
            break;
        }

        daysWithoutRest++;
    }

    const last = sessions[0];
    const lastEffort = lastWeek.find((session) => session.effort !== undefined)?.effort;

    return {
        sessions7: lastWeek.length,
        minutes7: lastWeek.reduce((sum, session) => sum + sessionMinutes(session), 0),
        minutesPrevious7: within(7, 13).reduce((sum, session) => sum + sessionMinutes(session), 0),
        acute,
        chronic,
        ...(span >= 21 && chronic > 0 ? { ratio: Math.round((acute / chronic) * 100) / 100 } : {}),
        daysWithoutRest,
        ...(last ? { daysSinceLast: ageInDays(last), lastSessionDate: last.date } : {}),
        ...(lastEffort ? { lastEffort } : {}),
        known: sessions.filter((session) => ageInDays(session) > 0).length,
    };
}
