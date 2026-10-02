/**
 * L'échauffement, fait pour la séance qui suit : d'abord faire monter un peu
 * le pouls, puis mobiliser les articulations que les exercices vont
 * solliciter, enfin une version facile du premier gros mouvement. Mobilité
 * en mouvement, jamais d'étirement tenu avant l'effort (règle de l'US Navy).
 */
import type { JointId } from '../library/anatomy';
import type { ExerciseDefinition, MovementPattern } from '../library/types';
import { reason } from '../i18n/messages';
import { easyTarget, plannedBlockSeconds, targetForSeconds, type PlannedBlock, type PlannedItem } from './blocks';
import type { Context } from './context';
import { feasible } from './select';

/** Le temps visé pour l'échauffement : 12 % de la séance, entre 3 et 10 minutes (un peu plus quand la forme du jour le demande). */
export function warmupSeconds(context: Context): number {
    const share = context.minutes * 60 * 0.12 * (context.readiness.longWarmup ? 1.4 : 1) + (context.goal === 'strength' ? 60 : 0);

    return Math.round(Math.min(600, Math.max(180, share)));
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

export function buildWarmup(main: readonly ExerciseDefinition[], context: Context, budget = warmupSeconds(context)): PlannedBlock {
    const patterns = new Set<MovementPattern>(main.map((definition) => definition.pattern));
    const joints = jointsOf(main);
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
        .filter({ kinds: ['conditioning'], maxImpact: context.maxImpact === 'high' ? 'high' : 'low' })
        .filter((definition) => feasible(definition, context) && definition.difficulty <= 3 && definition.warmupFor?.length)
        .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));

    add(pulse.length ? context.random.pick(pulse.slice(0, 3)) : undefined, PULSE_SECONDS, 'warmup-pulse');

    // 2. Les articulations et les mouvements de la séance.
    const mobility = context.library
        .filter({ kinds: ['mobility'] })
        .filter((definition) => feasible(definition, context) && !definition.tags?.includes('self-massage'))
        .map((definition) => {
            const prepares = (definition.warmupFor ?? []).filter((pattern) => patterns.has(pattern)).length;
            const reaches = joints.slice(0, 3).filter((joint) => (definition.joints?.[joint] ?? 0) > 0).length;

            return { definition, score: prepares * 2 + reaches + (context.random.next() * 0.5) };
        })
        .filter((entry) => entry.score >= 1)
        .sort((a, b) => b.score - a.score);
    const families = new Set<string>();

    for (const entry of mobility) {
        if (plannedBlockSeconds(block) >= budget * 0.75 || items.length >= 5) break;
        if (families.has(entry.definition.family)) continue;

        families.add(entry.definition.family);
        add(entry.definition, MOBILITY_SECONDS);
    }

    // 3. Une version facile du premier gros mouvement.
    const first = main.find((definition) => definition.compound && definition.kind === 'strength');

    if (first && plannedBlockSeconds(block) < budget) {
        const easier = context.library
            .family(first.family)
            .filter((definition) => definition.difficulty <= first.difficulty - 1 && feasible(definition, context))
            .pop();
        const ramp = easier ?? first;

        if (!used.has(ramp.id)) {
            used.add(ramp.id);
            items.push({
                ...item(ramp, 20, context, 'warmup-ramp'),
                target: (() => {
                    const base = easyTarget(ramp, 0);
                    const value = Math.max(3, Math.round(base.value * (easier ? 1 : 0.5)));

                    return { ...base, value, range: [Math.min(base.range[0], value), base.range[1]] as const };
                })(),
            });
        }
    }

    // Plus de temps que prévu : un deuxième tour léger ; moins : on garde l'essentiel.
    while (plannedBlockSeconds(block) > budget * 1.25 && items.length > 2) {
        items.splice(items.length - 2, 1);
    }

    if (plannedBlockSeconds(block) < budget * 0.6 && items.length > 0) {
        block.rounds = 2;
        block.restBetweenRounds = 15;
    }

    return block;
}
