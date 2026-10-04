/**
 * Les gabarits de séance : la liste des places à remplir, dans l'ordre où on
 * les remplit. Une place dit quels schémas de mouvement la remplissent ;
 * c'est le choix de l'exercice qui décide lequel, selon le matériel, la
 * fatigue et le niveau.
 *
 * Les places de base viennent d'abord, les places en plus ensuite, quand le
 * temps le permet. Un corps entier, c'est une flexion de jambes, une
 * poussée, une charnière, un tirage et du gainage : chaque grand groupe a sa
 * part, et les groupes opposés (pousser / tirer) se répondent.
 */
import type { MuscleGroupId, MuscleId } from '../library/anatomy';
import type { ExerciseKind, MovementPattern } from '../library/types';
import type { SessionType } from '../types';

export type SlotRole = 'main' | 'accessory' | 'core' | 'conditioning' | 'skill';

export interface Slot {
    readonly key: string;
    readonly role: SlotRole;
    readonly patterns: readonly MovementPattern[];
    readonly kinds: readonly ExerciseKind[];
    /** Les schémas de secours quand rien n'est faisable : sans rien pour tirer, on travaille au moins les omoplates. */
    readonly fallback?: readonly MovementPattern[];
    /** Les groupes que l’exercice doit faire travailler en principal : une place « tirage » sert le dos, pas les dentelés. */
    readonly groups?: readonly MuscleGroupId[];
    /** Les muscles qu’elle doit faire travailler en principal, quand le catalogue le permet (sinon, tout le schéma). */
    readonly muscles?: readonly MuscleId[];
}

const STRENGTH: readonly ExerciseKind[] = ['strength'];

/** Sans rien pour tirer (ni barre, ni table, ni élastique), le dos se travaille quand même au sol. */
const PULL_FALLBACK: readonly MovementPattern[] = ['scapular', 'trunk-extension'];
const ANY_STRENGTH: readonly ExerciseKind[] = ['strength', 'power'];
const CARDIO: readonly ExerciseKind[] = ['conditioning', 'power'];
const CORE_PATTERNS: readonly MovementPattern[] = ['anti-extension', 'anti-lateral-flexion', 'anti-rotation', 'trunk-flexion'];

const slot = (
    key: string,
    role: SlotRole,
    patterns: readonly MovementPattern[],
    kinds: readonly ExerciseKind[] = STRENGTH,
    fallback?: readonly MovementPattern[],
): Slot => ({
    key,
    role,
    patterns,
    kinds,
    ...(fallback ? { fallback } : {}),
    ...(fallback === PULL_FALLBACK ? { groups: ['back'] as const } : {}),
});

export interface Template {
    readonly base: readonly Slot[];
    readonly extras: readonly Slot[];
}

