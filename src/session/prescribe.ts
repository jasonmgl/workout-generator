/**
 * Doser un exercice : combien de séries, combien de répétitions (ou de
 * secondes), quel repos, quelle charge, et où l'on en est de la progression.
 *
 * La progression suit un escalier : on gagne une répétition à la fois
 * jusqu'au haut de la fourchette, puis on ajoute une série, une charge, ou
 * l'on passe à la variante plus dure (c'est le choix de l'exercice qui s'en
 * charge) et l'on repart d'en bas. Une séance trop dure fait tenir la même
 * cible ; quatre séances sans progrès, c'est un plateau : on change de
 * rythme. Jamais d'échec : la réserve reste d'au moins une répétition.
 */
import { equipmentUsed, LOADABLE_EQUIPMENT, type EquipmentId } from '../library/equipment';
import type { ExerciseDefinition, MovementPattern } from '../library/types';
import { performancesOf, valueOf, type ExercisePerformance } from '../history/progress';
import { reason } from '../i18n/messages';
import type { Level, ProgressionStep, Reason, Target, Tempo } from '../types';
import type { Context } from './context';
import type { GoalSettings } from './goals';
import type { SlotRole } from './templates';

/** Le nombre de séances sans progrès qui fait un plateau. */
export const PLATEAU_SESSIONS = 4;

const MIN_SPAN = { reps: 2, time: 10, distance: 50 } as const;

/** Ramener une fourchette voulue dans celle de la fiche, sans la réduire à un point. */
function within(wanted: readonly [number, number], allowed: readonly [number, number], span: number): [number, number] {
    const clamp = (value: number): number => Math.min(allowed[1], Math.max(allowed[0], value));
    let low = clamp(wanted[0]);
    let high = clamp(wanted[1]);

    if (high - low < span) {
        high = Math.min(allowed[1], low + span);
        low = Math.max(allowed[0], high - span);
    }

    return [low, high];
}

/** La fourchette visée pour un exercice, selon l'objectif et la sorte d'exercice. */
export function targetRange(definition: ExerciseDefinition, settings: GoalSettings): [number, number] {
    const span = MIN_SPAN[definition.measure];

    if (definition.measure === 'distance') {
        return [definition.range[0], definition.range[1]];
    }

    if (definition.measure === 'reps') {
        if (definition.kind === 'power') return within([3, 10], definition.range, span);
        if (definition.kind === 'conditioning') return within([8, 20], definition.range, span);
        if (definition.kind === 'mobility' || definition.kind === 'stretch' || definition.kind === 'breathing') {
            return [definition.range[0], definition.range[1]];
        }

        return within(settings.reps, definition.range, span);
    }

    if (definition.kind === 'conditioning' || definition.kind === 'power') {
        return within([settings.intervals.work, settings.intervals.work + 15], definition.range, span);
    }

    if (definition.kind === 'strength' || definition.kind === 'skill') {
        return within(settings.hold, definition.range, span);
    }

    return [definition.range[0], definition.range[1]];
}

export interface Prescription {
    readonly sets: number;
    readonly target: Target;
    readonly restSeconds: number;
    /** La réserve visée, seulement pour ce qui se compte en répétitions. */
    readonly rir?: number;
    readonly tempo?: Tempo;
    readonly load?: { readonly kg: number; readonly equipment: EquipmentId };
    readonly equipment: readonly EquipmentId[];
    readonly progression: { readonly step: ProgressionStep; readonly text: string };
    readonly note?: string;
    readonly reasons: readonly Reason[];
}

