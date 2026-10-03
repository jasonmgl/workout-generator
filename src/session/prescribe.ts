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

/**
 * La fourchette visée pour un exercice, selon l'objectif, la sorte d'exercice et sa place dans la séance : seuls
 * les gros mouvements suivent la fourchette de la force ; un exercice d'appoint se fait à 8-12 au moins, le gainage
 * à 8-15 ou en tenue.
 */
export function targetRange(definition: ExerciseDefinition, settings: GoalSettings, role: SlotRole = 'main'): [number, number] {
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

        const [low, high] = settings.reps;
        const wanted: readonly [number, number] =
            role === 'accessory' ? [Math.max(low, 8), Math.max(high, 12)] : role === 'core' ? [Math.max(low, 8), Math.max(high, 15)] : settings.reps;

        return within(wanted, definition.range, span);
    }

    if (definition.kind === 'conditioning' || definition.kind === 'power') {
        return within([settings.intervals.work, settings.intervals.work + 15], definition.range, span);
    }

    if (definition.kind === 'strength' || definition.kind === 'skill') {
        const [low, high] = settings.hold;

        return within(role === 'core' ? [Math.max(low, 20), Math.max(high, 45)] : settings.hold, definition.range, span);
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
    /** Le plus de séries qu’on peut lui donner en remplissant la séance (moins à la première fois, ou un jour léger). */
    readonly maxSets: number;
    /** Les séries d’approche avant les séries de travail d’un exercice chargé et lourd. */
    readonly warmupSets?: readonly { readonly reps: number; readonly kg: number }[];
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

const LEVEL_LOAD: Readonly<Record<Level, number>> = { beginner: 0.7, intermediate: 1, advanced: 1.35, expert: 1.6 };

/**
 * La charge disponible la plus proche d'un poids voulu : celle du dessus si elle est plus proche et ne dépasse pas
 * de plus de 15 %, sinon celle du dessous (ou la plus légère si tout est plus lourd).
 */
export function closestLoad(loads: readonly number[], wanted: number): number {
    const lighter = loads.filter((load) => load <= wanted);
    const heavier = loads.filter((load) => load > wanted);
    const below = lighter[lighter.length - 1];
    const above = heavier[0];

    if (above !== undefined && (below === undefined || (above - wanted <= wanted - below && above <= wanted * 1.15))) {
        return above;
    }

    return below ?? loads[0]!;
}

/**
 * Ce que pèse une série selon ses répétitions et sa réserve, par rapport à une série de dix : la règle d'Epley
 * (publique), qui donne la part du maximum qu'on soulève pour un nombre de répétitions donné.
 */
const repsFactor = (reps: number, rir: number): number => (1 + 10 / 30) / (1 + (reps + rir) / 30);

/** Y a-t-il un plateau : les dernières séances n'ont pas battu le total d'avant ? */
export function onPlateau(performances: readonly ExercisePerformance[]): boolean {
    if (performances.length < PLATEAU_SESSIONS) {
        return false;
    }

    const totals = performances.slice(0, PLATEAU_SESSIONS).map((performance) => performance.total);
    const oldest = totals[PLATEAU_SESSIONS - 1]!;

    return totals.slice(0, PLATEAU_SESSIONS - 1).every((total) => total <= oldest);
}

/** La dernière performance dans la famille sur une variante plus facile : d'où l'on part quand on durcit. */
function previousInFamily(definition: ExerciseDefinition, context: Context): { definition: ExerciseDefinition; performance: ExercisePerformance } | undefined {
    let found: { definition: ExerciseDefinition; performance: ExercisePerformance } | undefined;

    for (const member of context.library.family(definition.family)) {
        if (member.difficulty >= definition.difficulty || member.measure !== definition.measure) continue;

        const performance = performancesOf(context.input.history ?? [], member, context.date)[0];

        if (performance && (!found || performance.date > found.performance.date)) {
            found = { definition: member, performance };
        }
    }

    return found;
}

/** Un nombre pair, pour un exercice qui alterne les côtés : autant de chaque côté. */
const even = (value: number): number => Math.max(2, Math.ceil(value / 2) * 2);

export function prescribe(definition: ExerciseDefinition, role: SlotRole, context: Context): Prescription {
    const { settings, readiness, locale } = context;
    const range = targetRange(definition, settings, role);
    const [low, high] = range;
    const performances = performancesOf(context.input.history ?? [], definition, context.date);
    const familyCapacity = context.capacity.families[definition.family];
    const unit = definition.measure === 'time' ? ' s' : definition.measure === 'distance' ? ' m' : '';
    const increment = definition.measure === 'reps' ? 1 : definition.measure === 'time' ? 5 : 50;
    const [fewest, most] = settings.sets[context.level];
    const reasons: Reason[] = [];
    let step: ProgressionStep;
    let value: number;
    let tempo: Tempo | undefined;
    let progressionText: string;
    // Le bas de la cible peut descendre sous la fourchette de l'objectif : on dose sur ce que la personne fait.
    let floor = low;
    let extraSets = 0;
    let firstExposure = false;

    const last = performances[0];

    if (!last) {
        const before = familyCapacity !== undefined && definition.difficulty > familyCapacity ? previousInFamily(definition, context) : undefined;

        if (familyCapacity !== undefined && definition.difficulty > familyCapacity) {
            step = 'harder';
            firstExposure = true;
            // On repart d'une part de la dernière performance sur la variante plus facile, un quart de moins par marche.
            value = before ? Math.round(before.performance.best * Math.max(0.4, 1 - 0.25 * (definition.difficulty - before.definition.difficulty))) : low;
            floor = Math.min(low, Math.max(definition.range[0], value));
            progressionText = reason('progress-harder', {}, locale).text;
        } else if (familyCapacity !== undefined && definition.difficulty < familyCapacity) {
            step = 'easier';
            value = Math.round(low + (high - low) * 0.5);
            progressionText = reason('progress-easier', {}, locale).text;
        } else {
            step = 'start';
            firstExposure = true;
            value = Math.round(low + (high - low) * 0.25);
            progressionText = reason('progress-start', {}, locale).text;
        }

        // Une descente freinée la première fois : peu de répétitions, les courbatures viennent vite.
        if (definition.tags?.includes('eccentric')) {
            value = Math.min(value, definition.range[0] + 1);
            floor = Math.min(floor, value);
        }
    } else {
        const values = last.sets.map((set) => valueOf(set, definition.measure));
        const lowest = Math.min(...values);
        const average = values.reduce((sum, entry) => sum + entry, 0) / values.length;

        if (onPlateau(performances)) {
            // Au plateau, on garde l'exercice et on change de stimulus de façon faisable : plus lent, un peu moins de
            // répétitions, une série de plus.
            step = 'vary';
            value = Math.max(1, Math.round(average * 0.8));
            floor = Math.min(low, value);
            extraSets = 1;
            tempo = definition.measure === 'reps' ? 'slow' : undefined;
            progressionText = reason('progress-vary', { sessions: PLATEAU_SESSIONS }, locale).text;
        } else if (lowest >= high) {
            const loadable = LOADABLE_EQUIPMENT.some((id) => context.inventory.loadsOf(id).length > 0 && definition.equipment?.some((group) => group.includes(id)));

            step = loadable ? 'add-load' : 'add-set';
            value = high;
            extraSets = loadable ? 0 : 1;
            progressionText = reason(loadable ? 'progress-add-load' : 'progress-add-set', {}, locale).text;
        } else if (lowest >= low) {
            step = 'more';
            value = Math.min(high, Math.round(average) + increment);
            progressionText = reason('progress-more', { from: Math.round(average), to: value, unit }, locale).text;
        } else {
            // Sous la fourchette de l'objectif : on garde ce que la personne réussit, en séries plus courtes et plus nombreuses.
            step = 'hold';
            value = Math.max(1, Math.round(average));
            floor = Math.min(low, value);
            extraSets = value < low ? 1 : 0;
            progressionText = reason(value < low ? 'progress-build' : 'progress-hold', { value, unit }, locale).text;
        }
    }

    if (readiness.reasons.some((entry) => entry.code === 'comeback')) {
        step = 'comeback';
        firstExposure = true;
        value = Math.max(1, Math.round(value * 0.85));
        floor = Math.min(floor, value);
        progressionText = reason('progress-comeback', {}, locale).text;
    }

    if (readiness.level === 'easy' || readiness.level === 'recovery') {
        value = Math.max(1, Math.round(value * 0.9));
        floor = Math.min(floor, value);
    }

    // Les séries : le haut de la fourchette pour un exercice principal, le bas pour le reste ; moins la première fois.
    const volume = Math.min(1, readiness.volume);
    let sets = role === 'main' || role === 'skill' ? most : fewest;

    if (firstExposure) sets = fewest;
    if (firstExposure && definition.tags?.includes('eccentric')) sets = Math.min(sets, 2);

    sets = Math.max(1, Math.round((sets + extraSets) * readiness.volume));

    // Le plafond : une variante plus dure ou une reprise se découvre à une série de plus que le minimum, une
    // descente freinée à deux séries ; un premier essai ordinaire va jusqu’au nombre habituel de l’objectif.
    const usual = role === 'core' ? fewest + 1 : role === 'accessory' ? most : most + 1;
    const ceiling =
        firstExposure && definition.tags?.includes('eccentric')
            ? sets
            : step === 'harder' || step === 'comeback'
              ? Math.min(usual, fewest + 1)
              : step === 'start'
                ? Math.min(usual, most)
                : usual;
    const maxSets = Math.max(sets, Math.round(Math.max(sets, ceiling + extraSets) * volume));

    // Le repos et la réserve : un exercice d'appoint et le gainage se reposent moins qu'un gros mouvement.
    let restSeconds = role === 'main' && definition.compound ? settings.rest.compound : settings.rest.isolation;

    if (role === 'core') restSeconds = Math.min(restSeconds, 45);
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
    let warmupSets: { reps: number; kg: number }[] | undefined;

    if (loadEquipment) {
        const loads = context.inventory.loadsOf(loadEquipment);

        if (loads.length) {
            const lastLoad = last?.loadKg;

            if (lastLoad !== undefined) {
                const current = closestLoad(loads, lastLoad);
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
                const wanted = bodyweight * ratio * LEVEL_LOAD[context.level] * repsFactor(value, rir);

                load = { kg: closestLoad(loads, wanted), equipment: loadEquipment };
                note = reason('load-guess', { rir }, locale).text;
            }

            // Des séries d'approche avant un gros mouvement lourd : la moitié, puis les trois quarts de la charge.
            const heavy = context.goal === 'strength' || value <= 6 || load.kg >= (context.input.profile?.bodyweightKg ?? 70) * 0.4;

            if (role === 'main' && definition.compound && heavy) {
                const steps = [
                    { share: 0.5, reps: 5 },
                    { share: 0.75, reps: 3 },
                ]
                    .map((entry) => ({ reps: entry.reps, kg: closestLoad(loads, load!.kg * entry.share) }))
                    .filter((entry, index, list) => entry.kg < load!.kg && list.findIndex((other) => other.kg === entry.kg) === index);

                if (steps.length) warmupSets = steps;
            }
        } else {
            note = reason('load-choose', { rir }, locale).text;
        }
    }

    const rounded = definition.measure === 'time' ? Math.max(5, Math.round(value / 5) * 5) : Math.max(1, Math.round(value));
    const shaped = definition.alternating && definition.measure === 'reps' ? even(rounded) : rounded;
    const finalValue = Math.min(definition.alternating ? Math.max(high, even(high)) : high, Math.max(Math.min(floor, shaped), shaped));

    return {
        sets,
        target: { measure: definition.measure, value: finalValue, range: [Math.min(floor, finalValue), Math.max(high, finalValue)], perSide: Boolean(definition.unilateral) },
        restSeconds,
        ...(counted ? { rir } : {}),
        ...(tempo ? { tempo } : {}),
        ...(load ? { load } : {}),
        equipment: used,
        progression: { step, text: progressionText },
        ...(note ? { note } : {}),
        reasons,
        maxSets: Math.max(sets, maxSets),
        ...(warmupSets ? { warmupSets } : {}),
    };
}
