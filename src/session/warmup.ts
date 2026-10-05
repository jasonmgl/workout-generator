/**
 * L'échauffement, fait pour la séance qui suit : d'abord faire monter un peu
 * le pouls, puis mobiliser les articulations que les exercices vont
 * solliciter, enfin une version facile du premier gros mouvement (ou, avant
 * des intervalles, les exercices du jour à mi-vitesse). Mobilité en
 * mouvement, jamais d'étirement tenu avant l'effort (règle de l'US Navy).
 */
import type { JointId } from '../library/anatomy';
import type { ExerciseDefinition, MovementPattern, Posture } from '../library/types';
import { reason } from '../i18n/messages';
import { easyTarget, plannedBlockSeconds, targetForSeconds, type PlannedBlock, type PlannedItem } from './blocks';
import type { Context } from './context';
import { feasible } from './select';

/**
 * Le temps visé pour l'échauffement. Une séance courte garde l'essentiel pour le travail : 12 % de la séance, une
 * minute et demie au moins. Au-delà de vingt minutes, 12 % entre 3 et 10 minutes, un peu plus quand la forme du
 * jour le demande. Avant un cardio intense, au moins 5 minutes (15 % de la séance).
 */
export function warmupSeconds(context: Context, intense = false): number {
    const total = context.minutes * 60;

    if (context.minutes <= 20) {
        return Math.round(Math.max(intense ? 120 : 90, total * (intense ? 0.15 : 0.12)));
    }

    const share = total * 0.12 * (context.readiness.longWarmup ? 1.4 : 1) + (context.goal === 'strength' ? 60 : 0);

    return Math.round(Math.min(600, Math.max(intense ? Math.max(300, total * 0.15) : 180, share)));
}

/**
 * La difficulté la plus haute pour un mouvement d'échauffement ou de mobilité : un débutant n'a rien à faire d'un
 * équilibre sur une jambe ou d'une flexion de colonne en charge, ni une personne épuisée.
 */
export function gentleCeiling(context: Context): number {
    if (context.readiness.level === 'easy' || context.readiness.level === 'recovery' || context.readiness.level === 'rest') return 2;
    if (context.level === 'beginner') return 2;
    if (context.level === 'intermediate') return 3;

    return 4;
}

/** L'ordre des positions pour enchaîner sans monter et descendre sans arrêt : debout, en appui, à genoux, assis, au sol. */
export const POSTURE_ORDER: readonly Posture[] = ['standing', 'hanging', 'support', 'kneeling', 'seated', 'floor'];

/** Ranger des exercices par position, sans changer l'ordre de ceux qui partagent la même. */
export function byPosture<T extends { readonly definition: ExerciseDefinition }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => POSTURE_ORDER.indexOf(a.definition.posture) - POSTURE_ORDER.indexOf(b.definition.posture));
}

/** Ce que dure chaque brique : une minute et quart pour le pouls, une demi-minute par mobilité. */
const PULSE_SECONDS = 75;
const MOBILITY_SECONDS = 35;

const item = (definition: ExerciseDefinition, seconds: number, context: Context, reasonCode?: string): PlannedItem => ({
    definition,
    sets: 1,
    target: targetForSeconds(definition, seconds),
    restSeconds: 0,
    equipment: [],
    reasons: reasonCode ? [reason(reasonCode, {}, context.locale)] : [],
});

/** Les articulations d'une liste d'exercices, des plus sollicitées aux moins sollicitées. */
function jointsOf(definitions: readonly ExerciseDefinition[]): JointId[] {
    const load = new Map<JointId, number>();

    for (const definition of definitions) {
        for (const [joint, stress] of Object.entries(definition.joints ?? {}) as [JointId, number][]) {
            load.set(joint, (load.get(joint) ?? 0) + stress);
        }
    }

    return [...load.entries()].sort((a, b) => b[1] - a[1]).map(([joint]) => joint);
}

export interface WarmupOptions {
    /** Les exercices d'intervalles qui suivent : on les répète à mi-vitesse pour finir l'échauffement. */
    readonly intervals?: readonly ExerciseDefinition[];
}

