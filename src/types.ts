/**
 * Ce que le moteur reçoit et ce qu'il rend. Tout est en données simples
 * (textes, nombres, listes) : une application peut l'envoyer en JSON depuis
 * un serveur, ou l'appeler directement dans le navigateur.
 *
 * Presque tout est facultatif. Le moteur fait avec ce qu'on lui donne : sans
 * historique, il part prudemment ; sans forme du jour, il suppose une forme
 * ordinaire ; sans matériel, il suppose le sol et un mur.
 */
import type { BodyTarget, JointId, MuscleGroupId } from './library/anatomy';
import type { EquipmentId, EquipmentInput } from './library/equipment';
import type { Library, Locale } from './library/library';
import type { Impact, Measure } from './library/types';
import type { Params } from './i18n/format';

/** L'objectif de la personne. */
export type Goal =
    /** Être en forme : un peu de tout, sans excès. */
    | 'health'
    /** Devenir plus fort : peu de répétitions, des variantes dures, du repos. */
    | 'strength'
    /** Prendre du muscle : volume, séries proches de l'effort maximal sans l'atteindre. */
    | 'hypertrophy'
    /** Tenir plus longtemps : beaucoup de répétitions, peu de repos. */
    | 'endurance'
    /** Perdre du gras : circuits denses et cardio. */
    | 'fat-loss';

export const GOALS: readonly Goal[] = ['health', 'strength', 'hypertrophy', 'endurance', 'fat-loss'];

export type Level = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced', 'expert'];

/** Le ressenti d'une séance, sur trois crans : « trois crans, pas vingt ». */
export type Effort = 'easy' | 'right' | 'hard';

/** Une note de 1 à 5. */
export type Scale = 1 | 2 | 3 | 4 | 5;

/** Une articulation qui fait mal ou qu'il faut ménager : 1 sensible, 2 douloureuse, 3 à ne pas solliciter. */
export interface JointLimitation {
    readonly joint: JointId;
    readonly severity: 1 | 2 | 3;
}

/** Les sports pratiqués à côté, et les activités qu'on enregistre. */
export type ActivityType =
    | 'run'
    | 'walk'
    | 'hike'
    | 'bike'
    | 'swim'
    | 'row'
    | 'climb'
    | 'ski'
    | 'team-sport'
    | 'racket'
    | 'combat'
    | 'yoga'
    | 'dance'
    | 'other';

export const ACTIVITY_TYPES: readonly ActivityType[] = [
    'run',
    'walk',
    'hike',
    'bike',
    'swim',
    'row',
    'climb',
    'ski',
    'team-sport',
    'racket',
    'combat',
    'yoga',
    'dance',
    'other',
];

export type ActivityIntensity = 'easy' | 'moderate' | 'hard';

export interface Profile {
    readonly goal?: Goal;
    /** Le niveau déclaré. Sans lui, le moteur le déduit de l'historique, et part en débutant faute de mieux. */
    readonly level?: Level;
    readonly sex?: 'female' | 'male';
    readonly birthYear?: number;
    readonly bodyweightKg?: number;
    /** Les articulations à ménager durablement (une épaule fragile, un genou opéré). */
    readonly limitations?: readonly JointLimitation[];
    /** Les exercices qu'on aime : ils sortent plus souvent. */
    readonly favorites?: readonly string[];
    /** Ceux qu'on ne veut plus voir. */
    readonly dislikes?: readonly string[];
    /** Les sports pratiqués à côté, pour le plan de la semaine. */
    readonly disciplines?: readonly ActivityType[];
}

/** La phase du cycle menstruel, quand la personne la suit et choisit de la donner. */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** Un pouls du matin, au réveil, en battements par minute. */
export interface PulseReading {
    readonly date: string;
    readonly bpm: number;
}

