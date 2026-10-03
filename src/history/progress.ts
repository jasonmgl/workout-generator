/**
 * Ce qu'on a déjà fait sur chaque exercice, et jusqu'où l'on sait aller dans
 * chaque famille de progression.
 *
 * La capacité d'une famille, c'est la variante la plus dure qu'on a réussie
 * récemment, c'est-à-dire tenue au moins jusqu'au bas de sa fourchette
 * habituelle (cinq pompes archer, vingt secondes de planche). C'est elle qui
 * dit où reprendre : pas la peine de proposer des pompes contre un mur à qui
 * enchaîne les pompes déclinées.
 */
import { daysBetween } from '../dates';
import type { Library } from '../library/library';
import type { ExerciseDefinition, Measure, MovementPattern } from '../library/types';
import type { Effort, Level, PastSession, PerformedSet } from '../types';
import { pastSessions } from './load';
import { resolveHistory } from './resolve';

/** Au-delà de 90 jours, une performance ne dit plus grand-chose de la forme actuelle. */
const WINDOW_DAYS = 90;

export interface ExercisePerformance {
    readonly date: string;
    readonly sets: readonly PerformedSet[];
    /** La meilleure série (répétitions, secondes ou mètres selon la fiche). */
    readonly best: number;
    /** Le total de la séance sur cet exercice : c'est lui qu'on compare d'une fois sur l'autre. */
    readonly total: number;
    /** La charge la plus lourde utilisée, en kilos. */
    readonly loadKg?: number;
    /** La plus petite réserve déclarée (0 : une série à l'échec). */
    readonly minRir?: number;
    /** Le ressenti de toute la séance : une application qui ne note pas la réserve série par série dit au moins « dure ». */
    readonly effort?: Effort;
}

/** Une performance qui a coincé : une série à l'échec, ou une séance ressentie comme dure. */
export const struggledOn = (performance: ExercisePerformance): boolean => performance.minRir === 0 || performance.effort === 'hard';

/** La valeur d'une série dans l'unité de la fiche. */
export function valueOf(set: PerformedSet, measure: Measure): number {
    if (measure === 'time') return set.seconds ?? 0;
    if (measure === 'distance') return set.meters ?? 0;

    return set.reps ?? 0;
}

/** Les fois où l'exercice a été fait, de la plus récente à la plus ancienne (90 jours au plus). */
export function performancesOf(history: readonly PastSession[], definition: ExerciseDefinition, now: string): ExercisePerformance[] {
    const result: ExercisePerformance[] = [];

    for (const session of pastSessions(history, now)) {
        if (daysBetween(session.date, now) > WINDOW_DAYS) {
            continue;
        }

        for (const performed of session.exercises ?? []) {
            if (performed.exercise !== definition.id || performed.sets.length === 0) {
                continue;
            }

            const values = performed.sets.map((set) => valueOf(set, definition.measure));
            const loads = performed.sets.map((set) => set.loadKg ?? 0).filter((load) => load > 0);
            const reserves = performed.sets.map((set) => set.rir).filter((rir): rir is number => rir !== undefined);

            result.push({
                date: session.date,
                sets: performed.sets,
                best: Math.max(...values),
                total: values.reduce((sum, value) => sum + value, 0),
                ...(loads.length ? { loadKg: Math.max(...loads) } : {}),
                ...(reserves.length ? { minRir: Math.min(...reserves) } : {}),
                ...(session.effort ? { effort: session.effort } : {}),
            });
        }
    }

    return result;
}

/** Une performance réussie : au moins une série au bas de la fourchette habituelle de la fiche. */
export function succeeded(performance: ExercisePerformance, definition: ExerciseDefinition): boolean {
    return performance.best >= definition.range[0];
}

export interface Capacity {
    /** La difficulté la plus haute réussie, par famille. */
    readonly families: Readonly<Record<string, number>>;
    /** La difficulté la plus haute réussie, par schéma de mouvement. */
    readonly patterns: Readonly<Partial<Record<MovementPattern, number>>>;
    /** Le niveau qu'on en déduit ; absent sans historique de renforcement. */
    readonly level?: Level;
}

/** Les difficultés de départ quand on ne sait rien d'une famille, selon le niveau. */
export const LEVEL_DIFFICULTY: Readonly<Record<Level, number>> = { beginner: 2, intermediate: 4, advanced: 6, expert: 8 };

/** Le niveau qui correspond à une difficulté maîtrisée. */
export function levelFor(difficulty: number): Level {
    if (difficulty <= 2.5) return 'beginner';
    if (difficulty <= 4.5) return 'intermediate';
    if (difficulty <= 6.5) return 'advanced';

    return 'expert';
}

export function capacity(given: readonly PastSession[], now: string, library: Library): Capacity {
    const history = resolveHistory(given, library);
    const families: Record<string, number> = {};
    const patterns: Partial<Record<MovementPattern, number>> = {};

    for (const session of pastSessions(history, now)) {
        if (daysBetween(session.date, now) > WINDOW_DAYS) {
            continue;
        }

        for (const performed of session.exercises ?? []) {
            const definition = library.find(performed.exercise);

            if (!definition || performed.sets.length === 0) {
                continue;
            }

            const best = Math.max(...performed.sets.map((set) => valueOf(set, definition.measure)));

            if (best < definition.range[0]) {
                continue;
            }

            families[definition.family] = Math.max(families[definition.family] ?? 0, definition.difficulty);
            patterns[definition.pattern] = Math.max(patterns[definition.pattern] ?? 0, definition.difficulty);
        }
    }

    const strengthFamilies = Object.entries(families)
        .filter(([family]) => library.family(family).some((definition) => definition.kind === 'strength'))
        .map(([, difficulty]) => difficulty)
        .sort((a, b) => a - b);

    if (strengthFamilies.length === 0) {
        return { families, patterns };
    }

    const middle = Math.floor(strengthFamilies.length / 2);
    const median = strengthFamilies.length % 2 ? strengthFamilies[middle]! : (strengthFamilies[middle - 1]! + strengthFamilies[middle]!) / 2;

    return { families, patterns, level: levelFor(median) };
}