const RAW_TEMPLATES: Readonly<Record<SessionType, Template>> = {
    'full-body': {
        base: [
            slot('knee', 'main', ['squat', 'lunge']),
            slot('push', 'main', ['horizontal-push', 'vertical-push']),
            slot('hinge', 'main', ['hinge', 'knee-flexion']),
            slot('pull', 'main', ['horizontal-pull', 'vertical-pull'], STRENGTH, PULL_FALLBACK),
            slot('core', 'core', CORE_PATTERNS),
        ],
        extras: [
            slot('single-leg', 'accessory', ['lunge', 'squat']),
            slot('pull-2', 'accessory', ['vertical-pull', 'horizontal-pull']),
            slot('push-2', 'accessory', ['vertical-push', 'horizontal-push']),
            slot('calves', 'accessory', ['calf-raise']),
            slot('arms', 'accessory', ['elbow-flexion', 'elbow-extension']),
            slot('back-ext', 'core', ['trunk-extension']),
            slot('shoulders', 'accessory', ['shoulder-raise', 'scapular']),
        ],
    },
    upper: {
        // Par paires, le tirage d’abord : quand le temps manque, c’est la deuxième poussée qui saute.
        base: [
            slot('pull', 'main', ['vertical-pull', 'horizontal-pull'], STRENGTH, PULL_FALLBACK),
            slot('push', 'main', ['horizontal-push']),
            slot('pull-h', 'main', ['horizontal-pull'], STRENGTH, PULL_FALLBACK),
            slot('push-v', 'main', ['vertical-push']),
        ],
        extras: [
            slot('biceps', 'accessory', ['elbow-flexion']),
            slot('triceps', 'accessory', ['elbow-extension']),
            slot('shoulders', 'accessory', ['shoulder-raise', 'scapular']),
            slot('core', 'core', CORE_PATTERNS),
            slot('push-2', 'accessory', ['horizontal-push', 'vertical-push']),
            slot('pull-2', 'accessory', ['vertical-pull', 'horizontal-pull']),
            slot('grip', 'accessory', ['grip']),
        ],
    },
    lower: {
        base: [
            slot('knee', 'main', ['squat']),
            slot('hinge', 'main', ['hinge'], STRENGTH, ['knee-flexion', 'trunk-extension']),
            slot('single-leg', 'main', ['lunge']),
            slot('hamstrings', 'accessory', ['knee-flexion', 'hinge']),
        ],
        extras: [
            slot('calves', 'accessory', ['calf-raise']),
            slot('hips', 'accessory', ['hip-abduction', 'hip-adduction']),
            slot('core', 'core', CORE_PATTERNS),
            slot('knee-2', 'accessory', ['squat', 'lunge']),
            slot('back-ext', 'core', ['trunk-extension']),
        ],
    },
    push: {
        base: [
            slot('push', 'main', ['horizontal-push']),
            slot('push-v', 'main', ['vertical-push']),
            slot('push-2', 'accessory', ['horizontal-push', 'vertical-push']),
            slot('triceps', 'accessory', ['elbow-extension']),
        ],
        extras: [
            slot('shoulders', 'accessory', ['shoulder-raise']),
            slot('core', 'core', CORE_PATTERNS),
            slot('scapular', 'accessory', ['scapular']),
        ],
    },
    pull: {
        base: [
            slot('pull-v', 'main', ['vertical-pull'], STRENGTH, PULL_FALLBACK),
            slot('pull-h', 'main', ['horizontal-pull'], STRENGTH, PULL_FALLBACK),
            slot('pull-2', 'accessory', ['vertical-pull', 'horizontal-pull']),
            slot('biceps', 'accessory', ['elbow-flexion']),
        ],
        extras: [
            slot('rear', 'accessory', ['scapular', 'shoulder-raise']),
            slot('back-ext', 'core', ['trunk-extension']),
            slot('grip', 'accessory', ['grip', 'carry']),
            slot('core', 'core', CORE_PATTERNS),
        ],
    },
    core: {
        base: [
            slot('front', 'core', ['anti-extension']),
            slot('side', 'core', ['anti-lateral-flexion', 'anti-rotation']),
            slot('flexion', 'core', ['trunk-flexion']),
            slot('back-ext', 'core', ['trunk-extension']),
        ],
        extras: [
            slot('rotation', 'core', ['trunk-rotation', 'anti-rotation']),
            slot('front-2', 'core', ['anti-extension', 'trunk-flexion']),
            slot('carry', 'core', ['carry']),
        ],
    },
    cardio: {
        base: [
            slot('cardio', 'conditioning', ['cardio', 'locomotion'], ['conditioning']),
            slot('full', 'conditioning', ['full-body', 'jump', 'cardio'], CARDIO),
        ],
        extras: [
            slot('cardio-2', 'conditioning', ['cardio', 'locomotion', 'full-body'], CARDIO),
            slot('carry', 'conditioning', ['carry'], CARDIO),
        ],
    },
    hiit: {
        base: [
            slot('full', 'conditioning', ['full-body'], CARDIO),
            slot('legs', 'conditioning', ['jump', 'squat', 'lunge'], CARDIO),
            slot('cardio', 'conditioning', ['cardio', 'locomotion'], CARDIO),
            slot('upper', 'conditioning', ['horizontal-push', 'anti-extension', 'locomotion'], ['conditioning', 'power', 'strength']),
        ],
        extras: [
            slot('full-2', 'conditioning', ['full-body', 'jump'], CARDIO),
            slot('core', 'conditioning', ['anti-extension', 'trunk-flexion'], ['conditioning', 'strength']),
            slot('cardio-2', 'conditioning', ['cardio', 'locomotion'], CARDIO),
        ],
    },
    mobility: {
        base: [],
        extras: [],
    },
    recovery: {
        base: [],
        extras: [],
    },
    skill: {
        base: [
            slot('skill', 'skill', ['vertical-push', 'anti-extension', 'horizontal-push', 'vertical-pull', 'horizontal-pull', 'full-body'], ['skill']),
            slot('push-v', 'main', ['vertical-push']),
            slot('pull', 'main', ['vertical-pull', 'horizontal-pull'], STRENGTH, PULL_FALLBACK),
            slot('core', 'core', ['anti-extension', 'trunk-flexion']),
        ],
        extras: [
            slot('skill-2', 'skill', ['vertical-push', 'anti-extension', 'horizontal-push', 'vertical-pull', 'horizontal-pull', 'full-body'], ['skill']),
            slot('push', 'accessory', ['horizontal-push']),
            slot('scapular', 'accessory', ['scapular']),
        ],
    },
};