/** La forme du jour. Tout est facultatif : on ne demande que ce qu'on veut. */
export interface ReadinessInput {
    /** 1 vidé, 5 en pleine forme. */
    readonly energy?: Scale;
    /** 1 très mal dormi, 5 très bien dormi. */
    readonly sleepQuality?: Scale;
    readonly sleepHours?: number;
    /** 1 serein, 5 très stressé. */
    readonly stress?: Scale;
    /** 1 aucune envie, 5 très motivé. */
    readonly motivation?: Scale;
    /** Les courbatures en général : 1 aucune, 5 partout. */
    readonly soreness?: Scale;
    /** Les courbatures par endroit : 1 légères, 2 nettes, 3 fortes. */
    readonly sore?: readonly { readonly target: BodyTarget; readonly level: 1 | 2 | 3 }[];
    /** Les douleurs du jour aux articulations. */
    readonly pain?: readonly JointLimitation[];
    /** Le pouls de ce matin. */
    readonly restingHeartRate?: number;
    /** Les pouls des matins précédents, pour calculer la base. */
    readonly heartRateHistory?: readonly PulseReading[];
    /** La base, si l'application la calcule elle-même. */
    readonly restingHeartRateBaseline?: number;
    readonly ill?: boolean;
    readonly cycle?: { readonly phase: CyclePhase; readonly symptoms?: 0 | 1 | 2 | 3 };
    /** Un jour de repos déclaré. */
    readonly restDay?: boolean;
}

/** Une série faite. */
export interface PerformedSet {
    readonly reps?: number;
    readonly seconds?: number;
    readonly meters?: number;
    readonly loadKg?: number;
    /** Les répétitions qu'on aurait encore pu faire (réserve) : 0, c'était l'échec. */
    readonly rir?: number;
}

export interface PerformedExercise {
    /** L'identifiant de la fiche (catalogue intégré ou fiche ajoutée). */
    readonly exercise: string;
    readonly sets: readonly PerformedSet[];
}

/** Une activité hors séance : une sortie vélo, un match, une randonnée. */
export interface Activity {
    readonly type: ActivityType;
    readonly minutes: number;
    readonly intensity?: ActivityIntensity;
    readonly meters?: number;
}

/** Une séance passée. */
export interface PastSession {
    /** Le jour (« 2026-10-01 ») ou l'instant (« 2026-10-01T18:30 »). */
    readonly date: string;
    readonly minutes?: number;
    readonly effort?: Effort;
    /** L'effort perçu de toute la séance, de 1 à 10, si l'application le demande. */
    readonly rpe?: number;
    readonly exercises?: readonly PerformedExercise[];
    readonly activities?: readonly Activity[];
    /** Ce qu'une activité libre a fait travailler, quand on n'a pas le détail. */
    readonly worked?: readonly BodyTarget[];
}

export type SessionType =
    | 'full-body'
    | 'upper'
    | 'lower'
    | 'push'
    | 'pull'
    | 'core'
    | 'cardio'
    | 'hiit'
    | 'mobility'
    | 'recovery'
    | 'skill';

export const SESSION_TYPES: readonly SessionType[] = ['full-body', 'upper', 'lower', 'push', 'pull', 'core', 'cardio', 'hiit', 'mobility', 'recovery', 'skill'];

/** La façon d'enchaîner les exercices d'un bloc. */
export type BlockFormat =
    /** Toutes les séries d'un exercice, puis le suivant. */
    | 'straight'
    /** Deux exercices en alternance, souvent opposés (pousser, tirer). */
    | 'superset'
    /** Un tour de tous les exercices, repos, et on recommence. */
    | 'circuit'
    /** Une série au début de chaque minute, le reste de la minute pour souffler. */
    | 'emom'
    /** Le plus de tours possible dans le temps donné. */
    | 'amrap'
    /** Huit fois 20 s d'effort et 10 s de repos. */
    | 'tabata'
    /** Effort et récupération chronométrés. */
    | 'intervals'
    /** Une répétition, puis deux, puis trois…, et on repart d'en bas. */
    | 'ladder'
    /** Des mouvements qui s'enchaînent sans compter, pour s'échauffer ou se détendre. */
    | 'flow'
    /** Un seul effort en continu, à allure régulière : vélo, course, rameur. */
    | 'steady';

export const BLOCK_FORMATS: readonly BlockFormat[] = ['straight', 'superset', 'circuit', 'emom', 'amrap', 'tabata', 'intervals', 'ladder', 'flow', 'steady'];