/** Les charges de départ, en part du poids du corps, selon le schéma et l'outil (par haltère, par kettlebell, barre entière). */
const LOAD_RATIO: Readonly<Partial<Record<MovementPattern, Partial<Record<EquipmentId, number>>>>> = {
    squat: { dumbbells: 0.2, kettlebell: 0.25, barbell: 0.6, sandbag: 0.3 },
    lunge: { dumbbells: 0.12, kettlebell: 0.15, barbell: 0.4, sandbag: 0.2 },
    hinge: { dumbbells: 0.2, kettlebell: 0.3, barbell: 0.8, sandbag: 0.3 },
    'horizontal-push': { dumbbells: 0.15, kettlebell: 0.15, barbell: 0.5 },
    'vertical-push': { dumbbells: 0.1, kettlebell: 0.12, barbell: 0.35 },
    'horizontal-pull': { dumbbells: 0.15, kettlebell: 0.2, barbell: 0.45 },
    'elbow-flexion': { dumbbells: 0.08, kettlebell: 0.1, barbell: 0.25 },
    'elbow-extension': { dumbbells: 0.07, kettlebell: 0.08, barbell: 0.2 },
    'shoulder-raise': { dumbbells: 0.04, kettlebell: 0.05 },
    scapular: { dumbbells: 0.04 },
    carry: { dumbbells: 0.3, kettlebell: 0.3, sandbag: 0.3 },
    'calf-raise': { dumbbells: 0.15, kettlebell: 0.2 },
    'full-body': { dumbbells: 0.1, kettlebell: 0.2, 'medicine-ball': 0.08, sandbag: 0.2 },
};

const LEVEL_LOAD: Readonly<Record<Level, number>> = { beginner: 0.6, intermediate: 1, advanced: 1.3, expert: 1.5 };

/** La charge disponible la plus proche d'un poids voulu, sans le dépasser (sauf si tout est plus lourd). */
function nearestLoad(loads: readonly number[], wanted: number): number {
    const lighter = loads.filter((load) => load <= wanted);

    return lighter.length ? lighter[lighter.length - 1]! : loads[0]!;
}

/** Y a-t-il un plateau : les dernières séances n'ont pas battu le total d'avant ? */
export function onPlateau(performances: readonly ExercisePerformance[]): boolean {
    if (performances.length < PLATEAU_SESSIONS) {
        return false;
    }

    const totals = performances.slice(0, PLATEAU_SESSIONS).map((performance) => performance.total);
    const oldest = totals[PLATEAU_SESSIONS - 1]!;

    return totals.slice(0, PLATEAU_SESSIONS - 1).every((total) => total <= oldest);
}

