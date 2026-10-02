/**
 * Le texte français de toutes les fiches du catalogue intégré.
 */
import type { ExerciseText } from '../../../library/types';
import { HORIZONTAL_PUSH_FR } from './horizontal-push';
import { SHOULDERS_FR } from './shoulders';
import { PULL_FR } from './pull';
import { ARMS_FR } from './arms';
import { SQUAT_LUNGE_FR } from './squat-lunge';
import { HINGE_FR } from './hinge';
import { CORE_FR } from './core';
import { CONDITIONING_FR } from './conditioning';
import { MOBILITY_FR } from './mobility';
import { STRETCH_FR } from './stretch';
import { SKILLS_FR } from './skills';

export const EXERCISES_FR: Readonly<Record<string, ExerciseText>> = {
    ...HORIZONTAL_PUSH_FR,
    ...SHOULDERS_FR,
    ...PULL_FR,
    ...ARMS_FR,
    ...SQUAT_LUNGE_FR,
    ...HINGE_FR,
    ...CORE_FR,
    ...CONDITIONING_FR,
    ...MOBILITY_FR,
    ...STRETCH_FR,
    ...SKILLS_FR,
};
