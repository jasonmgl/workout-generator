/**
 * Le plan de la semaine : combien de séances, lesquelles, quels jours, à
 * quelle intensité, et ce que la semaine doit couvrir.
 *
 * - Deux à trois séances par groupe et par semaine, jamais deux jours de
 *   suite sur les mêmes muscles (règle de l'US Navy).
 * - Corps entier jusqu'à trois séances ; au-delà, on découpe (haut / bas,
 *   puis pousser / tirer / jambes) pour que chaque région récupère.
 * - Les jours d'entraînement sont espacés au mieux dans ceux qui sont
 *   disponibles.
 * - L'intensité ondule : une séance dure, une moyenne, une légère (le principe
 *   lourd / moyen / léger que DidIt applique déjà), jamais deux dures d'affilée.
 * - Une sortie longue à vélo ou en course n'est pas suivie ni précédée d'une
 *   séance de jambes : on échange avec une séance du haut quand c'est possible.
 *
 * Le plan ne fixe pas les exercices : la séance du jour les choisit le jour
 * venu, avec la forme du jour. Il lui donne un type, des groupes et une
 * intensité à suivre.
 */
import { MUSCLE_GROUPS, type MuscleGroupId } from '../library/anatomy';
import { addDays, dayOf, daysBetween, weekdayOf } from '../dates';
import { capacity } from '../history/progress';
import { formatSeconds } from '../i18n/format';
import { ACTIVITY_NAMES, formatDay } from '../i18n/fr/labels';
import { reason } from '../i18n/messages';
import { defaultLibrary } from '../library/index';
import type { Library } from '../library/library';
import { GOAL_SETTINGS, GROUP_SHARE } from '../session/goals';
import type { Activity, ActivityIntensity, Goal, Intensity, Level, PastSession, PlannedDay, Profile, Reason, SessionType } from '../types';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Une activité prévue dans la semaine : la sortie vélo du dimanche, le match du mercredi. */
export interface PlannedActivity extends Activity {
    readonly date: string;
}

export interface WeekInput {
    /** Le premier jour du plan ; le plan couvre sept jours à partir de lui. */
    readonly start: string;
    readonly profile?: Profile;
    readonly history?: readonly PastSession[];
    /** Les jours de la semaine où l'on peut s'entraîner (1 lundi … 7 dimanche). Tous par défaut. */
    readonly days?: readonly Weekday[];
    readonly sessionsPerWeek?: number;
    /** La durée des séances, la même chaque jour ou jour par jour. */
    readonly minutes?: number | Readonly<Partial<Record<Weekday, number>>>;
    readonly activities?: readonly PlannedActivity[];
    readonly library?: Library;
    readonly locale?: string;
}

export interface WeekDay extends PlannedDay {
    readonly weekday: Weekday;
    /** Les groupes que la séance prévue sert surtout (pour l’affichage : la séance du jour choisit elle-même). */
    readonly groups?: readonly MuscleGroupId[];
    readonly title: string;
    /** Un jour de mobilité qu'on peut sauter sans rien perdre. */
    readonly optional?: boolean;
    readonly activities: readonly PlannedActivity[];
    readonly reasons: readonly Reason[];
}

export interface WeekPlan {
    readonly start: string;
    readonly goal: Goal;
    readonly level: Level;
    readonly sessions: number;
    readonly days: readonly WeekDay[];
    /** Les séries dures visées dans la semaine, par groupe. */
    readonly targets: Readonly<Record<MuscleGroupId, number>>;
    readonly reasons: readonly Reason[];
}

/** Les séances par semaine qu'on propose quand rien n'est dit. */
const DEFAULT_SESSIONS: Readonly<Record<Level, number>> = { beginner: 3, intermediate: 3, advanced: 4, expert: 5 };