export function prescribe(definition: ExerciseDefinition, role: SlotRole, context: Context): Prescription {
    const { settings, readiness, locale } = context;
    const range = targetRange(definition, settings);
    const [low, high] = range;
    const performances = performancesOf(context.input.history ?? [], definition, context.date);
    const familyCapacity = context.capacity.families[definition.family];
    const unit = definition.measure === 'time' ? ' s' : definition.measure === 'distance' ? ' m' : '';
    const increment = definition.measure === 'reps' ? 1 : definition.measure === 'time' ? 5 : 50;
    const reasons: Reason[] = [];
    let step: ProgressionStep;
    let value: number;
    let tempo: Tempo | undefined;
    let progressionText: string;

    const last = performances[0];

    if (!last) {
        if (familyCapacity !== undefined && definition.difficulty > familyCapacity) {
            step = 'harder';
            value = low;
            progressionText = reason('progress-harder', {}, locale).text;
        } else if (familyCapacity !== undefined && definition.difficulty < familyCapacity) {
            step = 'easier';
            value = Math.round(low + (high - low) * 0.5);
            progressionText = reason('progress-easier', {}, locale).text;
        } else {
            step = 'start';
            value = Math.round(low + (high - low) * 0.25);
            progressionText = reason('progress-start', {}, locale).text;
        }
    } else {
        const values = last.sets.map((set) => valueOf(set, definition.measure));
        const lowest = Math.min(...values);
        const average = values.reduce((sum, entry) => sum + entry, 0) / values.length;

        if (onPlateau(performances)) {
            step = 'vary';
            value = Math.min(high, Math.max(low, Math.round(average)));
            tempo = 'slow';
            progressionText = reason('progress-vary', { sessions: PLATEAU_SESSIONS }, locale).text;
        } else if (lowest >= high) {
            const loadable = LOADABLE_EQUIPMENT.some((id) => context.inventory.loadsOf(id).length > 0 && definition.equipment?.some((group) => group.includes(id)));

            step = loadable ? 'add-load' : 'add-set';
            value = high;
            progressionText = reason(loadable ? 'progress-add-load' : 'progress-add-set', {}, locale).text;
        } else if (lowest >= low) {
            step = 'more';
            value = Math.min(high, Math.round(average) + increment);
            progressionText = reason('progress-more', { from: Math.round(average), to: value, unit }, locale).text;
        } else {
            step = 'hold';
            value = Math.max(low, Math.min(high, Math.round(average)));
            progressionText = reason('progress-hold', {}, locale).text;
        }
    }

    if (readiness.reasons.some((entry) => entry.code === 'comeback')) {
        step = 'comeback';
        value = Math.max(low, Math.round(value * 0.85));
        progressionText = reason('progress-comeback', {}, locale).text;
    }

    if (readiness.level === 'easy' || readiness.level === 'recovery') {
        value = Math.max(low, Math.round(value * 0.9));
    }

    // Les séries : le haut de la fourchette pour un exercice principal, le bas pour le reste.
    const [fewest, most] = settings.sets[context.level];
    let sets = role === 'main' || role === 'skill' ? most : fewest;

    if (step === 'start' || step === 'harder') sets = fewest;
    if (step === 'add-set') sets = Math.min(most + 1, sets + 1);

    sets = Math.max(1, Math.round(sets * readiness.volume));

    // Le repos et la réserve.
    let restSeconds = definition.compound ? settings.rest.compound : settings.rest.isolation;

    if (definition.kind === 'power') restSeconds = Math.max(restSeconds, 60);
    if (definition.kind === 'skill') restSeconds = Math.max(restSeconds, 90);
    if (readiness.level === 'easy' || readiness.level === 'recovery') restSeconds += 15;

    const counted = definition.measure === 'reps' && (definition.kind === 'strength' || definition.kind === 'power');
    const rir = definition.kind === 'power' ? 3 : settings.rir + (readiness.level === 'easy' || readiness.level === 'recovery' ? 1 : 0);

    // Le tempo de chaque exercice de renforcement en répétitions : rapide pour l’explosif, lent pour une descente freinée,
    // un plateau ou l’isolation en prise de muscle, normal sinon.
    if (definition.measure === 'reps') {
        if (definition.kind === 'power') tempo = 'fast';
        else if (definition.kind === 'strength' || definition.kind === 'skill') {
            if (!tempo && (definition.tags?.includes('eccentric') || (context.goal === 'hypertrophy' && !definition.compound))) tempo = 'slow';
            tempo ??= 'normal';
        }
    }

    // La charge.
    const used = equipmentUsed(definition.equipment, context.inventory);
    const loadEquipment = used.find((id) => LOADABLE_EQUIPMENT.includes(id));
    let load: { kg: number; equipment: EquipmentId } | undefined;
    let note: string | undefined;

    if (loadEquipment) {
        const loads = context.inventory.loadsOf(loadEquipment);

        if (loads.length) {
            const lastLoad = last?.loadKg;

            if (lastLoad !== undefined) {
                const current = nearestLoad(loads, lastLoad);
                const heavier = loads.find((entry) => entry > current);

                load = { kg: step === 'add-load' && heavier !== undefined ? heavier : current, equipment: loadEquipment };

                if (step === 'add-load' && heavier !== undefined) {
                    value = low;
                    progressionText = reason('progress-load-up', { from: current, to: heavier }, locale).text;
                } else if (step === 'add-load') {
                    step = 'add-set';
                    sets = Math.min(most + 1, sets + 1);
                    progressionText = reason('progress-add-set', {}, locale).text;
                }
            } else {
                const bodyweight = context.input.profile?.bodyweightKg ?? 70;
                const ratio = LOAD_RATIO[definition.pattern]?.[loadEquipment] ?? 0.1;

                load = { kg: nearestLoad(loads, bodyweight * ratio * LEVEL_LOAD[context.level]), equipment: loadEquipment };
                note = reason('load-guess', { rir }, locale).text;
            }
        } else {
            note = reason('load-choose', { rir }, locale).text;
        }
    }

    const rounded = definition.measure === 'time' ? Math.max(5, Math.round(value / 5) * 5) : Math.max(1, Math.round(value));

    return {
        sets,
        target: { measure: definition.measure, value: Math.min(high, Math.max(low, rounded)), range, perSide: Boolean(definition.unilateral) },
        restSeconds,
        ...(counted ? { rir } : {}),
        ...(tempo ? { tempo } : {}),
        ...(load ? { load } : {}),
        equipment: used,
        progression: { step, text: progressionText },
        ...(note ? { note } : {}),
        reasons,
    };
}
