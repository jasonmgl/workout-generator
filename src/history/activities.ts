/**
 * Ce qu'une activité hors séance fait travailler. Une sortie vélo d'une heure
 * fatigue les cuisses : le moteur doit le savoir pour ne pas proposer des
 * squats le lendemain.
 *
 * Les chiffres sont des équivalents de séries dures par tranche de 10 minutes
 * à intensité modérée : 10 minutes de course valent une demi-série de
 * quadriceps et un peu plus pour les mollets. Ce sont des ordres de grandeur
 * à nous, réglés pour qu'une heure d'effort pèse comme une bonne séance sur
 * les muscles qu'elle sollicite.
 */
import type { MuscleId } from '../library/anatomy';
import type { ActivityIntensity, ActivityType } from '../types';

export const ACTIVITY_LOAD: Readonly<Record<ActivityType, Readonly<Partial<Record<MuscleId, number>>>>> = {
    run: { quads: 0.5, hamstrings: 0.4, 'glute-max': 0.4, gastrocnemius: 0.6, soleus: 0.6, 'hip-flexors': 0.3, tibialis: 0.2 },
    walk: { gastrocnemius: 0.15, soleus: 0.15, quads: 0.1, 'glute-max': 0.1 },
    hike: { quads: 0.35, 'glute-max': 0.3, gastrocnemius: 0.3, soleus: 0.3, hamstrings: 0.2 },
    bike: { quads: 0.6, 'glute-max': 0.4, hamstrings: 0.2, gastrocnemius: 0.2, soleus: 0.2 },
    swim: { lats: 0.5, 'front-delts': 0.3, 'side-delts': 0.2, 'rear-delts': 0.2, triceps: 0.3, pecs: 0.2, abs: 0.1 },
    row: { lats: 0.4, 'mid-traps': 0.3, rhomboids: 0.3, quads: 0.3, 'glute-max': 0.3, hamstrings: 0.2, erectors: 0.2, biceps: 0.2 },
    climb: { 'forearm-flexors': 0.8, lats: 0.5, biceps: 0.4, brachialis: 0.4, 'mid-traps': 0.2, abs: 0.1 },
    ski: { quads: 0.7, 'glute-max': 0.4, adductors: 0.3, hamstrings: 0.2 },
    'team-sport': { quads: 0.4, hamstrings: 0.4, gastrocnemius: 0.4, soleus: 0.3, 'glute-max': 0.3, adductors: 0.3 },
    racket: { 'forearm-flexors': 0.3, 'forearm-extensors': 0.3, 'front-delts': 0.2, 'rotator-cuff': 0.2, gastrocnemius: 0.3, quads: 0.2, obliques: 0.2 },
    combat: { 'front-delts': 0.3, pecs: 0.2, triceps: 0.2, obliques: 0.3, gastrocnemius: 0.3, quads: 0.2 },
    yoga: { abs: 0.05, 'glute-max': 0.05, quads: 0.05, 'front-delts': 0.05 },
    dance: { gastrocnemius: 0.3, soleus: 0.2, quads: 0.2, 'glute-max': 0.2 },
    other: {},
};

/** L'intensité multiplie la charge : une sortie facile pèse moins, une course dure davantage. */
export const ACTIVITY_INTENSITY: Readonly<Record<ActivityIntensity, number>> = { easy: 0.6, moderate: 1, hard: 1.5 };

/** La charge d'une activité sur chaque muscle, en équivalents de séries dures. */
export function activityLoad(type: ActivityType, minutes: number, intensity: ActivityIntensity = 'moderate'): Partial<Record<MuscleId, number>> {
    const factor = (Math.max(0, minutes) / 10) * ACTIVITY_INTENSITY[intensity];
    const load: Partial<Record<MuscleId, number>> = {};

    for (const [muscle, perTenMinutes] of Object.entries(ACTIVITY_LOAD[type]) as [MuscleId, number][]) {
        load[muscle] = perTenMinutes * factor;
    }

    return load;
}
