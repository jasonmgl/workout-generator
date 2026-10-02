/**
 * Le format d'une fiche d'exercice.
 *
 * Une fiche est faite de deux moitiés rangées à part : la structure (ce que
 * le moteur calcule : muscles, matériel, difficulté, articulations…) et le
 * texte (ce que l'on lit : nom, consignes, erreurs). La structure ne contient
 * aucun mot destiné à l'écran, ce qui permet d'ajouter une langue sans
 * toucher au moteur.
 */
import type { JointId, MuscleId } from './anatomy';
import type { EquipmentId, EquipmentNeed } from './equipment';

/** À quoi sert l'exercice. */
export type ExerciseKind =
    /** Renforcement : répétitions ou tenue, avec ou sans charge. */
    | 'strength'
    /** Explosivité : sauts, pompes claquées, lancers. */
    | 'power'
    /** Cardio : faire monter le pouls et le tenir. */
    | 'conditioning'
    /** Mobilité : faire bouger une articulation dans toute son amplitude, en mouvement. */
    | 'mobility'
    /** Étirement tenu, pour le retour au calme. */
    | 'stretch'
    /** Figure de gymnastique qui se travaille par la technique : équilibre sur les mains, drapeau… */
    | 'skill'
    /** Respiration, pour finir au calme. */
    | 'breathing';

export const EXERCISE_KINDS: readonly ExerciseKind[] = ['strength', 'power', 'conditioning', 'mobility', 'stretch', 'skill', 'breathing'];

/** Le schéma de mouvement : deux exercices du même schéma se remplacent l'un l'autre. */
export type MovementPattern =
    | 'squat'
    | 'lunge'
    | 'hinge'
    | 'knee-flexion'
    | 'hip-abduction'
    | 'hip-adduction'
    | 'calf-raise'
    | 'horizontal-push'
    | 'vertical-push'
    | 'horizontal-pull'
    | 'vertical-pull'
    | 'elbow-flexion'
    | 'elbow-extension'
    | 'shoulder-raise'
    | 'scapular'
    | 'grip'
    | 'anti-extension'
    | 'anti-rotation'
    | 'anti-lateral-flexion'
    | 'trunk-flexion'
    | 'trunk-rotation'
    | 'trunk-extension'
    | 'carry'
    | 'locomotion'
    | 'jump'
    | 'full-body'
    | 'cardio'
    | 'mobility'
    | 'stretch'
    | 'breathing';

export const MOVEMENT_PATTERNS: readonly MovementPattern[] = [
    'squat',
    'lunge',
    'hinge',
    'knee-flexion',
    'hip-abduction',
    'hip-adduction',
    'calf-raise',
    'horizontal-push',
    'vertical-push',
    'horizontal-pull',
    'vertical-pull',
    'elbow-flexion',
    'elbow-extension',
    'shoulder-raise',
    'scapular',
    'grip',
    'anti-extension',
    'anti-rotation',
    'anti-lateral-flexion',
    'trunk-flexion',
    'trunk-rotation',
    'trunk-extension',
    'carry',
    'locomotion',
    'jump',
    'full-body',
    'cardio',
    'mobility',
    'stretch',
    'breathing',
];

/** Comment on compte : des répétitions, une durée tenue, ou une distance. */
export type Measure = 'reps' | 'time' | 'distance';

/** Les chocs : `high` pour tout ce qui saute (et fait du bruit chez les voisins). */
export type Impact = 'none' | 'low' | 'high';

/**
 * La position de départ. Enchaîner deux exercices de la même position évite
 * de se relever et de se recoucher sans arrêt dans un circuit.
 */
export type Posture = 'standing' | 'floor' | 'kneeling' | 'seated' | 'hanging' | 'support';

/** La place qu'il faut : sur place, un tapis, une pièce dégagée, dehors. */
export type Space = 'spot' | 'mat' | 'room' | 'outdoor';

/** La contrainte sur une articulation : 1 légère, 2 nette, 3 forte. */
export type JointStress = 1 | 2 | 3;

