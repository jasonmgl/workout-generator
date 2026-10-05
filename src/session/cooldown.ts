/**
 * Le retour au calme : ne pas s'arrêter net après un effort cardio (on
 * continue de bouger jusqu'à ce que le pouls redescende), étirer tenu les
 * muscles qui ont le plus travaillé, finir par quelques respirations lentes.
 *
 * Les étirements se choisissent muscle par muscle : chacun doit couvrir le
 * plus possible de travail pas encore étiré. Des pompes appellent les
 * pectoraux et les triceps, pas les biceps.
 */
import { MUSCLE_INFO, MUSCLES, type MuscleId } from '../library/anatomy';
import type { ExerciseDefinition } from '../library/types';
import { reason } from '../i18n/messages';
import { plannedBlockSeconds, targetForSeconds, type PlannedBlock, type PlannedItem } from './blocks';
import type { Context } from './context';
import { feasible } from './select';
import { byPosture } from './warmup';

/** Le temps visé : 10 % de la séance, entre 3 et 8 minutes ; pour une séance de vingt minutes ou moins, 8 %, une minute au moins. */
export function cooldownSeconds(context: Context): number {
    if (context.minutes <= 20) {
        return Math.round(Math.max(60, context.minutes * 60 * 0.08));
    }

    return Math.round(Math.min(480, Math.max(180, context.minutes * 60 * 0.1)));
}

/** Le travail de chaque muscle dans des blocs : une série par muscle principal, une demi par muscle qui aide. */
export function muscleLoad(blocks: readonly PlannedBlock[]): Map<MuscleId, number> {
    const load = new Map<MuscleId, number>();

    for (const block of blocks) {
        if (block.role === 'warmup' || block.role === 'cooldown') continue;

        for (const item of block.items) {
            const sets = item.sets * Math.max(1, block.rounds);

            for (const muscle of item.definition.muscles.primary) load.set(muscle, (load.get(muscle) ?? 0) + sets);
            for (const muscle of item.definition.muscles.secondary ?? []) load.set(muscle, (load.get(muscle) ?? 0) + sets / 2);
        }
    }

    return load;
}

/** Ce qu'on étire par défaut quand la séance n'a rien chargé de précis (un cardio) : les jambes et le dos. */
const DEFAULT_LOAD: ReadonlyMap<MuscleId, number> = new Map<MuscleId, number>([
    ['quads', 3],
    ['hamstrings', 3],
    ['gastrocnemius', 2],
    ['glute-max', 2],
    ['hip-flexors', 2],
    ['erectors', 1],
]);

const STRETCH_SECONDS = 30;

export function buildCooldown(
    load: ReadonlyMap<MuscleId, number>,
    context: Context,
    options: { readonly afterCardio?: boolean; readonly budget?: number; readonly continueWith?: ExerciseDefinition } = {},
): PlannedBlock {
    const budget = options.budget ?? cooldownSeconds(context);
    const items: PlannedItem[] = [];
    const block: PlannedBlock = {
        id: 'cooldown',
        role: 'cooldown',
        format: 'flow',
        title: reason('block-cooldown', {}, context.locale).text,
        rounds: 1,
        restBetweenRounds: 0,
        items,
    };
    const add = (definition: ExerciseDefinition, seconds: number, code?: string, exact = false): void => {
        items.push({
            definition,
            sets: 1,
            target: targetForSeconds(definition, seconds, exact),
            restSeconds: 0,
            equipment: [],
            reasons: code ? [reason(code, {}, context.locale)] : [],
        });
    };

    // Après un effort cardio, on continue de bouger pendant que le pouls redescend : sur la même machine en douceur,
    // ou en marchant.
    if (options.continueWith) {
        add(options.continueWith, 150, 'cooldown-easy', true);
    } else if (options.afterCardio) {
        const walk = context.library
            .filter({ kinds: ['conditioning'], maxImpact: 'low', measures: ['time'], maxDifficulty: 2 })
            .filter((definition) => feasible(definition, context) && definition.met <= 4.5 && !definition.tags?.includes('machine') && !definition.tags?.includes('outdoor'))
            .sort((a, b) => a.met - b.met || a.id.localeCompare(b.id))[0];

        if (walk) {
            add(walk, 90, 'cooldown-walk');
        }
    }

    const remaining = new Map(load.size ? load : DEFAULT_LOAD);
    const stretches = context.library.filter({ kinds: ['stretch'] }).filter((definition) => feasible(definition, context));
    const used = new Set<string>();
    // La respiration finale : une minute et demie, moins dans un retour au calme très court.
    const breathingTime = Math.max(30, Math.min(90, Math.round(budget * 0.4 / 15) * 15));

    while (plannedBlockSeconds(block) < budget - breathingTime && remaining.size) {
        const scored = stretches
            .filter((definition) => !used.has(definition.id))
            .map((definition) => ({
                definition,
                covers: definition.muscles.primary.reduce((sum, muscle) => sum + (remaining.get(muscle) ?? 0), 0),
            }))
            .filter((entry) => entry.covers > 0)
            .sort((a, b) => b.covers - a.covers || a.definition.difficulty - b.definition.difficulty || a.definition.id.localeCompare(b.definition.id));

        if (scored.length === 0) break;

        const best = scored[0]!.covers;
        const pick = context.random.pick(scored.filter((entry) => entry.covers >= best * 0.8).slice(0, 3)).definition;

        used.add(pick.id);
        add(pick, STRETCH_SECONDS);

        for (const muscle of pick.muscles.primary) remaining.delete(muscle);

        // Un groupe déjà étiré n'appelle plus qu'un peu : on passe aux autres.
        for (const muscle of MUSCLES) {
            if (pick.muscles.primary.some((other) => MUSCLE_INFO[other].group === MUSCLE_INFO[muscle].group) && remaining.has(muscle)) {
                remaining.set(muscle, remaining.get(muscle)! / 3);
            }
        }
    }

    // Les étirements du debout vers le sol : on ne se relève pas entre deux, et on finit allongé.
    const moving = items.filter((entry) => entry.definition.kind !== 'stretch');
    const stretched = byPosture(items.filter((entry) => entry.definition.kind === 'stretch'));

    items.splice(0, items.length, ...moving, ...stretched);

    const breathing = context.library.filter({ kinds: ['breathing'] }).filter((definition) => feasible(definition, context));

    if (breathing.length) {
        add(breathing.find((definition) => definition.id === 'diaphragmatic-breathing') ?? breathing[0]!, breathingTime, 'cooldown-breathing', true);
    }

    return block;
}
