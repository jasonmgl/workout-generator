/**
 * La fatigue de chaque muscle, d'après les séances et les activités passées.
 *
 * Chaque série laisse une trace sur les muscles qu'elle a fait travailler :
 * une série entière pour un muscle principal, une demi-série pour un muscle
 * qui aide, un peu pour ceux qui stabilisent. Cette trace s'efface avec le
 * temps, d'autant plus vite que le muscle est petit : un mollet s'en remet
 * plus vite qu'un quadriceps. La récupération va de 0 (épuisé) à 1 (frais).
 *
 * C'est ce qui remplace la règle « pas les mêmes zones que la veille » de
 * DidIt : on voit aussi l'avant-veille, l'intensité, et le vélo du dimanche.
 */
import { MUSCLE_GROUPS, MUSCLE_INFO, MUSCLES, musclesOfAll, type MuscleGroupId, type MuscleId, type MuscleSize } from '../library/anatomy';
import type { Library } from '../library/library';
import type { ExerciseKind } from '../library/types';
import { daysBetween, hoursBetween } from '../dates';
import type { Effort, PastSession, PerformedSet, ReadinessInput } from '../types';
import { activityLoad } from './activities';
import { pastSessions, sessionMinutes } from './load';
import { resolveHistory } from './resolve';

/** Le temps (en heures) au bout duquel la trace d'une série tombe à 37 % : 30 h pour un gros muscle, 18 h pour un petit. */
export const RECOVERY_HOURS: Readonly<Record<MuscleSize, number>> = { large: 30, medium: 24, small: 18 };

/** La fatigue résiduelle qui fait tomber la récupération à 37 %. */
const FATIGUE_SCALE = 4;

/** Ce que pèse une série selon la sorte d'exercice : un étirement ne fatigue pas. */
const KIND_WEIGHT: Readonly<Record<ExerciseKind, number>> = {
    strength: 1,
    power: 0.8,
    skill: 0.6,
    conditioning: 0.5,
    mobility: 0.1,
    stretch: 0,
    breathing: 0,
};

const ROLE_WEIGHT = { primary: 1, secondary: 0.5, stabilizers: 0.15 } as const;

const EFFORT_WEIGHT: Readonly<Record<Effort, number>> = { easy: 0.8, right: 1, hard: 1.15 };

/** Au-delà de 14 jours, une séance ne pèse plus rien sur la fatigue. */
const WINDOW_DAYS = 14;

export interface MuscleState {
    /** La fatigue qui reste, en équivalents de séries dures. */
    readonly residual: number;
    /** De 0 (épuisé) à 1 (frais), courbatures déclarées comprises. */
    readonly recovery: number;
    /** La dernière séance qui l'a fait travailler comme muscle principal ou secondaire. */
    readonly lastWorked?: string;
}

export interface GroupState {
    /** La récupération moyenne du groupe, les gros muscles comptant davantage. */
    readonly recovery: number;
    /** Les séries dures des 7 derniers jours : 1 quand un muscle du groupe est principal, ½ quand il aide. */
    readonly weeklySets: number;
    readonly lastWorked?: string;
}

export interface BodyState {
    readonly muscles: Readonly<Record<MuscleId, MuscleState>>;
    readonly groups: Readonly<Record<MuscleGroupId, GroupState>>;
    /** Les exercices de l'historique que la bibliothèque ne connaît pas (ignorés). */
    readonly unknownExercises: readonly string[];
}

/** Le poids d'une série selon la réserve déclarée, ou à défaut le ressenti de la séance. */
function setWeight(set: PerformedSet, session: PastSession): number {
    if (set.rir !== undefined) {
        if (set.rir <= 0) return 1.2;
        if (set.rir <= 1) return 1.1;
        if (set.rir <= 2) return 1;
        if (set.rir <= 3) return 0.85;

        return 0.6;
    }

    if (session.rpe !== undefined) {
        return Math.min(1.2, Math.max(0.5, session.rpe / 7));
    }

    return session.effort ? EFFORT_WEIGHT[session.effort] : 1;
}

const SIZE_WEIGHT: Readonly<Record<MuscleSize, number>> = { large: 3, medium: 2, small: 1 };