export type Intensity = 'easy' | 'moderate' | 'hard';

/** Ce que la personne demande pour aujourd'hui. */
export interface SessionRequest {
    /** La durée visée, échauffement et retour au calme compris. 30 par défaut, de 5 à 120. */
    readonly minutes?: number;
    readonly type?: SessionType | 'auto';
    /** Ce qu'on veut travailler : muscles, groupes ou régions. */
    readonly focus?: readonly BodyTarget[];
    /** Ce qu'on ne veut pas solliciter aujourd'hui. */
    readonly avoid?: readonly BodyTarget[];
    readonly format?: BlockFormat | 'auto';
    readonly intensity?: Intensity | 'auto';
    readonly warmup?: boolean;
    readonly cooldown?: boolean;
    /** Pas de sauts : un appartement, des voisins, un bébé qui dort. */
    readonly quiet?: boolean;
    /** Des exercices à mettre absolument, et d'autres à écarter. */
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
    /** Faire la séance même si la forme du jour conseille le repos. */
    readonly ignoreReadiness?: boolean;
}

/** Une journée du plan de la semaine, que la séance du jour peut suivre. */
export interface PlannedDay {
    readonly date: string;
    readonly kind: 'training' | 'rest' | 'active-recovery' | 'activity';
    readonly type?: SessionType;
    readonly focus?: readonly MuscleGroupId[];
    readonly intensity?: Intensity;
    readonly minutes?: number;
}

/** Tout ce qu'il faut pour générer une séance. */
export interface GenerateInput {
    /** Aujourd'hui (« 2026-10-02 ») ou maintenant (« 2026-10-02T18:30 »). */
    readonly date: string;
    /** La graine du hasard. Par défaut, tirée de la date : la séance du jour est la même toute la journée. */
    readonly seed?: number;
    readonly profile?: Profile;
    readonly equipment?: readonly EquipmentInput[];
    /** Ce qu'on suppose disponible en plus (par défaut le sol et un mur). */
    readonly assumedEquipment?: readonly EquipmentId[];
    readonly readiness?: ReadinessInput;
    readonly history?: readonly PastSession[];
    /** Les jours de repos déclarés. */
    readonly restDays?: readonly string[];
    readonly request?: SessionRequest;
    readonly plan?: PlannedDay;
    readonly library?: Library;
    readonly locale?: Locale;
}

/** Une raison, lisible par une personne et par une machine. */
export interface Reason {
    /** Un code stable (`legs-tired`, `pulse-high`…), pour qu'une application réagisse sans lire le texte. */
    readonly code: string;
    readonly params?: Params;
    /** La phrase, dans la langue demandée. */
    readonly text: string;
}

export type ReadinessLevel = 'rest' | 'recovery' | 'easy' | 'normal' | 'push';

export interface ReadinessAssessment {
    /** De 0 à 1 ; 0,65 quand on ne sait rien. */
    readonly score: number;
    readonly level: ReadinessLevel;
    /** Le facteur de volume (séries, durée d'effort) : 1 pour une journée ordinaire. */
    readonly volume: number;
    /** Le facteur d'intensité : 1 pour une journée ordinaire, moins pour choisir des variantes plus faciles. */
    readonly intensity: number;
    readonly maxImpact: Impact;
    /** Les articulations à ménager aujourd'hui (limitations durables et douleurs du jour). */
    readonly joints: readonly JointLimitation[];
    /** Un échauffement plus long que d'habitude. */
    readonly longWarmup: boolean;
    /** La forme est-elle connue (au moins un signal donné) ? */
    readonly known: boolean;
    readonly reasons: readonly Reason[];
    readonly warnings: readonly Reason[];
}

/** La cible d'un exercice dans une séance. */
export interface Target {
    readonly measure: Measure;
    /** Les répétitions, les secondes ou les mètres visés, à chaque série (et de chaque côté si `perSide`). */
    readonly value: number;
    /** La fourchette acceptable : en dessous, c'est trop dur ; au-dessus, il faut durcir. */
    readonly range: readonly [number, number];
    readonly perSide: boolean;
}