/** Le découpage selon le nombre de séances. */
export function splitFor(sessions: number, goal: Goal): SessionType[] {
    const count = Math.max(1, Math.min(7, Math.round(sessions)));
    const cardio = goal === 'fat-loss' || goal === 'endurance';
    const plain: Readonly<Record<number, SessionType[]>> = {
        1: ['full-body'],
        2: ['full-body', 'full-body'],
        3: ['full-body', 'full-body', 'full-body'],
        4: ['upper', 'lower', 'upper', 'lower'],
        5: ['upper', 'lower', 'full-body', 'upper', 'lower'],
        6: ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
        7: ['push', 'pull', 'lower', 'hiit', 'push', 'pull', 'lower'],
    };
    // Un objectif cardio prend une séance d’intervalles dès trois séances, sans perdre une région.
    const withCardio: Readonly<Record<number, SessionType[]>> = {
        3: ['full-body', 'hiit', 'full-body'],
        4: ['upper', 'lower', 'hiit', 'full-body'],
        5: ['upper', 'lower', 'hiit', 'upper', 'lower'],
        6: ['push', 'pull', 'lower', 'hiit', 'upper', 'lower'],
        7: ['push', 'pull', 'lower', 'hiit', 'upper', 'lower', 'hiit'],
    };

    return [...((cardio ? withCardio[count] : undefined) ?? plain[count]!)];
}

/** Choisir `count` jours parmi les disponibles, les plus espacés possible (la semaine est un cercle). */
export function spreadDays(available: readonly Weekday[], count: number): Weekday[] {
    const days = [...new Set(available)].sort((a, b) => a - b);

    if (count >= days.length) {
        return days;
    }

    let best: Weekday[] = days.slice(0, count);
    let bestScore = -Infinity;

    const consider = (chosen: Weekday[]): void => {
        const gaps = chosen.map((day, index) => {
            const next = chosen[(index + 1) % chosen.length]!;

            return (((next - day + 7) % 7) || 7);
        });
        const minGap = Math.min(...gaps);
        const spread = -gaps.reduce((sum, gap) => sum + (gap - 7 / chosen.length) ** 2, 0);
        const score = minGap * 100 + spread;

        if (score > bestScore) {
            bestScore = score;
            best = chosen;
        }
    };

    const walk = (from: number, chosen: Weekday[]): void => {
        if (chosen.length === count) {
            consider(chosen);
            return;
        }

        for (let index = from; index < days.length; index++) {
            walk(index + 1, [...chosen, days[index]!]);
        }
    };

    walk(0, []);

    return best;
}

const LOWER_TYPES: readonly SessionType[] = ['lower', 'full-body', 'hiit'];
const LEG_ACTIVITIES: readonly string[] = ['run', 'bike', 'hike', 'ski', 'team-sport'];

/** Une activité qui charge les jambes : assez longue ou assez dure pour compter. */
const loadsLegs = (activity: PlannedActivity): boolean =>
    LEG_ACTIVITIES.includes(activity.type) && (activity.minutes >= 60 || (activity.intensity ?? 'moderate') === 'hard');

const WAVE: readonly Intensity[] = ['hard', 'moderate', 'easy'];

const intensityOfActivity = (intensity: ActivityIntensity | undefined): Intensity => (intensity === 'hard' ? 'hard' : intensity === 'easy' ? 'easy' : 'moderate');

/** Les groupes que sert surtout un type de séance. */
const TYPE_GROUPS: Readonly<Partial<Record<SessionType, readonly MuscleGroupId[]>>> = {
    'full-body': ['legs', 'glutes', 'chest', 'back', 'core'],
    upper: ['chest', 'back', 'shoulders', 'arms'],
    lower: ['legs', 'glutes', 'calves', 'core'],
    push: ['chest', 'shoulders', 'arms'],
    pull: ['back', 'arms'],
    core: ['core', 'lower-back'],
    hiit: ['legs', 'glutes'],
};

