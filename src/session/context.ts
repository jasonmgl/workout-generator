/**
 * Tout ce que la génération d'une séance doit savoir, calculé une fois :
 * matériel, forme du jour, état des muscles, capacités, besoins de la
 * semaine, ce qu'on vise et ce qu'on évite.
 */
import { MUSCLE_GROUPS, MUSCLE_INFO, musclesOfAll, musclesOfGroup, type JointId, type MuscleGroupId, type MuscleId } from '../library/anatomy';
import { ASSUMED_EQUIPMENT, inventory, type Inventory } from '../library/equipment';
import { defaultLibrary } from '../library/index';
import type { Library, Locale } from '../library/library';
import type { Impact, Posture } from '../library/types';
import { daysBetween, dayOf } from '../dates';
import { bodyState, type BodyState } from '../history/fatigue';
import { pastSessions } from '../history/load';
import { capacity, type Capacity } from '../history/progress';
import { resolveHistory } from '../history/resolve';
import { Random, seedFrom } from '../random';
import { assessReadiness } from '../readiness/assess';
import type { GenerateInput, Goal, Level, ReadinessAssessment, SessionRequest } from '../types';
import { GOAL_SETTINGS, GROUP_SHARE, type GoalSettings } from './goals';

/** Les durées qu’on propose de choisir, comme dans DidIt ; toute autre durée de 5 à 120 minutes marche aussi. */
export const DURATIONS: readonly number[] = [10, 20, 30, 45, 60];

/** La durée par défaut, et ses bornes. */
export const DEFAULT_MINUTES = 30;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 120;

export interface Recency {
    /** Les jours depuis la dernière fois. */
    readonly days: number;
    /** Le nombre de fois sur les six dernières semaines. */
    readonly count: number;
}

export interface Context {
    readonly input: GenerateInput;
    readonly date: string;
    readonly seed: number;
    readonly locale: Locale;
    readonly random: Random;
    readonly library: Library;
    readonly inventory: Inventory;
    readonly readiness: ReadinessAssessment;
    readonly body: BodyState;
    readonly capacity: Capacity;
    readonly goal: Goal;
    readonly settings: GoalSettings;
    readonly level: Level;
    readonly request: SessionRequest;
    readonly minutes: number;
    readonly focusGroups: readonly MuscleGroupId[];
    readonly focusMuscles: ReadonlySet<MuscleId>;
    /** Les groupes entièrement évités : leurs places sortent du gabarit. */
    readonly avoidGroups: readonly MuscleGroupId[];
    readonly avoidMuscles: ReadonlySet<MuscleId>;
    readonly exclude: ReadonlySet<string>;
    readonly favorites: ReadonlySet<string>;
    readonly maxImpact: Impact;
    /** La contrainte qu'on tolère encore sur chaque articulation à ménager (0 : aucune). */
    readonly jointTolerance: ReadonlyMap<JointId, number>;
    /** Les positions écartées : sans le haut du corps, ni appui sur les mains ni suspension. */
    readonly avoidPostures: ReadonlySet<Posture>;
    readonly exerciseRecency: ReadonlyMap<string, Recency>;
    readonly familyRecency: ReadonlyMap<string, Recency>;
    /** De 0 (la semaine est faite) à 1 (rien cette semaine), par groupe. */
    readonly needs: Readonly<Record<MuscleGroupId, number>>;
}

const IMPACT_ORDER: readonly Impact[] = ['none', 'low', 'high'];
const UPPER_GROUPS: readonly MuscleGroupId[] = ['chest', 'back', 'shoulders', 'arms'];
const LOWER_GROUPS: readonly MuscleGroupId[] = ['glutes', 'legs', 'calves'];

/** Les groupes d'une liste de cibles : un groupe dont au moins un muscle est visé. */
export function groupsOf(muscles: ReadonlySet<MuscleId>): MuscleGroupId[] {
    return MUSCLE_GROUPS.filter((group) => [...muscles].some((muscle) => MUSCLE_INFO[muscle].group === group));
}

