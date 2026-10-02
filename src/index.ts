/**
 * workout-generator : une bibliothèque d'exercices et un générateur de
 * séances. Il ne sait rien de l'application qui l'utilise : pas de Vue, pas
 * de Laravel, aucune dépendance.
 */
export * from './library/index';

// La séance du jour, le plan de la semaine, et ce qui les explique.
export { generateSession } from './session/generate';
export { alternativesFor, replaceExercise } from './session/swap';
export type { Replacement } from './session/swap';
export { DEFAULT_MINUTES, DURATIONS, MAX_MINUTES, MIN_MINUTES } from './session/context';
export { GOAL_SETTINGS, GROUP_SHARE } from './session/goals';
export type { GoalSettings } from './session/goals';
export { repSeconds, TEMPO_PHASE_SECONDS } from './session/timing';
export { planWeek, plannedDayFor, splitFor, spreadDays } from './week/plan';
export type { PlannedActivity, Weekday, WeekDay, WeekInput, WeekPlan } from './week/plan';

// La forme du jour et l'historique, utilisables seuls (un tableau de bord, une carte des muscles).
export { assessReadiness, jointsToSpare, pulseStatus } from './readiness/assess';
export type { AssessInput, PulseStatus } from './readiness/assess';
export { bodyState, RECOVERY_HOURS, sorenessByMuscle } from './history/fatigue';
export type { BodyState, GroupState, MuscleState } from './history/fatigue';
export { sessionLoad, sessionMinutes, trainingLoad } from './history/load';
export type { TrainingLoad } from './history/load';
export { capacity, levelFor, performancesOf } from './history/progress';
export type { Capacity, ExercisePerformance } from './history/progress';
export { ACTIVITY_LOAD, activityLoad } from './history/activities';

// Les sorties : texte, étapes pour un lecteur, arbre de blocs.
export { describeTarget, sessionToText } from './output/text';
export { toTimeline } from './output/timeline';
export type { TimelineStep } from './output/timeline';
export { toTree } from './output/tree';
export type { TreeExercise, TreeLoop, TreeNode, TreeRest } from './output/tree';

// Les phrases, les dates, le hasard.
export { message, messageCodes, reason, registerMessages } from './i18n/messages';
export { format, formatSeconds, normalize } from './i18n/format';
export type { Params, PluralRule } from './i18n/format';
export { MESSAGES_FR } from './i18n/fr/messages';
export { targetName } from './i18n/fr/labels';
export { addDays, dayOf, daysBetween, fromDayNumber, hoursBetween, mondayOf, toDayNumber, toHours, weekdayOf } from './dates';
export { Random, seedFrom } from './random';

export { ACTIVITY_TYPES, BLOCK_FORMATS, GOALS, LEVELS, SESSION_TYPES } from './types';
export type {
    Activity,
    ActivityIntensity,
    ActivityType,
    BlockFormat,
    BlockRole,
    CyclePhase,
    Effort,
    GenerateInput,
    Goal,
    Intensity,
    JointLimitation,
    Level,
    PastSession,
    PerformedExercise,
    PerformedSet,
    PlannedDay,
    Profile,
    ProgressionStep,
    PulseReading,
    ReadinessAssessment,
    ReadinessInput,
    ReadinessLevel,
    Reason,
    Scale,
    Session,
    SessionBlock,
    SessionItem,
    SessionRequest,
    SessionType,
    Target,
    Tempo,
} from './types';