/** La part d'un muscle dans l'effort. */
export interface MuscleUse {
    /** Les muscles qui font le travail. Au moins un. */
    readonly primary: readonly MuscleId[];
    /** Ceux qui aident nettement. */
    readonly secondary?: readonly MuscleId[];
    /** Ceux qui tiennent la position sans vraiment se fatiguer. */
    readonly stabilizers?: readonly MuscleId[];
}

/**
 * La structure d'une fiche : tout ce dont le moteur a besoin pour choisir,
 * doser et remplacer un exercice, et rien de ce qui s'affiche.
 */
export interface ExerciseDefinition {
    /** Identifiant stable, en anglais, en minuscules et tirets : `archer-push-up`. */
    readonly id: string;
    readonly kind: ExerciseKind;
    readonly pattern: MovementPattern;
    /**
     * La famille de progression : les exercices d'une même famille vont du
     * plus facile au plus dur selon leur `difficulty` (`push-up` : contre un
     * mur, sur les genoux, classique, déclinée, archer, sur un bras…).
     */
    readonly family: string;
    /**
     * La difficulté, de 1 à 10, sur une seule échelle pour tout le
     * catalogue : 1 pour une pompe contre un mur, 3 pour une pompe
     * classique, 10 pour une traction sur un bras.
     */
    readonly difficulty: number;
    readonly muscles: MuscleUse;
    /** Le matériel nécessaire (voir `EquipmentNeed`). Absent : rien. */
    readonly equipment?: EquipmentNeed;
    /** Le matériel qui peut alourdir l'exercice sans le changer : un sac à dos, un gilet lesté, des haltères. */
    readonly loadableWith?: readonly EquipmentId[];
    readonly measure: Measure;
    /** Se fait un côté après l'autre : le volume prescrit vaut pour chaque côté. */
    readonly unilateral?: boolean;
    /** Plusieurs articulations à la fois (squat, traction) plutôt qu'une seule (curl). */
    readonly compound: boolean;
    readonly impact: Impact;
    readonly posture: Posture;
    readonly space: Space;
    /** Les articulations qui travaillent sous contrainte, pour ménager celles qui font mal. */
    readonly joints?: Readonly<Partial<Record<JointId, JointStress>>>;
    /** La dépense, en équivalents métaboliques (1 au repos, 8 pour des burpees). */
    readonly met: number;
    /** Le temps d'une répétition à rythme normal, en secondes. Pour une fiche en répétitions. */
    readonly secondsPerRep?: number;
    /** Ce que l'on fait d'habitude : `[8, 15]` répétitions, `[20, 45]` secondes, `[200, 1000]` mètres. */
    readonly range: readonly [number, number];
    /** Bon pour s'échauffer avant ces schémas (mobilité, activation, version douce). */
    readonly warmupFor?: readonly MovementPattern[];
    /** Des liens de progression hors famille : la version plus facile ou plus dure qui a un autre nom. */
    readonly easier?: readonly string[];
    readonly harder?: readonly string[];
    /** Mots-clés libres pour filtrer : `isometric`, `explosive`, `balance`, `grip`, `posture`… */
    readonly tags?: readonly string[];
}

/** Le texte d'une fiche, dans une langue. */
export interface ExerciseText {
    /** Le nom qu'on affiche : « Pompes archer ». */
    readonly name: string;
    /** Les autres noms sous lesquels on le cherche : « Pompe à l'arc », « Rowing australien »… */
    readonly aliases?: readonly string[];
    /** Une phrase qui dit ce que c'est et à quoi ça sert. */
    readonly summary: string;
    /** La mise en place, avant la première répétition. */
    readonly setup: readonly string[];
    /** Le déroulé d'une répétition (ou de la tenue). */
    readonly steps: readonly string[];
    /** Les repères à garder en tête pendant l'effort. */
    readonly cues: readonly string[];
    /** Les erreurs fréquentes. */
    readonly mistakes: readonly string[];
    /** Quand inspirer, quand souffler. */
    readonly breathing?: string;
    /** Pour qui c'est à éviter, ou ce qui doit faire arrêter. */
    readonly safety?: string;
}

/** Une fiche complète : la structure et son texte dans la langue demandée. */
export interface Exercise extends ExerciseDefinition {
    readonly text: ExerciseText;
}
