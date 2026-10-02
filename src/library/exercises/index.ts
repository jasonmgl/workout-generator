/**
 * Le catalogue intégré : la structure de toutes les fiches, fichier par fichier.
 */
import type { ExerciseDefinition } from '../types';
import { HORIZONTAL_PUSH } from './horizontal-push';
import { SHOULDERS } from './shoulders';
import { PULL } from './pull';
import { ARMS } from './arms';
import { SQUAT_LUNGE } from './squat-lunge';
import { HINGE } from './hinge';
import { CORE } from './core';
import { CONDITIONING } from './conditioning';
import { MOBILITY } from './mobility';
import { STRETCH } from './stretch';
import { SKILLS } from './skills';

export const CATALOG: readonly ExerciseDefinition[] = [
    ...HORIZONTAL_PUSH,
    ...SHOULDERS,
    ...PULL,
    ...ARMS,
    ...SQUAT_LUNGE,
    ...HINGE,
    ...CORE,
    ...CONDITIONING,
    ...MOBILITY,
    ...STRETCH,
    ...SKILLS,
];

export const CATALOG_BY_FILE: Readonly<Record<string, readonly ExerciseDefinition[]>> = {
    'horizontal-push': HORIZONTAL_PUSH,
    'shoulders': SHOULDERS,
    'pull': PULL,
    'arms': ARMS,
    'squat-lunge': SQUAT_LUNGE,
    'hinge': HINGE,
    'core': CORE,
    'conditioning': CONDITIONING,
    'mobility': MOBILITY,
    'stretch': STRETCH,
    'skills': SKILLS,
};