export type Tempo = 'slow' | 'normal' | 'fast';

/** Où en est la progression sur cet exercice. */
export type ProgressionStep =
    /** Première fois : on part bas, on voit. */
    | 'start'
    /** Même cible que la dernière fois. */
    | 'hold'
    /** Une répétition (ou quelques secondes) de plus. */
    | 'more'
    /** Une série de plus. */
    | 'add-set'
    /** Plus lourd. */
    | 'add-load'
    /** La variante plus dure. */
    | 'harder'
    /** La variante plus facile. */
    | 'easier'
    /** On change de rythme ou de variante pour sortir d'un plateau. */
    | 'vary'
    /** Retour après une coupure : une marche en dessous. */
    | 'comeback';

export interface SessionItem {
    readonly exercise: string;
    readonly name: string;
    readonly sets: number;
    readonly target: Target;
    /** Des cibles différentes série par série (échelle, pyramide). Sinon, `target.value` à chaque série. */
    readonly perSet?: readonly number[];
    readonly restSeconds: number;
    readonly rir?: number;
    readonly tempo?: Tempo;
    readonly load?: { readonly kg: number; readonly equipment: EquipmentId };
    readonly equipment: readonly EquipmentId[];
    readonly progression?: { readonly step: ProgressionStep; readonly text: string };
    readonly note?: string;
    /** Se fait en alternant les côtés : la cible compte les deux côtés, en nombre pair. */
    readonly alternating?: boolean;
    /** Les photos de l'exercice (départ, arrivée), quand une source libre montre le même geste. */
    readonly images?: readonly string[];
    /** Les séries d'approche, avant les séries de travail d'un exercice chargé et lourd : la moitié, puis les trois quarts. */
    readonly warmupSets?: readonly { readonly reps: number; readonly kg: number }[];
    readonly reasons: readonly Reason[];
    /** Le temps d’une série (d’un passage dans un circuit), effort seul, en secondes : de quoi lancer un chrono. */
    readonly setSeconds: number;
    /** Le temps de l’exercice dans tout son bloc, repos compris. */
    readonly estimatedSeconds: number;
}

export type BlockRole = 'warmup' | 'skill' | 'main' | 'finisher' | 'cooldown';

export interface SessionBlock {
    readonly id: string;
    readonly role: BlockRole;
    readonly format: BlockFormat;
    readonly title: string;
    /** Les tours d'un circuit, d'un superset ou d'une échelle (1 pour des séries classiques). */
    readonly rounds: number;
    /** Le repos entre deux tours. */
    readonly restBetweenRounds: number;
    /** Le repos entre deux exercices d’un même tour (circuit, superset). */
    readonly restBetweenItems?: number;
    /** Pour les formats chronométrés : effort et récupération par intervalle, durée totale. */
    readonly workSeconds?: number;
    readonly restSeconds?: number;
    readonly durationSeconds?: number;
    readonly items: readonly SessionItem[];
    readonly estimatedSeconds: number;
}

export interface Session {
    readonly version: 1;
    readonly date: string;
    readonly seed: number;
    readonly type: SessionType;
    readonly goal: Goal;
    readonly level: Level;
    readonly intensity: Intensity;
    /** La forme du jour conseille le repos : la séance proposée n'est qu'un repos actif, à faire ou non. */
    readonly rest: boolean;
    readonly title: string;
    readonly summary: string;
    readonly minutes: number;
    readonly estimatedMinutes: number;
    readonly focus: readonly MuscleGroupId[];
    /** Les séries dures prévues par groupe musculaire (une série d'un muscle secondaire compte pour moitié). */
    readonly volume: Readonly<Partial<Record<MuscleGroupId, number>>>;
    readonly blocks: readonly SessionBlock[];
    readonly readiness: ReadinessAssessment;
    readonly reasons: readonly Reason[];
    readonly warnings: readonly Reason[];
    /** Des conseils, sans gravité : le matériel qui débloquerait un vrai tirage, ce que veut dire la réserve. */
    readonly notes: readonly Reason[];
}
