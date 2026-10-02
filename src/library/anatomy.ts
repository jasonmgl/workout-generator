/**
 * L'anatomie du moteur, à trois étages : les muscles (fins, pour compter la
 * fatigue), les groupes (ce qu'on demande : « les jambes », « le dos »), et
 * les régions (haut du corps, tronc, bas du corps).
 *
 * Les identifiants sont uniques d'un étage à l'autre : `calves` est un
 * groupe, ses muscles s'appellent `gastrocnemius`, `soleus` et `tibialis`.
 * C'est ce qui permet de mélanger les trois étages dans une même demande.
 */

export const MUSCLES = [
    'pecs',
    'upper-pecs',
    'front-delts',
    'side-delts',
    'rear-delts',
    'rotator-cuff',
    'serratus',
    'lats',
    'upper-traps',
    'mid-traps',
    'lower-traps',
    'rhomboids',
    'biceps',
    'brachialis',
    'triceps',
    'forearm-flexors',
    'forearm-extensors',
    'abs',
    'obliques',
    'transverse',
    'hip-flexors',
    'erectors',
    'glute-max',
    'glute-med',
    'quads',
    'hamstrings',
    'adductors',
    'gastrocnemius',
    'soleus',
    'tibialis',
] as const;

export type MuscleId = (typeof MUSCLES)[number];

export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'core', 'lower-back', 'glutes', 'legs', 'calves'] as const;

export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number];

export const REGIONS = ['upper', 'trunk', 'lower'] as const;

export type RegionId = (typeof REGIONS)[number];

/** Ce qu'on peut viser ou éviter : un muscle, un groupe ou une région. */
export type BodyTarget = MuscleId | MuscleGroupId | RegionId;

/**
 * La taille d'un muscle règle sa récupération : un quadriceps met plus
 * longtemps à s'en remettre qu'un mollet ou un avant-bras.
 */
export type MuscleSize = 'large' | 'medium' | 'small';

export interface MuscleInfo {
    readonly group: MuscleGroupId;
    readonly size: MuscleSize;
}

export const MUSCLE_INFO: Readonly<Record<MuscleId, MuscleInfo>> = {
    pecs: { group: 'chest', size: 'large' },
    'upper-pecs': { group: 'chest', size: 'medium' },
    'front-delts': { group: 'shoulders', size: 'medium' },
    'side-delts': { group: 'shoulders', size: 'small' },
    'rear-delts': { group: 'shoulders', size: 'small' },
    'rotator-cuff': { group: 'shoulders', size: 'small' },
    serratus: { group: 'shoulders', size: 'small' },
    lats: { group: 'back', size: 'large' },
    'upper-traps': { group: 'back', size: 'medium' },
    'mid-traps': { group: 'back', size: 'medium' },
    'lower-traps': { group: 'back', size: 'small' },
    rhomboids: { group: 'back', size: 'medium' },
    biceps: { group: 'arms', size: 'small' },
    brachialis: { group: 'arms', size: 'small' },
    triceps: { group: 'arms', size: 'medium' },
    'forearm-flexors': { group: 'arms', size: 'small' },
    'forearm-extensors': { group: 'arms', size: 'small' },
    abs: { group: 'core', size: 'medium' },
    obliques: { group: 'core', size: 'medium' },
    transverse: { group: 'core', size: 'small' },
    'hip-flexors': { group: 'core', size: 'small' },
    erectors: { group: 'lower-back', size: 'large' },
    'glute-max': { group: 'glutes', size: 'large' },
    'glute-med': { group: 'glutes', size: 'medium' },
    quads: { group: 'legs', size: 'large' },
    hamstrings: { group: 'legs', size: 'large' },
    adductors: { group: 'legs', size: 'medium' },
    gastrocnemius: { group: 'calves', size: 'small' },
    soleus: { group: 'calves', size: 'small' },
    tibialis: { group: 'calves', size: 'small' },
};

export const GROUP_REGION: Readonly<Record<MuscleGroupId, RegionId>> = {
    chest: 'upper',
    back: 'upper',
    shoulders: 'upper',
    arms: 'upper',
    core: 'trunk',
    'lower-back': 'trunk',
    glutes: 'lower',
    legs: 'lower',
    calves: 'lower',
};

/**
 * Les groupes qui se font face. Les travailler ensemble garde l'équilibre
 * avant / arrière (poitrine et dos, abdominaux et lombaires…) : c'est une
 * règle de l'US Navy, publique, que DidIt a reprise.
 */
export const OPPOSING_GROUPS: Readonly<Partial<Record<MuscleGroupId, MuscleGroupId>>> = {
    chest: 'back',
    back: 'chest',
    core: 'lower-back',
    'lower-back': 'core',
};

/** Les articulations que l'on peut ménager : une douleur au genou écarte ce qui le charge. */
export const JOINTS = ['wrists', 'elbows', 'shoulders', 'neck', 'lower-back', 'hips', 'knees', 'ankles'] as const;

export type JointId = (typeof JOINTS)[number];

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

export const isMuscle = (value: string): value is MuscleId => isOneOf(MUSCLES, value);
export const isMuscleGroup = (value: string): value is MuscleGroupId => isOneOf(MUSCLE_GROUPS, value);
export const isRegion = (value: string): value is RegionId => isOneOf(REGIONS, value);
export const isJoint = (value: string): value is JointId => isOneOf(JOINTS, value);
export const isBodyTarget = (value: string): value is BodyTarget => isMuscle(value) || isMuscleGroup(value) || isRegion(value);

/** Le groupe d'un muscle. */
export function groupOf(muscle: MuscleId): MuscleGroupId {
    return MUSCLE_INFO[muscle].group;
}

/** La région d'un muscle ou d'un groupe. */
export function regionOf(target: MuscleId | MuscleGroupId): RegionId {
    return GROUP_REGION[isMuscle(target) ? groupOf(target) : target];
}

/** Les muscles d'un groupe, dans l'ordre de `MUSCLES`. */
export function musclesOfGroup(group: MuscleGroupId): MuscleId[] {
    return MUSCLES.filter((muscle) => MUSCLE_INFO[muscle].group === group);
}

/** Les groupes d'une région. */
export function groupsOfRegion(region: RegionId): MuscleGroupId[] {
    return MUSCLE_GROUPS.filter((group) => GROUP_REGION[group] === region);
}

/**
 * Les muscles que désigne une cible, quel que soit son étage. Lève une
 * erreur sur un nom inconnu : une faute de frappe dans une demande ne doit
 * pas passer pour « rien à viser ».
 */
export function musclesOf(target: BodyTarget | string): MuscleId[] {
    if (isMuscle(target)) {
        return [target];
    }

    if (isMuscleGroup(target)) {
        return musclesOfGroup(target);
    }

    if (isRegion(target)) {
        return groupsOfRegion(target).flatMap(musclesOfGroup);
    }

    throw new Error(`Cible inconnue : « ${target} »`);
}

/** Les muscles de plusieurs cibles, sans doublon, dans l'ordre de `MUSCLES`. */
export function musclesOfAll(targets: readonly (BodyTarget | string)[]): MuscleId[] {
    const wanted = new Set(targets.flatMap(musclesOf));

    return MUSCLES.filter((muscle) => wanted.has(muscle));
}
