/**
 * Les briques d'une séance en cours de construction : des exercices dosés,
 * rangés en blocs, avec leur temps. On les assemble, on les ajuste à la
 * durée, puis on les rend sous la forme publique (`SessionBlock`).
 */
import { equipmentUsed, type EquipmentId } from '../library/equipment';
import type { ExerciseDefinition } from '../library/types';
import type { BlockFormat, BlockRole, ProgressionStep, Reason, SessionBlock, SessionItem, Target, Tempo } from '../types';
import type { Context } from './context';
import { blockSeconds, workSeconds, straightSeconds, type TimedBlock } from './timing';

export interface PlannedItem {
    readonly definition: ExerciseDefinition;
    sets: number;
    target: Target;
    perSet?: readonly number[];
    restSeconds: number;
    rir?: number;
    tempo?: Tempo;
    load?: { readonly kg: number; readonly equipment: EquipmentId; readonly estimated?: boolean };
    equipment: readonly EquipmentId[];
    progression?: { readonly step: ProgressionStep; readonly text: string };
    note?: string;
    reasons: Reason[];
    /** La place du gabarit qu'il remplit, pour savoir ce qu'on peut retirer en premier. */
    slotRole?: string;
    /** Il tient une place du focus et fait travailler le groupe visé : servi en séries avant les autres, dans le premier circuit. */
    focus?: boolean;
    /** Le plus de séries qu'on peut lui donner en remplissant la séance. */
    maxSets?: number;
    /** Les séries d'approche avant ses séries de travail. */
    warmupSets?: readonly { readonly reps: number; readonly kg: number }[];
}

export interface PlannedBlock {
    readonly id: string;
    readonly role: BlockRole;
    format: BlockFormat;
    title: string;
    rounds: number;
    restBetweenRounds: number;
    restBetweenItems?: number;
    workSeconds?: number;
    restSeconds?: number;
    durationSeconds?: number;
    items: PlannedItem[];
}

export function plannedBlockSeconds(block: PlannedBlock): number {
    return blockSeconds(block as TimedBlock);
}

/** Le temps d'un exercice dans son bloc, pour l'afficher à côté de lui. */
function itemSeconds(item: PlannedItem, block: PlannedBlock): number {
    if (block.format === 'straight' || block.format === 'ladder' || block.format === 'steady') {
        return straightSeconds(item);
    }

    if (block.format === 'tabata' || block.format === 'intervals') {
        return Math.max(1, block.rounds) * ((block.workSeconds ?? 30) + (block.restSeconds ?? 30));
    }

    if (block.format === 'emom' || block.format === 'amrap') {
        return Math.round(plannedBlockSeconds(block) / Math.max(1, block.items.length));
    }

    return Math.max(1, block.rounds) * item.sets * workSeconds(item.definition, item.target, item.tempo);
}

export function toSessionItem(item: PlannedItem, block: PlannedBlock, context: Context): SessionItem {
    // L’échauffement et le retour au calme ne dosent pas leurs exercices : on retrouve ici le matériel qui sert.
    const equipment = item.equipment.length ? item.equipment : equipmentUsed(item.definition.equipment, context.inventory);

    return {
        exercise: item.definition.id,
        name: context.library.name(item.definition.id, context.locale, item.load ? [item.load.equipment, ...equipment] : equipment),
        sets: item.sets,
        target: item.target,
        ...(item.perSet ? { perSet: item.perSet } : {}),
        restSeconds: item.restSeconds,
        ...(item.rir !== undefined ? { rir: item.rir } : {}),
        ...(item.tempo ? { tempo: item.tempo } : {}),
        ...(item.load ? { load: item.load } : {}),
        equipment,
        ...(item.progression ? { progression: item.progression } : {}),
        ...(item.note ? { note: item.note } : {}),
        ...(item.warmupSets ? { warmupSets: item.warmupSets } : {}),
        ...(item.definition.alternating && item.target.measure === 'reps' ? { alternating: true } : {}),
        ...(context.library.media(item.definition.id) ? { images: context.library.media(item.definition.id)!.images } : {}),
        reasons: item.reasons,
        setSeconds: Math.round(block.format === 'tabata' || block.format === 'intervals' ? (block.workSeconds ?? item.target.value) : workSeconds(item.definition, item.target, item.tempo)),
        estimatedSeconds: Math.round(itemSeconds(item, block)),
    };
}

export function toSessionBlock(block: PlannedBlock, context: Context, transition = 0): SessionBlock {
    return {
        id: block.id,
        role: block.role,
        format: block.format,
        title: block.title,
        rounds: block.rounds,
        restBetweenRounds: block.restBetweenRounds,
        ...(block.restBetweenItems !== undefined ? { restBetweenItems: block.restBetweenItems } : {}),
        ...(block.workSeconds !== undefined ? { workSeconds: block.workSeconds } : {}),
        ...(block.restSeconds !== undefined ? { restSeconds: block.restSeconds } : {}),
        ...(block.durationSeconds !== undefined ? { durationSeconds: block.durationSeconds } : {}),
        items: block.items.map((item) => toSessionItem(item, block, context)),
        estimatedSeconds: Math.round(plannedBlockSeconds(block) + transition),
    };
}

/** Une cible simple pour un exercice d'échauffement ou de retour au calme : le bas de sa fourchette, ou un peu plus. */
/** Les nombres qu’écrit un coach : 10, 12, 15, 20… répétitions, 20, 30, 45 secondes ; jamais 23. */
const REPS_GRID = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];
const SECONDS_GRID = [5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600];

/** Arrondir une cible d’échauffement ou de retour au calme sur la grille d’un coach, dans la fourchette de la fiche, paire pour une alternance. */
export function coachValue(definition: ExerciseDefinition, raw: number): number {
    const [low, high] = definition.range;
    const grid = definition.measure === 'time' ? SECONDS_GRID : definition.measure === 'reps' ? REPS_GRID : [];
    const candidates = grid.filter((value) => value >= low && value <= high && (!definition.alternating || value % 2 === 0));
    const nearest = candidates.length ? candidates.reduce((best, value) => (Math.abs(value - raw) < Math.abs(best - raw) ? value : best)) : Math.round(raw);

    return Math.min(high, Math.max(low, definition.measure === 'time' && !candidates.length ? Math.max(5, Math.round(raw / 5) * 5) : nearest));
}

export function easyTarget(definition: ExerciseDefinition, share = 0.3): Target {
    const [low, high] = definition.range;
    const raw = low + (high - low) * share;
    const value = coachValue(definition, raw);

    return { measure: definition.measure, value, range: [low, high], perSide: Boolean(definition.unilateral) };
}

/** Une cible qui prend environ ce nombre de secondes, ramenée dans la fourchette de la fiche. */
export function targetForSeconds(definition: ExerciseDefinition, seconds: number): Target {
    const sides = definition.unilateral ? 2 : 1;
    const [low, high] = definition.range;
    const raw =
        definition.measure === 'time'
            ? seconds / sides
            : definition.measure === 'distance'
              ? seconds * 1.4
              : seconds / ((definition.secondsPerRep ?? 3) * sides);
    const clamped = Math.min(high, Math.max(low, raw));
    const value = coachValue(definition, clamped);

    return { measure: definition.measure, value, range: [low, high], perSide: Boolean(definition.unilateral) };
}