/**
 * Une place de flexion des jambes vidée par un genou douloureux garde du travail pour les jambes : charnière, hanches,
 * mollets. Un squat toléré (sur une chaise, assisté, genoux 1) passe avant, quand le matériel le permet : il est dans
 * les schémas de la place elle-même. Et la place vise les quadriceps : sa charnière de secours est celle qui les fait
 * travailler (le soulevé de terre sumo), quand elle est faisable.
 */
const KNEE_FALLBACK: readonly MovementPattern[] = ['hinge', 'hip-abduction', 'calf-raise'];
const KNEE: Partial<Slot> = { fallback: KNEE_FALLBACK, muscles: ['quads'] };

/**
 * Les précisions de certaines places, où qu’elles soient : les muscles qu’elles doivent servir, leurs secours, les
 * sortes d’exercices qu’elles acceptent (la charnière prend aussi le swing, explosif).
 */
const REFINEMENTS: Readonly<Record<string, Partial<Slot>>> = {
    knee: KNEE,
    'knee-2': KNEE,
    'single-leg': KNEE,
    hinge: { kinds: ANY_STRENGTH },
    push: { muscles: ['pecs', 'upper-pecs'] },
    calves: { muscles: ['gastrocnemius', 'soleus'] },
    'focus-calves': { muscles: ['gastrocnemius', 'soleus'] },
    hips: { muscles: ['glute-med', 'glute-max'] },
    carry: { kinds: ['strength', 'conditioning', 'power'] },
};

const refine = (entry: Slot): Slot => {
    const extra = REFINEMENTS[entry.key];

    return extra ? { ...entry, ...extra, fallback: entry.fallback ?? extra.fallback ?? [] } : entry;
};

const refineTemplate = (template: Template): Template => ({ base: template.base.map(refine), extras: template.extras.map(refine) });

export const TEMPLATES: Readonly<Record<SessionType, Template>> = {
    'full-body': refineTemplate(RAW_TEMPLATES['full-body']),
    upper: refineTemplate(RAW_TEMPLATES.upper),
    lower: refineTemplate(RAW_TEMPLATES.lower),
    push: refineTemplate(RAW_TEMPLATES.push),
    pull: refineTemplate(RAW_TEMPLATES.pull),
    core: refineTemplate(RAW_TEMPLATES.core),
    cardio: refineTemplate(RAW_TEMPLATES.cardio),
    hiit: refineTemplate(RAW_TEMPLATES.hiit),
    mobility: refineTemplate(RAW_TEMPLATES.mobility),
    recovery: refineTemplate(RAW_TEMPLATES.recovery),
    skill: refineTemplate(RAW_TEMPLATES.skill),
};