export function planWeek(input: WeekInput): WeekPlan {
    const library = input.library ?? defaultLibrary();
    const locale = input.locale ?? 'fr';
    const profile = input.profile ?? {};
    const goal = profile.goal ?? 'health';
    const level = profile.level ?? capacity(input.history ?? [], input.start, library).level ?? 'beginner';
    const start = dayOf(input.start);
    const dates = Array.from({ length: 7 }, (_, offset) => addDays(start, offset));
    const weekdays = dates.map((date) => weekdayOf(date) as Weekday);
    const available = (input.days?.length ? input.days : weekdays).filter((day) => weekdays.includes(day));
    const wanted = Math.max(1, Math.min(7, Math.round(input.sessionsPerWeek ?? DEFAULT_SESSIONS[level])));
    const sessions = Math.min(wanted, available.length);
    const reasons: Reason[] = [];

    if (sessions < wanted) {
        reasons.push(reason('week-fewer-days', { wanted, days: available.length }, locale));
    }

    // Les jours dans l'ordre du plan (qui ne commence pas forcément un lundi).
    const order = (day: Weekday): number => weekdays.indexOf(day);
    const chosen = spreadDays(available, sessions).sort((a, b) => order(a) - order(b));
    const split = splitFor(sessions, goal);
    const activitiesOn = (date: string): PlannedActivity[] => (input.activities ?? []).filter((activity) => dayOf(activity.date) === date);
    // Une sortie longue ou dure pèse sur les jambes la veille, le jour même et le lendemain ; deux jours après aussi
    // quand elle dure deux heures ou qu'elle était dure.
    const reach = (activity: PlannedActivity): number => (activity.minutes >= 120 || activity.intensity === 'hard' ? 2 : 1);
    const legActivities = (input.activities ?? []).filter(loadsLegs);
    const legsBusy = (date: string): boolean => legActivities.some((activity) => Math.abs(daysBetween(activity.date, date)) <= (daysBetween(activity.date, date) > 0 ? reach(activity) : 1));

    // Placer les types : une séance de jambes évite les jours que charge une sortie.
    const assigned: SessionType[] = [];
    const remaining = [...split];
    const kept: string[] = [];

    for (const day of chosen) {
        const date = dates[order(day)]!;
        const preferUpper = legsBusy(date);
        const index = preferUpper ? remaining.findIndex((type) => !LOWER_TYPES.includes(type)) : 0;
        const type = remaining.splice(index >= 0 ? index : 0, 1)[0]!;

        if (preferUpper && LOWER_TYPES.includes(type)) kept.push(date);

        assigned.push(type);
    }

    // Une phrase par sortie, avec sa date et son nom.
    for (const activity of legActivities) {
        const near = chosen.map((day) => dates[order(day)]!).filter((date) => legsBusy(date) && Math.abs(daysBetween(activity.date, date)) <= reach(activity));
        const params = {
            activity: ACTIVITY_NAMES[activity.type],
            date: formatDay(dayOf(activity.date)),
            duration: formatSeconds(activity.minutes * 60),
        };

        if (near.some((date) => kept.includes(date))) reasons.push(reason('week-legs-activity-kept', params, locale));
        else if (near.length) reasons.push(reason('week-legs-activity', params, locale));
    }

    // L'ondulation : dur, moyen, léger, sans deux séances dures à la suite.
    const intensities: Intensity[] = assigned.map((_, index) => WAVE[index % WAVE.length]!);

    // Un fractionné n'est jamais « léger » : on échange avec une voisine, ou il passe en moyen.
    assigned.forEach((type, index) => {
        if (type !== 'hiit' || intensities[index] !== 'easy') return;

        const neighbour = [index - 1, index + 1].find((other) => other >= 0 && other < assigned.length && assigned[other] !== 'hiit');

        if (neighbour !== undefined) {
            intensities[index] = intensities[neighbour]!;
            intensities[neighbour] = 'easy';
        } else {
            intensities[index] = 'moderate';
        }
    });

    // Une sortie dure est déjà la séance dure de la semaine pour les jambes : la séance de jambes voisine est légère.
    assigned.forEach((type, index) => {
        const date = dates[order(chosen[index]!)]!;

        if (LOWER_TYPES.includes(type) && legActivities.some((activity) => activity.intensity === 'hard' && Math.abs(daysBetween(activity.date, date)) <= 2)) {
            intensities[index] = 'easy';
        }
    });

    for (let index = 1; index < intensities.length; index++) {
        const gap = order(chosen[index]!) - order(chosen[index - 1]!);

        if (gap === 1 && intensities[index] === 'hard' && intensities[index - 1] === 'hard') {
            intensities[index] = 'moderate';
        }
    }

    const activityTitle = (activity: PlannedActivity): string =>
        reason('week-day-activity', { activity: ACTIVITY_NAMES[activity.type], duration: formatSeconds(activity.minutes * 60) }, locale).text;

    const minutesFor = (day: Weekday): number =>
        typeof input.minutes === 'number' ? input.minutes : (input.minutes?.[day] ?? (goal === 'strength' || goal === 'hypertrophy' ? 45 : 30));

    // Un jour de mobilité facultatif entre deux séances, pour qui en a peu.
    const restDays = weekdays.filter((day) => !chosen.includes(day));
    const optionalDay = sessions <= 3 && restDays.length >= 3 ? restDays[Math.floor(restDays.length / 2)] : undefined;

    const days: WeekDay[] = dates.map((date, index) => {
        const weekday = weekdays[index]!;
        const position = chosen.indexOf(weekday);
        const activities = activitiesOn(date);

        // Une séance de jambes qu'on n'a pas pu déplacer, le jour même d'une sortie dure ou longue : la sortie suffit,
        // la séance devient une mobilité facultative.
        const sameDaySortie = activities.some((activity) => loadsLegs(activity));

        if (position >= 0 && sameDaySortie && LOWER_TYPES.includes(assigned[position]!)) {
            return {
                date,
                weekday,
                kind: 'active-recovery',
                type: 'mobility',
                intensity: 'easy',
                minutes: 15,
                optional: true,
                title: [reason('week-day-mobility', {}, locale).text, ...activities.map((activity) => activityTitle(activity))].join(' · '),
                activities,
                reasons: [reason('week-activity-replaces', {}, locale)],
            };
        }

        if (position >= 0) {
            const type = assigned[position]!;
            const intensity = intensities[position]!;

            return {
                date,
                weekday,
                kind: 'training',
                type,
                groups: [...(TYPE_GROUPS[type] ?? [])],
                intensity,
                minutes: minutesFor(weekday),
                title: [
                    reason('week-day-training', { type: reason(`session-${type}`, {}, locale).text, intensity: reason(`intensity-name-${intensity}`, {}, locale).text }, locale).text,
                    ...activities.map((activity) => activityTitle(activity)),
                ].join(' · '),
                activities,
                reasons: [reason(`week-wave-${intensity}`, {}, locale)],
            };
        }

        if (activities.length) {
            const hardest = activities.map((activity) => intensityOfActivity(activity.intensity)).sort((a, b) => WAVE.indexOf(a) - WAVE.indexOf(b))[0]!;

            const title = activities.map((activity) => activityTitle(activity)).join(', ');

            return { date, weekday, kind: 'activity', intensity: hardest, title, activities, reasons: [] };
        }

        if (weekday === optionalDay) {
            return {
                date,
                weekday,
                kind: 'active-recovery',
                type: 'mobility',
                intensity: 'easy',
                minutes: 15,
                optional: true,
                title: reason('week-day-mobility', {}, locale).text,
                activities,
                reasons: [reason('week-optional', {}, locale)],
            };
        }

        return { date, weekday, kind: 'rest', title: reason('week-day-rest', {}, locale).text, activities, reasons: [] };
    });

    const settings = GOAL_SETTINGS[goal];
    const targets = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, Math.round(settings.weeklySets[level] * GROUP_SHARE[group])])) as Record<MuscleGroupId, number>;
    const frequency = MUSCLE_GROUPS.filter((group) => ['chest', 'back', 'legs', 'glutes'].includes(group)).map(
        (group) => assigned.filter((type) => (TYPE_GROUPS[type] ?? []).includes(group)).length,
    );

    // La phrase de découpage décrit les séances réellement placées, fractionné compris.
    const names = assigned.map((type) => reason(`session-${type}`, {}, locale).text.toLowerCase());

    reasons.unshift(reason('week-split', { count: sessions, types: names.join(', ') }, locale));

    if (sessions >= 7) reasons.push(reason('week-split-7-warning', {}, locale));

    if (sessions >= 2 && Math.min(...frequency) < 2) {
        reasons.push(reason('week-low-frequency', {}, locale));
    }

    return { start, goal, level, sessions, days, targets, reasons };
}

/** Le jour du plan qui correspond à une date, pour le passer à la séance du jour. */
export function plannedDayFor(plan: WeekPlan, date: string): PlannedDay | undefined {
    const day = plan.days.find((entry) => daysBetween(entry.date, date) === 0);

    if (!day) {
        return undefined;
    }

    return {
        date: day.date,
        kind: day.kind,
        ...(day.type ? { type: day.type } : {}),
        ...(day.intensity ? { intensity: day.intensity } : {}),
        ...(day.minutes ? { minutes: day.minutes } : {}),
    };
}
