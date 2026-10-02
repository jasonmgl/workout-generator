/**
 * Le type de séance, quand la personne ne l'impose pas. La règle de DidIt
 * était « pas les mêmes zones que la veille » ; ici on regarde la fraîcheur
 * de chaque région (séances et activités des derniers jours), ce qui reste à
 * faire dans la semaine, et ce qu'on veut viser.
 *
 * Un corps entier quand tout est frais : c'est le plus efficace à deux ou
 * trois séances par semaine. Le haut du corps quand les jambes sont lourdes
 * (la sortie vélo d'hier), le bas quand c'est le haut. Tout fatigué : on
 * bouge sans charger. Les objectifs cardio prennent une séance d'intervalles
 * quand la semaine n'en a pas encore eu.
 */
import { GROUP_REGION, MUSCLE_GROUPS, MUSCLE_INFO, MUSCLES, type MuscleGroupId, type RegionId } from '../library/anatomy';
import { daysBetween } from '../dates';
import { pastSessions, trainingLoad } from '../history/load';
import { reason } from '../i18n/messages';
import type { Reason, SessionType } from '../types';
import type { Context } from './context';

/** En dessous de 70 % de récupération, une région est trop fatiguée pour être chargée. */
export const FRESH_ENOUGH = 0.7;

/**
 * La fraîcheur d’une région : celle de son gros muscle le plus fatigué. Une
 * moyenne noierait des quadriceps vidés par le vélo dans des mollets frais.
 */
export function regionRecovery(region: RegionId, context: Context): number {
    const large = MUSCLES.filter((muscle) => MUSCLE_INFO[muscle].size === 'large' && GROUP_REGION[MUSCLE_INFO[muscle].group] === region);

    return Math.min(...large.map((muscle) => context.body.muscles[muscle].recovery));
}

const UPPER_PUSH: readonly MuscleGroupId[] = ['chest', 'shoulders'];
const UPPER_PULL: readonly MuscleGroupId[] = ['back'];

/** Le type que suggère une liste de groupes visés. */
function typeForFocus(groups: readonly MuscleGroupId[]): SessionType {
    const regions = new Set(groups.map((group) => GROUP_REGION[group]));

    if (regions.size > 1) return 'full-body';
    if (regions.has('trunk')) return 'core';
    if (regions.has('lower')) return 'lower';
    if (groups.every((group) => UPPER_PUSH.includes(group))) return 'push';
    if (groups.every((group) => UPPER_PULL.includes(group))) return 'pull';

    return 'upper';
}

export interface TypeChoice {
    readonly type: SessionType;
    readonly rest: boolean;
    readonly reasons: readonly Reason[];
}

export function chooseType(context: Context): TypeChoice {
    const { request, readiness, locale } = context;
    const say = (code: string, params = {}): Reason => reason(code, params, locale);

    if (readiness.level === 'rest' && !request.ignoreReadiness) {
        return { type: 'recovery', rest: true, reasons: [] };
    }

    if (request.type && request.type !== 'auto') {
        return { type: request.type, rest: false, reasons: [say('type-asked')] };
    }

    const planned = context.input.plan;

    if (planned?.kind === 'rest' || planned?.kind === 'active-recovery') {
        return { type: planned.kind === 'rest' ? 'recovery' : 'mobility', rest: planned.kind === 'rest', reasons: [say('type-plan-rest')] };
    }

    if (readiness.level === 'recovery' && !request.ignoreReadiness) {
        return { type: 'mobility', rest: false, reasons: [say('type-recovery')] };
    }

    if (planned?.type) {
        return { type: planned.type, rest: false, reasons: [say('type-plan')] };
    }

    if (context.focusGroups.length) {
        return { type: typeForFocus(context.focusGroups), rest: false, reasons: [say('type-focus')] };
    }

    const upper = regionRecovery('upper', context);
    const lower = regionRecovery('lower', context);
    const avoidsLower = context.avoidGroups.some((group) => GROUP_REGION[group] === 'lower');
    const avoidsUpper = context.avoidGroups.some((group) => GROUP_REGION[group] === 'upper');
    const lowerTired = lower < FRESH_ENOUGH || avoidsLower;
    const upperTired = upper < FRESH_ENOUGH || avoidsUpper;
    const load = trainingLoad(context.input.history ?? [], context.date, context.input.restDays ?? []);
    const recentActivity = pastSessions(context.input.history ?? [], context.date).filter((session) => daysBetween(session.date, context.date) <= 2).some(
        (session) => (session.activities?.length ?? 0) > 0 && (session.activities ?? []).some((activity) => ['run', 'bike', 'hike', 'ski', 'team-sport'].includes(activity.type)),
    );

    if (lowerTired && upperTired) {
        if (regionRecovery('trunk', context) >= FRESH_ENOUGH && !context.avoidGroups.includes('core')) {
            return { type: 'core', rest: false, reasons: [say('type-all-tired-core')] };
        }

        return { type: 'mobility', rest: false, reasons: [say('type-all-tired')] };
    }

    if (lowerTired) {
        return { type: 'upper', rest: false, reasons: [say(recentActivity && !avoidsLower ? 'type-legs-tired-activity' : avoidsLower ? 'type-avoid-legs' : 'type-legs-tired')] };
    }

    if (upperTired) {
        return { type: 'lower', rest: false, reasons: [say(avoidsUpper ? 'type-avoid-upper' : 'type-upper-tired')] };
    }

    const cardioGoal = context.goal === 'fat-loss' || context.goal === 'endurance';
    const conditioningThisWeek = pastSessions(context.input.history ?? [], context.date)
        .filter((session) => daysBetween(session.date, context.date) <= 6)
        .some(
            (session) =>
                (session.activities?.length ?? 0) > 0 ||
                (session.exercises ?? []).some((performed) => context.library.find(performed.exercise)?.kind === 'conditioning'),
        );

    if (cardioGoal && load.sessions7 >= 2 && !conditioningThisWeek && context.maxImpact !== 'none' && context.random.next() < 0.5) {
        return { type: 'hiit', rest: false, reasons: [say('type-cardio-week')] };
    }

    // Plus de trois séances par semaine en volume : on alterne haut et bas, la région la plus en retard d'abord.
    if (context.goal === 'hypertrophy' && load.sessions7 >= 3 && (context.level === 'advanced' || context.level === 'expert')) {
        const behind = (region: RegionId): number => {
            const groups = MUSCLE_GROUPS.filter((group) => GROUP_REGION[group] === region);

            return groups.reduce((sum, group) => sum + context.needs[group], 0) / groups.length;
        };

        return behind('upper') >= behind('lower')
            ? { type: 'upper', rest: false, reasons: [say('type-split-upper')] }
            : { type: 'lower', rest: false, reasons: [say('type-split-lower')] };
    }

    return { type: 'full-body', rest: false, reasons: [say('type-full-body')] };
}
