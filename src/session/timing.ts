/**
 * Le temps que prend une séance, pour tenir la durée demandée.
 *
 * Une répétition dure le temps noté sur sa fiche (deux secondes et demie
 * pour une pompe), plus lentement en rythme lent ; une tenue dure ses
 * secondes ; un exercice d'un côté puis de l'autre compte double. S'ajoutent
 * les repos prescrits et un temps de mise en place entre deux exercices.
 */
import type { ExerciseDefinition } from '../library/types';
import type { BlockFormat, Target, Tempo } from '../types';

/** Le temps pour se mettre en place entre deux exercices. */
export const TRANSITION_SECONDS = 15;
/** Le temps pour passer d'un bloc à l'autre. */
export const BLOCK_TRANSITION_SECONDS = 30;

/**
 * Le tempo, comme dans DidIt : chaque phase (descente, montée) dure 3 s en
 * lent, 2 s en normal, 1 s en rapide ; une répétition fait deux phases. Un
 * exercice qui porte un tempo se chronomètre sur lui, les bips du lecteur
 * aussi ; sans tempo, on prend le temps noté sur la fiche.
 */
export const TEMPO_PHASE_SECONDS: Readonly<Record<Tempo, number>> = { slow: 3, normal: 2, fast: 1 };

/** Le temps d’une répétition à un tempo donné. */
export function repSeconds(tempo: Tempo): number {
    return 2 * TEMPO_PHASE_SECONDS[tempo];
}

/** Le temps d'une série. */
export function workSeconds(definition: ExerciseDefinition, target: Target, tempo?: Tempo, value = target.value): number {
    const sides = target.perSide ? 2 : 1;

    if (target.measure === 'time') {
        return value * sides;
    }

    if (target.measure === 'distance') {
        const metersPerSecond = definition.met >= 8 ? 2.8 : 1.4;

        return (value / metersPerSecond) * sides;
    }

    return value * (tempo ? repSeconds(tempo) : (definition.secondsPerRep ?? 3)) * sides;
}

export interface TimedItem {
    readonly definition: ExerciseDefinition;
    readonly sets: number;
    readonly target: Target;
    readonly restSeconds: number;
    readonly tempo?: Tempo;
    readonly perSet?: readonly number[];
    readonly warmupSets?: readonly { readonly reps: number; readonly kg: number }[];
}

/** Les séries d'approche d'un exercice : leurs répétitions et 45 s de pause après chacune. */
export function approachSeconds(item: TimedItem): number {
    return (item.warmupSets ?? []).reduce((sum, entry) => sum + workSeconds(item.definition, item.target, item.tempo, entry.reps) + 45, 0);
}

/** Le temps d'un exercice en séries classiques : ses séries et les repos entre elles. */
export function straightSeconds(item: TimedItem): number {
    const work = item.perSet
        ? item.perSet.reduce((sum, value) => sum + workSeconds(item.definition, item.target, item.tempo, value), 0)
        : item.sets * workSeconds(item.definition, item.target, item.tempo);
    const sets = item.perSet?.length ?? item.sets;

    return approachSeconds(item) + work + Math.max(0, sets - 1) * item.restSeconds + TRANSITION_SECONDS;
}

export interface TimedBlock {
    readonly format: BlockFormat;
    readonly rounds: number;
    readonly restBetweenRounds: number;
    readonly restBetweenItems?: number;
    readonly workSeconds?: number;
    readonly restSeconds?: number;
    readonly durationSeconds?: number;
    readonly items: readonly TimedItem[];
}

/** Le temps d'un bloc, selon son format. */
export function blockSeconds(block: TimedBlock): number {
    const rounds = Math.max(1, block.rounds);
    const oneRound = block.items.reduce((sum, item) => sum + workSeconds(item.definition, item.target, item.tempo), 0);
    const between = (block.restBetweenItems ?? 0) * Math.max(0, block.items.length - 1);

    switch (block.format) {
        case 'straight':
        case 'steady':
            return block.items.reduce((sum, item) => sum + straightSeconds(item), 0);
        case 'superset':
        case 'circuit':
        case 'flow':
            return (
                block.items.reduce((sum, item) => sum + approachSeconds(item), 0) +
                rounds * (oneRound + between + TRANSITION_SECONDS * (block.format === 'flow' ? 0.3 : 0.5)) +
                (rounds - 1) * block.restBetweenRounds
            );
        case 'ladder':
            return block.items.reduce((sum, item) => sum + straightSeconds(item), 0);
        case 'emom':
        case 'amrap':
            return block.durationSeconds ?? rounds * 60;
        case 'tabata':
        case 'intervals':
            return rounds * block.items.length * ((block.workSeconds ?? 30) + (block.restSeconds ?? 30)) + (rounds - 1) * block.restBetweenRounds;
    }
}
