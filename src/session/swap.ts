/**
 * Remplacer un exercice d'une séance : proposer des remplaçants faisables
 * (même matériel, mêmes articulations ménagées, rien de déjà dans la
 * séance), puis en mettre un à la place, dosé pour la personne, sans
 * toucher au reste de la séance.
 *
 * On passe la même entrée que pour générer la séance : c'est elle qui dit
 * le matériel, la forme du jour et l'historique.
 */
import type { GenerateInput, Session, SessionBlock, SessionItem } from '../types';
import { buildContext } from './context';
import { prescribe } from './prescribe';
import { feasible } from './select';
import { blockSeconds, BLOCK_TRANSITION_SECONDS, workSeconds, type TimedBlock } from './timing';

export interface Replacement {
    readonly id: string;
    readonly name: string;
    /** De 0 à 1 : la ressemblance avec l'exercice remplacé. */
    readonly similarity: number;
}

function findItem(session: Session, blockId: string, index: number): { block: SessionBlock; item: SessionItem } {
    const block = session.blocks.find((entry) => entry.id === blockId);
    const item = block?.items[index];

    if (!block || !item) {
        throw new Error(`Pas d’exercice ${index} dans le bloc « ${blockId} »`);
    }

    return { block, item };
}

/** Les remplaçants possibles d'un exercice de la séance, du plus proche au plus lointain. */
export function alternativesFor(session: Session, input: GenerateInput, blockId: string, index: number, limit = 5): Replacement[] {
    const context = buildContext(input);
    const { item } = findItem(session, blockId, index);
    const inSession = session.blocks.flatMap((block) => block.items.map((entry) => entry.exercise));

    return context.library
        .alternatives(item.exercise, { equipment: context.inventory, maxImpact: context.maxImpact, exclude: inSession })
        .filter((entry) => feasible(context.library.get(entry.id), context))
        .slice(0, limit)
        .map((entry) => ({ id: entry.id, name: context.library.name(entry.id, context.locale), similarity: entry.similarity }));
}

/** La séance avec un exercice remplacé ; la séance d'origine n'est pas modifiée. */
export function replaceExercise(session: Session, input: GenerateInput, blockId: string, index: number, exerciseId: string): Session {
    const context = buildContext(input);
    const { block, item } = findItem(session, blockId, index);
    const definition = context.library.get(exerciseId);
    const role = block.role === 'main' ? (definition.compound ? 'main' : 'accessory') : block.role === 'skill' ? 'skill' : 'accessory';
    const prescription = prescribe(definition, role, context);
    const keepsRounds = block.format !== 'straight' && block.format !== 'ladder';
    const replaced: SessionItem = {
        exercise: definition.id,
        name: context.library.name(definition.id, context.locale),
        sets: keepsRounds ? item.sets : prescription.sets,
        target:
            block.format === 'tabata' || block.format === 'intervals'
                ? { ...item.target, perSide: Boolean(definition.unilateral) }
                : prescription.target,
        restSeconds: keepsRounds ? item.restSeconds : prescription.restSeconds,
        ...(prescription.rir !== undefined ? { rir: prescription.rir } : {}),
        ...(prescription.tempo ? { tempo: prescription.tempo } : {}),
        ...(prescription.load ? { load: prescription.load } : {}),
        equipment: prescription.equipment,
        progression: prescription.progression,
        ...(prescription.note ? { note: prescription.note } : {}),
        reasons: [],
        setSeconds: 0,
        estimatedSeconds: 0,
    };
    const items = block.items.map((entry, position) => (position === index ? replaced : entry));
    const timed: TimedBlock = {
        format: block.format,
        rounds: block.rounds,
        restBetweenRounds: block.restBetweenRounds,
        ...(block.restBetweenItems !== undefined ? { restBetweenItems: block.restBetweenItems } : {}),
        ...(block.workSeconds !== undefined ? { workSeconds: block.workSeconds } : {}),
        ...(block.restSeconds !== undefined ? { restSeconds: block.restSeconds } : {}),
        ...(block.durationSeconds !== undefined ? { durationSeconds: block.durationSeconds } : {}),
        items: items.map((entry) => ({ definition: context.library.get(entry.exercise), sets: entry.sets, target: entry.target, restSeconds: entry.restSeconds, ...(entry.tempo ? { tempo: entry.tempo } : {}) })),
    };
    const estimated = Math.round(blockSeconds(timed));
    const share = Math.round(estimated / Math.max(1, items.length));
    const setSeconds = Math.round(
        block.format === 'tabata' || block.format === 'intervals' ? (block.workSeconds ?? replaced.target.value) : workSeconds(definition, replaced.target, replaced.tempo),
    );
    const newBlock: SessionBlock = {
        ...block,
        items: items.map((entry, position) => (position === index ? { ...entry, setSeconds, estimatedSeconds: share } : entry)),
        estimatedSeconds: estimated,
    };
    const blocks = session.blocks.map((entry) => (entry.id === blockId ? newBlock : entry));
    const seconds = blocks.reduce((sum, entry) => sum + entry.estimatedSeconds, 0) + Math.max(0, blocks.length - 1) * BLOCK_TRANSITION_SECONDS;

    return { ...session, blocks, estimatedMinutes: Math.round(seconds / 60) };
}