export function buildWarmup(main: readonly ExerciseDefinition[], context: Context, budget = warmupSeconds(context), options: WarmupOptions = {}): PlannedBlock {
    const patterns = new Set<MovementPattern>(main.map((definition) => definition.pattern));
    const joints = jointsOf(main);
    const ceiling = gentleCeiling(context);
    const items: PlannedItem[] = [];
    const used = new Set<string>();
    const block: PlannedBlock = {
        id: 'warmup',
        role: 'warmup',
        format: 'flow',
        title: reason('block-warmup', {}, context.locale).text,
        rounds: 1,
        restBetweenRounds: 0,
        items,
    };
    const add = (definition: ExerciseDefinition | undefined, seconds: number, code?: string): void => {
        if (definition && !used.has(definition.id)) {
            used.add(definition.id);
            items.push(item(definition, seconds, context, code));
        }
    };

    // 1. Faire monter le pouls, doucement.
    const pulse = context.library
        .filter({ kinds: ['conditioning'], maxImpact: context.maxImpact === 'high' && context.level !== 'beginner' ? 'high' : 'low' })
        .filter((definition) => feasible(definition, context) && definition.difficulty <= Math.min(3, ceiling + 1) && definition.warmupFor?.length)
        .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));

    add(pulse.length ? context.random.pick(pulse.slice(0, 3)) : undefined, PULSE_SECONDS, 'warmup-pulse');

    // 2. Les articulations et les mouvements de la séance (les poignets dès que les mains vont au sol).
    const mobility = context.library
        .filter({ kinds: ['mobility'], maxDifficulty: ceiling })
        .filter((definition) => feasible(definition, context) && !definition.tags?.includes('self-massage'))
        .map((definition) => {
            const prepares = (definition.warmupFor ?? []).filter((pattern) => patterns.has(pattern)).length;
            const reaches = joints.slice(0, 3).filter((joint) => (definition.joints?.[joint] ?? 0) > 0).length;

            return { definition, score: prepares * 2 + reaches + context.random.next() * 0.5 };
        })
        .filter((entry) => entry.score >= 1)
        .sort((a, b) => b.score - a.score);
    const families = new Set<string>();
    const reserve = options.intervals?.length ? 0.55 : 0.75;
    const middle: PlannedItem[] = [];

    for (const entry of mobility) {
        if (plannedBlockSeconds(block) + middle.reduce((sum, chosen) => sum + chosen.target.value, 0) >= budget * reserve || middle.length >= 6) break;
        if (families.has(entry.definition.family) || used.has(entry.definition.id)) continue;

        families.add(entry.definition.family);
        used.add(entry.definition.id);
        middle.push(item(entry.definition, MOBILITY_SECONDS, context));
    }

    items.push(...byPosture(middle));

    // 3a. Avant des intervalles : les exercices du jour, 20 s chacun à mi-vitesse, en version sans saut au besoin.
    for (const definition of (options.intervals ?? []).slice(0, 3)) {
        if (plannedBlockSeconds(block) >= budget) break;

        const softer =
            definition.impact === 'high' && (context.level === 'beginner' || context.maxImpact !== 'high')
                ? context.library.family(definition.family).find((member) => member.impact !== 'high' && feasible(member, context))
                : definition;

        if (softer && !used.has(softer.id)) {
            used.add(softer.id);
            items.push({ ...item(softer, 20, context, 'warmup-intervals'), target: { measure: 'time', value: 20, range: [20, 20], perSide: false } });
        }
    }

    // 3b. Une version facile du premier gros mouvement, au moins deux marches en dessous.
    const first = main.find((definition) => definition.compound && definition.kind === 'strength');

    if (first && !options.intervals?.length && plannedBlockSeconds(block) < budget) {
        const easier = context.library
            .family(first.family)
            .filter((definition) => definition.difficulty <= first.difficulty - 2 && feasible(definition, context))
            .pop();
        const ramp = easier ?? first;
        const loaded = Boolean(ramp.tags?.includes('loaded'));

        if (!used.has(ramp.id)) {
            used.add(ramp.id);
            items.push({
                ...item(ramp, 20, context, loaded ? 'warmup-ramp-light' : 'warmup-ramp'),
                target: (() => {
                    const base = easyTarget(ramp, 0);
                    const halved = Math.max(3, Math.round(base.value * (easier ? 1 : 0.5)));
                    // En alternance, un nombre pair : autant de chaque côté, pas « 1.5 de chaque côté ».
                    const value = ramp.alternating && ramp.measure === 'reps' ? Math.max(4, Math.ceil(halved / 2) * 2) : halved;

                    return { ...base, value, range: [Math.min(base.range[0], value), base.range[1]] as const };
                })(),
            });
        }
    }

    // Plus de temps que prévu : on garde l'essentiel.
    while (plannedBlockSeconds(block) > budget * 1.25 && items.length > 2) {
        items.splice(items.length - 2, 1);
    }

    // Moins : une montée du pouls plus longue (jusqu'à 2 min 30), puis des mobilités un peu plus longues. Jamais un
    // deuxième tour, qui ferait remonter le pouls au milieu de l'échauffement et refaire la version facile avant la
    // mobilité.
    const pulseItem = items.find((entry) => entry.reasons.some((why) => why.code === 'warmup-pulse'));

    if (pulseItem && plannedBlockSeconds(block) < budget * 0.9) {
        pulseItem.target = targetForSeconds(pulseItem.definition, Math.min(150, PULSE_SECONDS + budget * 0.9 - plannedBlockSeconds(block)));
    }

    for (const entry of items.filter((candidate) => middle.includes(candidate))) {
        if (plannedBlockSeconds(block) >= budget * 0.9) break;

        entry.target = targetForSeconds(entry.definition, MOBILITY_SECONDS * 1.5);
    }

    return block;
}