/** L'état de chaque muscle et de chaque groupe à l'instant `now`. */
export function bodyState(given: readonly PastSession[], now: string, library: Library, readiness: ReadinessInput = {}): BodyState {
    const history = resolveHistory(given, library);
    const residual = Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0])) as Record<MuscleId, number>;
    const lastWorked: Partial<Record<MuscleId, string>> = {};
    const weeklySets = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroupId, number>;
    const groupLast: Partial<Record<MuscleGroupId, string>> = {};
    const unknown = new Set<string>();

    const touch = (muscle: MuscleId, date: string): void => {
        lastWorked[muscle] ??= date;
        groupLast[MUSCLE_INFO[muscle].group] ??= date;
    };

    for (const session of pastSessions(history, now)) {
        const days = daysBetween(session.date, now);

        if (days > WINDOW_DAYS) {
            continue;
        }

        const hours = Math.max(0, hoursBetween(session.date, now));
        const decay = (muscle: MuscleId): number => Math.exp(-hours / RECOVERY_HOURS[MUSCLE_INFO[muscle].size]);

        for (const performed of session.exercises ?? []) {
            const definition = library.find(performed.exercise);

            if (!definition) {
                unknown.add(performed.exercise);
                continue;
            }

            const kindWeight = KIND_WEIGHT[definition.kind];

            for (const set of performed.sets) {
                const weight = setWeight(set, session) * kindWeight;

                for (const role of ['primary', 'secondary', 'stabilizers'] as const) {
                    for (const muscle of definition.muscles[role] ?? []) {
                        residual[muscle] += weight * ROLE_WEIGHT[role] * decay(muscle);

                        if (role !== 'stabilizers' && kindWeight >= 0.5) {
                            touch(muscle, session.date);
                        }
                    }
                }

                if (days <= 6 && kindWeight >= 0.6) {
                    const primaryGroups = new Set(definition.muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group));
                    const helperGroups = new Set((definition.muscles.secondary ?? []).map((muscle) => MUSCLE_INFO[muscle].group));

                    for (const group of MUSCLE_GROUPS) {
                        if (primaryGroups.has(group)) weeklySets[group] += 1;
                        else if (helperGroups.has(group)) weeklySets[group] += 0.5;
                    }
                }
            }
        }

        for (const activity of session.activities ?? []) {
            for (const [muscle, load] of Object.entries(activityLoad(activity.type, activity.minutes, activity.intensity)) as [MuscleId, number][]) {
                residual[muscle] += load * decay(muscle);

                if (load >= 0.2) {
                    touch(muscle, session.date);
                }
            }
        }

        if (session.worked?.length) {
            const minutes = session.exercises?.length || session.activities?.length ? 0 : sessionMinutes(session);
            const muscles = musclesOfAll(session.worked);

            for (const muscle of muscles) {
                residual[muscle] += (minutes / 10) * 0.3 * decay(muscle);
                touch(muscle, session.date);
            }
        }
    }

    const soreness = sorenessByMuscle(readiness);
    const muscles = {} as Record<MuscleId, MuscleState>;

    for (const muscle of MUSCLES) {
        const fromHistory = Math.exp(-residual[muscle] / FATIGUE_SCALE);
        const fromSoreness = 1 - 0.25 * (soreness[muscle] ?? 0);
        const worked = lastWorked[muscle];

        muscles[muscle] = {
            residual: Math.round(residual[muscle] * 100) / 100,
            recovery: Math.round(Math.min(fromHistory, fromSoreness) * 1000) / 1000,
            ...(worked ? { lastWorked: worked } : {}),
        };
    }

    const groups = {} as Record<MuscleGroupId, GroupState>;

    for (const group of MUSCLE_GROUPS) {
        const members = MUSCLES.filter((muscle) => MUSCLE_INFO[muscle].group === group);
        const totalWeight = members.reduce((sum, muscle) => sum + SIZE_WEIGHT[MUSCLE_INFO[muscle].size], 0);
        const recovery = members.reduce((sum, muscle) => sum + muscles[muscle].recovery * SIZE_WEIGHT[MUSCLE_INFO[muscle].size], 0) / totalWeight;
        const worked = groupLast[group];

        groups[group] = {
            recovery: Math.round(recovery * 1000) / 1000,
            weeklySets: Math.round(weeklySets[group] * 10) / 10,
            ...(worked ? { lastWorked: worked } : {}),
        };
    }

    return { muscles, groups, unknownExercises: [...unknown] };
}

/**
 * Les courbatures déclarées, muscle par muscle, de 0 à 3. Une courbature
 * générale (`soreness` 4 ou 5) touche tout le corps un peu.
 */
export function sorenessByMuscle(readiness: ReadinessInput): Partial<Record<MuscleId, number>> {
    const levels: Partial<Record<MuscleId, number>> = {};
    const general = readiness.soreness !== undefined && readiness.soreness >= 4 ? readiness.soreness - 3 : 0;

    if (general > 0) {
        for (const muscle of MUSCLES) {
            levels[muscle] = general;
        }
    }

    for (const entry of readiness.sore ?? []) {
        for (const muscle of musclesOfAll([entry.target])) {
            levels[muscle] = Math.max(levels[muscle] ?? 0, entry.level);
        }
    }

    return levels;
}
