/**
 * Le point d'entrée « bibliothèque » : le catalogue d'exercices et de quoi
 * l'interroger, sans le générateur. `import { library } from
 * 'workout-generator/library'`.
 */
import { CATALOG } from './exercises';
import { EXERCISES_FR } from '../i18n/fr/exercises';
import { Library, mergeCatalogs, type CatalogTexts } from './library';
import { MEDIA, type MediaEntry } from './media';
import type { ExerciseDefinition } from './types';

/** Les textes du catalogue intégré, par langue. */
export const CATALOG_TEXTS: CatalogTexts = { fr: EXERCISES_FR };

let builtIn: Library | undefined;

/** La bibliothèque intégrée, construite à la première lecture. */
export function defaultLibrary(): Library {
    builtIn ??= new Library(CATALOG, CATALOG_TEXTS, MEDIA);

    return builtIn;
}

/**
 * Une bibliothèque à soi : le catalogue intégré plus ses propres fiches (une
 * fiche qui reprend un identifiant remplace celle du catalogue), ou ses
 * fiches seules avec `{ builtIn: false }`.
 */
export function createLibrary(
    options: {
        readonly exercises?: readonly ExerciseDefinition[];
        readonly texts?: CatalogTexts;
        readonly builtIn?: boolean;
        /** Des photos à soi, ou qui remplacent celles du catalogue. */
        readonly media?: Readonly<Record<string, MediaEntry>>;
        /** Une autre adresse de base pour les photos, quand l'application les copie chez elle. */
        readonly mediaBase?: string;
    } = {},
): Library {
    const base = options.builtIn === false ? { definitions: [], texts: {} } : { definitions: CATALOG, texts: CATALOG_TEXTS };
    const merged = mergeCatalogs(base, { definitions: options.exercises ?? [], texts: options.texts ?? {} });

    const media = options.builtIn === false ? (options.media ?? {}) : { ...MEDIA, ...(options.media ?? {}) };

    return new Library(merged.definitions, merged.texts, media, options.mediaBase);
}

export { CATALOG, CATALOG_BY_FILE } from './exercises';
export { ANCHORS, CATALOG_FILES } from './exercises/anchors';
export type { CatalogFile } from './exercises/anchors';
export { DEFAULT_LOCALE, Library, mergeCatalogs } from './library';
export type { Alternative, CatalogTexts, ExerciseQuery, Locale } from './library';
export { validateCatalog } from './validate';
export { MEDIA, MEDIA_BASE } from './media';
export type { ExerciseMedia, MediaEntry } from './media';
export type { CatalogProblem } from './validate';
export {
    GROUP_REGION,
    groupOf,
    groupsOfRegion,
    isBodyTarget,
    isJoint,
    isMuscle,
    isMuscleGroup,
    isRegion,
    JOINTS,
    MUSCLE_GROUPS,
    MUSCLE_INFO,
    MUSCLES,
    musclesOf,
    musclesOfAll,
    musclesOfGroup,
    OPPOSING_GROUPS,
    REGIONS,
    regionOf,
} from './anatomy';
export type { BodyTarget, JointId, MuscleGroupId, MuscleId, MuscleInfo, MuscleSize, RegionId } from './anatomy';
export { ASSUMED_EQUIPMENT, EQUIPMENT, equipmentUsed, inventory, isEquipment, LOADABLE_EQUIPMENT, satisfies } from './equipment';
export type { EquipmentId, EquipmentInput, EquipmentNeed, Inventory, OwnedEquipment } from './equipment';
export { EXERCISE_KINDS, MOVEMENT_PATTERNS } from './types';
export type {
    Exercise,
    ExerciseDefinition,
    ExerciseKind,
    ExerciseText,
    Impact,
    JointStress,
    Measure,
    MovementPattern,
    MuscleUse,
    Posture,
    Space,
} from './types';
export { EQUIPMENT_NAMES, GROUP_NAMES, JOINT_NAMES, KIND_NAMES, MUSCLE_NAMES, PATTERN_NAMES, REGION_NAMES } from '../i18n/fr/labels';