export function buildContext(input: GenerateInput): Context {
    const library = input.library ?? defaultLibrary();
    const request = input.request ?? {};
    const profile = input.profile ?? {};
    const locale = input.locale ?? 'fr';
    // Les exercices de l’historique par leur fiche, même donnés par leur nom : tout le reste lit `context.input.history`.
    const history = resolveHistory(input.history ?? [], library, locale);
    const seed = input.seed ?? seedFrom(dayOf(input.date));
    const readiness = assessReadiness({
        date: input.date,
        ...(input.readiness ? { readiness: input.readiness } : {}),
        history,
        ...(input.restDays ? { restDays: input.restDays } : {}),
        profile,
        locale,
    });
    const known = capacity(history, input.date, library);
    const level = profile.level ?? known.level ?? 'beginner';
    const goal = profile.goal ?? 'health';
    const settings = GOAL_SETTINGS[goal];
    const body = bodyState(history, input.date, library, input.readiness ?? {});
    const focusMuscles = new Set(musclesOfAll(request.focus ?? input.plan?.focus ?? []));
    const avoidMuscles = new Set(musclesOfAll(request.avoid ?? []));
    const quietImpact: Impact = request.quiet ? 'low' : 'high';
    const maxImpact = IMPACT_ORDER[Math.min(IMPACT_ORDER.indexOf(readiness.maxImpact), IMPACT_ORDER.indexOf(quietImpact))]!;
    const jointTolerance = new Map(readiness.joints.map((entry) => [entry.joint, 3 - entry.severity]));
    const avoidGroups = MUSCLE_GROUPS.filter((group) => musclesOfGroup(group).every((muscle) => avoidMuscles.has(muscle)));
    const avoidPostures = new Set<Posture>();
    // Éviter une région, c’est souvent la ménager après une blessure : ses articulations le sont aussi.
    const spare = (joints: readonly JointId[]): void => {
        for (const joint of joints) jointTolerance.set(joint, Math.min(jointTolerance.get(joint) ?? 3, 1));
    };

    if (UPPER_GROUPS.every((group) => avoidGroups.includes(group))) {
        spare(['shoulders', 'elbows', 'wrists']);
        avoidPostures.add('support');
        avoidPostures.add('hanging');
    }

    if (LOWER_GROUPS.every((group) => avoidGroups.includes(group))) {
        spare(['knees', 'hips', 'ankles']);
    }
    const exerciseRecency = new Map<string, Recency>();
    const familyRecency = new Map<string, Recency>();

    for (const session of pastSessions(history, input.date)) {
        const days = daysBetween(session.date, input.date);

        if (days > 42) {
            continue;
        }

        for (const performed of session.exercises ?? []) {
            const definition = library.find(performed.exercise);
            const bump = (map: Map<string, Recency>, key: string): void => {
                const seen = map.get(key);

                map.set(key, { days: Math.min(seen?.days ?? days, days), count: (seen?.count ?? 0) + 1 });
            };

            bump(exerciseRecency, performed.exercise);

            if (definition) {
                bump(familyRecency, definition.family);
            }
        }
    }

    const needs = {} as Record<MuscleGroupId, number>;

    for (const group of MUSCLE_GROUPS) {
        const target = settings.weeklySets[level] * GROUP_SHARE[group];
        const done = body.groups[group].weeklySets;

        needs[group] = Math.round(Math.min(1, Math.max(0, (target - done) / target)) * 1000) / 1000;
    }

    const minutes = Math.round(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, request.minutes ?? input.plan?.minutes ?? DEFAULT_MINUTES)));

    return {
        input: { ...input, history },
        date: input.date,
        seed,
        locale,
        random: new Random(seed),
        library,
        inventory: inventory(input.equipment ?? [], input.assumedEquipment ?? ASSUMED_EQUIPMENT),
        readiness,
        body,
        capacity: known,
        goal,
        settings,
        level,
        request,
        minutes,
        focusGroups: groupsOf(focusMuscles),
        focusMuscles,
        avoidGroups,
        avoidMuscles,
        exclude: new Set([...(request.exclude ?? []), ...(profile.dislikes ?? [])]),
        favorites: new Set(profile.favorites ?? []),
        maxImpact,
        jointTolerance,
        avoidPostures,
        exerciseRecency,
        familyRecency,
        needs,
    };
}