/** Les places qui servent un groupe qu'on veut travailler : ajoutées avant les places en plus. */
const RAW_FOCUS_SLOTS: Readonly<Record<MuscleGroupId, readonly Slot[]>> = {
    chest: [slot('focus-chest', 'accessory', ['horizontal-push']), slot('focus-chest-2', 'accessory', ['horizontal-push', 'vertical-push'])],
    back: [slot('focus-back', 'accessory', ['horizontal-pull', 'vertical-pull']), slot('focus-back-2', 'accessory', ['vertical-pull', 'horizontal-pull'])],
    shoulders: [slot('focus-shoulders', 'accessory', ['vertical-push', 'shoulder-raise']), slot('focus-shoulders-2', 'accessory', ['shoulder-raise', 'scapular'])],
    arms: [slot('focus-biceps', 'accessory', ['elbow-flexion']), slot('focus-triceps', 'accessory', ['elbow-extension'])],
    core: [slot('focus-core', 'core', CORE_PATTERNS), slot('focus-core-2', 'core', ['trunk-flexion', 'trunk-rotation', 'anti-rotation'])],
    'lower-back': [slot('focus-lower-back', 'core', ['trunk-extension']), slot('focus-lower-back-2', 'accessory', ['hinge'])],
    glutes: [slot('focus-glutes', 'accessory', ['hinge']), slot('focus-glutes-2', 'accessory', ['hip-abduction', 'lunge'])],
    legs: [slot('focus-legs', 'accessory', ['squat', 'lunge']), slot('focus-legs-2', 'accessory', ['knee-flexion', 'hip-adduction', 'lunge'])],
    calves: [slot('focus-calves', 'accessory', ['calf-raise']), slot('focus-calves-2', 'accessory', ['calf-raise', 'jump'], ANY_STRENGTH)],
};

export const FOCUS_SLOTS: Readonly<Record<MuscleGroupId, readonly Slot[]>> = Object.fromEntries(
    Object.entries(RAW_FOCUS_SLOTS).map(([group, slots]) => [group, slots.map(refine)]),
) as unknown as Record<MuscleGroupId, readonly Slot[]>;

/** Une place du focus : ce que la personne a demandé de travailler. */
export const isFocusSlot = (entry: Slot): boolean => entry.key.startsWith('focus-');

/** Les groupes que sert surtout chaque schéma : pour retirer une place quand on évite ces groupes. */
export const PATTERN_GROUPS: Readonly<Partial<Record<MovementPattern, readonly MuscleGroupId[]>>> = {
    squat: ['legs', 'glutes'],
    lunge: ['legs', 'glutes'],
    hinge: ['glutes', 'legs', 'lower-back'],
    'knee-flexion': ['legs'],
    'hip-abduction': ['glutes'],
    'hip-adduction': ['legs'],
    'calf-raise': ['calves'],
    'horizontal-push': ['chest', 'arms', 'shoulders'],
    'vertical-push': ['shoulders', 'arms'],
    'horizontal-pull': ['back', 'arms'],
    'vertical-pull': ['back', 'arms'],
    'elbow-flexion': ['arms'],
    'elbow-extension': ['arms'],
    'shoulder-raise': ['shoulders'],
    scapular: ['shoulders', 'back'],
    grip: ['arms'],
    'anti-extension': ['core'],
    'anti-rotation': ['core'],
    'anti-lateral-flexion': ['core'],
    'trunk-flexion': ['core'],
    'trunk-rotation': ['core'],
    'trunk-extension': ['lower-back'],
    jump: ['legs', 'calves'],
};
