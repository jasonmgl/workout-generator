/**
 * Ce que change l'objectif : fourchettes de répétitions, séries, repos,
 * réserve, formats préférés, cardio en fin de séance.
 *
 * Les grandes lignes viennent de l'US Navy (document public) : force 3 à 5
 * séries de peu de répétitions et de longs repos, volume 3 à 6 séries de 8 à
 * 12, endurance 2 à 3 séries de 12 à 15 avec des repos courts. Les chiffres
 * exacts sont à nous. Jamais d'échec : la réserve (`rir`) ne descend pas
 * sous 1.
 */
import type { MuscleGroupId } from '../library/anatomy';
import type { BlockFormat, Goal, Level } from '../types';

export interface GoalSettings {
    /** Les répétitions visées sur un exercice de renforcement. */
    readonly reps: readonly [number, number];
    /** Les secondes visées sur une tenue (planche, chaise). */
    readonly hold: readonly [number, number];
    /** Les séries d'un exercice principal, selon le niveau. */
    readonly sets: Readonly<Record<Level, readonly [number, number]>>;
    /** Le repos entre deux séries, en secondes. */
    readonly rest: { readonly compound: number; readonly isolation: number };
    /** Les répétitions gardées en réserve. */
    readonly rir: number;
    /** Où choisir la variante par rapport à ce qu'on sait faire : +1 un cran au-dessus (force), −1 un cran en dessous (endurance). */
    readonly difficultyShift: number;
    /** Les formats du bloc principal, avec leurs chances d'être tirés. */
    readonly formats: readonly (readonly [BlockFormat, number])[];
    /** Les repos d'un circuit : entre deux exercices, entre deux tours. */
    readonly circuit: { readonly betweenItems: number; readonly betweenRounds: number };
    /** Effort et récupération d'un intervalle de cardio. */
    readonly intervals: { readonly work: number; readonly rest: number };
    /** Les chances d'un cardio en fin de séance (« finisher »), quand la forme et le temps le permettent. */
    readonly finisher: number;
    /** Les séries dures visées par semaine pour un grand groupe musculaire, selon le niveau. */
    readonly weeklySets: Readonly<Record<Level, number>>;
}

export const GOAL_SETTINGS: Readonly<Record<Goal, GoalSettings>> = {
    health: {
        reps: [8, 15],
        hold: [20, 45],
        sets: { beginner: [2, 3], intermediate: [2, 3], advanced: [3, 4], expert: [3, 4] },
        rest: { compound: 60, isolation: 45 },
        rir: 3,
        difficultyShift: 0,
        formats: [
            ['superset', 0.4],
            ['circuit', 0.35],
            ['straight', 0.15],
            ['amrap', 0.1],
        ],
        circuit: { betweenItems: 15, betweenRounds: 60 },
        intervals: { work: 30, rest: 30 },
        finisher: 0.4,
        weeklySets: { beginner: 6, intermediate: 8, advanced: 10, expert: 10 },
    },
    strength: {
        reps: [3, 8],
        hold: [10, 25],
        sets: { beginner: [2, 3], intermediate: [3, 4], advanced: [4, 5], expert: [4, 5] },
        rest: { compound: 150, isolation: 90 },
        rir: 2,
        difficultyShift: 1,
        formats: [
            ['straight', 0.7],
            ['superset', 0.15],
            ['ladder', 0.15],
        ],
        circuit: { betweenItems: 30, betweenRounds: 120 },
        intervals: { work: 20, rest: 40 },
        finisher: 0,
        weeklySets: { beginner: 6, intermediate: 9, advanced: 12, expert: 12 },
    },
    hypertrophy: {
        reps: [8, 12],
        hold: [30, 60],
        sets: { beginner: [2, 3], intermediate: [3, 4], advanced: [3, 5], expert: [4, 5] },
        rest: { compound: 90, isolation: 60 },
        rir: 2,
        difficultyShift: 0,
        formats: [
            ['superset', 0.6],
            ['straight', 0.4],
        ],
        circuit: { betweenItems: 20, betweenRounds: 90 },
        intervals: { work: 30, rest: 30 },
        finisher: 0.1,
        weeklySets: { beginner: 8, intermediate: 12, advanced: 15, expert: 18 },
    },
    endurance: {
        reps: [15, 25],
        hold: [45, 90],
        sets: { beginner: [2, 3], intermediate: [2, 3], advanced: [3, 4], expert: [3, 4] },
        rest: { compound: 45, isolation: 30 },
        rir: 3,
        difficultyShift: -1,
        formats: [
            ['circuit', 0.55],
            ['superset', 0.2],
            ['amrap', 0.15],
            ['emom', 0.1],
        ],
        circuit: { betweenItems: 10, betweenRounds: 45 },
        intervals: { work: 45, rest: 15 },
        finisher: 0.6,
        weeklySets: { beginner: 6, intermediate: 8, advanced: 10, expert: 10 },
    },
    'fat-loss': {
        reps: [12, 20],
        hold: [30, 45],
        sets: { beginner: [2, 3], intermediate: [3, 3], advanced: [3, 4], expert: [3, 4] },
        rest: { compound: 30, isolation: 20 },
        rir: 3,
        difficultyShift: -1,
        formats: [
            ['circuit', 0.55],
            ['amrap', 0.2],
            ['emom', 0.15],
            ['superset', 0.1],
        ],
        circuit: { betweenItems: 15, betweenRounds: 45 },
        intervals: { work: 40, rest: 20 },
        finisher: 0.8,
        weeklySets: { beginner: 6, intermediate: 8, advanced: 10, expert: 10 },
    },
};

/** La part de la cible hebdomadaire d'un grand groupe que vise chaque groupe : les petits en reçoivent déjà par les gros mouvements. */
export const GROUP_SHARE: Readonly<Record<MuscleGroupId, number>> = {
    chest: 1,
    back: 1,
    shoulders: 0.7,
    arms: 0.6,
    core: 0.8,
    'lower-back': 0.5,
    glutes: 0.9,
    legs: 1,
    calves: 0.5,
};
