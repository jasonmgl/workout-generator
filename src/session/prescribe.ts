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
import { daysBetween } from '../dates';
import { performancesOf, struggledOn, valueOf, type ExercisePerformance } from '../history/progress';
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
    readonly load?: { readonly kg: number; readonly equipment: EquipmentId; readonly estimated?: boolean };
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

/** La charge la plus lourde qui ne dépasse pas un poids voulu (la plus légère si tout est plus lourd) : pour reprendre. */
export function loadAtMost(loads: readonly number[], wanted: number): number {
    return loads.filter((load) => load <= wanted).pop() ?? loads[0]!;
}

/**
 * Ce que pèse une série selon ses répétitions et sa réserve, par rapport à une série de dix : la règle d'Epley
 * (publique), qui donne la part du maximum qu'on soulève pour un nombre de répétitions donné.
 */
const repsFactor = (reps: number, rir: number): number => (1 + 10 / 30) / (1 + (reps + rir) / 30);

/** Les répétitions qu’on fait avec une charge en gardant la réserve visée, quand `base` est la charge d’une série de dix. */
const repsAt = (kg: number, base: number, rir: number): number => Math.round(30 * (((1 + 10 / 30) * base) / kg - 1) - rir);

/**
 * Une charge estimée parmi celles qu’on a, celle du dessous ou celle du dessus : celle dont les répétitions,
 * recalculées pour garder la réserve, tombent dans la fourchette de l’objectif (`goal`), la plus proche du poids
 * voulu à égalité. Des haltères de 4 en 4 kg ne font plus partir à 4 kg quand on en voulait 6,8. Les répétitions
 * restent dans la fiche (`allowed`).
 */
export function estimatedLoad(
    loads: readonly number[],
    base: number,
    value: number,
    rir: number,
    goal: readonly [number, number],
    allowed: readonly [number, number],
): { kg: number; value: number } {
    const wanted = base * repsFactor(value, rir);
    const below = loads.filter((load) => load <= wanted).pop();
    const above = loads.find((load) => load > wanted);
    // Trop peu de répétitions sert mal l’objectif et charge trop : cela pèse trois fois plus que trop de répétitions.
    const outside = (reps: number): number => Math.max(0, (goal[0] - reps) * 3, reps - goal[1]);
    const [kg] = [below, above]
        .filter((load): load is number => load !== undefined)
        .map((load) => [load, outside(repsAt(load, base, rir)), Math.abs(load - wanted)] as const)
        .sort((a, b) => a[1] - b[1] || a[2] - b[2])[0]!;

    return { kg, value: Math.max(allowed[0], Math.min(allowed[1], repsAt(kg, base, rir))) };
}

/** Ce qu’on reprend de la charge d’avant après un arrêt, selon les jours sans l’exercice (chiffres à nous). */
export function comebackLoadFactor(daysOff: number): number {
    if (daysOff > 42) return 0.7;
    if (daysOff > 20) return 0.8;
    if (daysOff > 7) return 0.9;

    return 1;
}

/**
 * Le plafond d’une première fois (première séance, variante plus dure, reprise) : la cible et la réserve tiennent dans
 * les six premiers dixièmes de la fourchette de la fiche. Neuf tractions en supination avec trois en réserve, c’est le
 * maximum de la fiche : un nouveau venu échoue dès le premier jour.
 */
export function firstTimeCap(definition: ExerciseDefinition, rir: number): number {
    const [lowest, highest] = definition.range;

    return Math.max(lowest, Math.floor(lowest + 0.6 * (highest - lowest)) - rir);
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

/**
 * Un exercice qui ne fatigue pas assez pour qu’une réserve veuille dire quelque chose : activation, posture,
 * rééducation, gainage facile. Ni réserve affichée, ni réserve retranchée du plafond d’une première fois.
 */
export function gentle(definition: ExerciseDefinition): boolean {
    const trunk = definition.pattern.startsWith('anti-') || definition.pattern.startsWith('trunk-');

    return Boolean(definition.tags?.some((tag) => tag === 'activation' || tag === 'posture' || tag === 'rehab')) || (trunk && definition.difficulty <= 2);
}

/** Une variante sœur déjà faite : même famille, même difficulté, même mesure ; la plus récente. */
function siblingPerformances(definition: ExerciseDefinition, context: Context): { definition: ExerciseDefinition; performances: ExercisePerformance[] } | undefined {
    let found: { definition: ExerciseDefinition; performances: ExercisePerformance[] } | undefined;

    for (const member of context.library.family(definition.family)) {
        if (member.id === definition.id || member.measure !== definition.measure || Math.abs(member.difficulty - definition.difficulty) > 0.5) continue;

        const performances = performancesOf(context.input.history ?? [], member, context.date);

        if (performances.length && (!found || performances[0]!.date > found.performances[0]!.date)) {
            found = { definition: member, performances };
        }
    }

    return found;
}

/** Un nombre pair, pour un exercice qui alterne les côtés : autant de chaque côté. */
const even = (value: number): number => Math.max(2, Math.ceil(value / 2) * 2);

/**
 * Doser un exercice pour sa place. Une place du focus (`focus`) garde la fourchette de son rôle (un curl reste à 8-12),
 * mais a les séries d’une place principale : c’est le groupe que la personne a demandé de travailler.
 */
export function prescribe(definition: ExerciseDefinition, role: SlotRole, context: Context, options: { readonly focus?: boolean } = {}): Prescription {
    const { settings, readiness, locale } = context;
    const range = targetRange(definition, settings, role);
    const [low, high] = range;
    const own = performancesOf(context.input.history ?? [], definition, context.date);
    // Sans historique propre, une variante sœur déjà faite (tractions en supination après des tractions) se dose sur
    // ce qui s’y fait, pas comme une première fois.
    const sibling = own.length ? undefined : siblingPerformances(definition, context);
    const performances = own.length ? own : (sibling?.performances ?? []);
    const counted = definition.measure === 'reps' && (definition.kind === 'strength' || definition.kind === 'power') && !gentle(definition);
    const rir = definition.kind === 'power' ? 3 : settings.rir + (readiness.level === 'easy' || readiness.level === 'recovery' ? 1 : 0);
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

        if (struggledOn(last)) {
            // Après un échec ou une séance ressentie dure : on tient la meilleure série faite avec de la réserve, ou un
            // peu moins que la moyenne, sans monter.
            const safe = last.sets.filter((set) => set.rir !== undefined && set.rir >= 1).map((set) => valueOf(set, definition.measure));

            step = 'hold';
            value = safe.length ? Math.max(...safe) : Math.max(1, Math.round(average) - increment);
            floor = Math.min(low, value);
            progressionText = reason('progress-hold-failure', { value, unit }, locale).text;
        } else if (onPlateau(performances)) {
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

        if (sibling) {
            progressionText = reason('progress-sibling', { name: context.library.name(sibling.definition.id, locale), value: Math.round(average), unit }, locale).text;
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

    // Une première fois au poids du corps tient dans la fiche, réserve comprise ; le volume qui manque vient d’une série
    // de plus. Avec une charge, c’est elle qui règle l’effort.
    if (firstExposure && definition.measure !== 'distance' && !definition.tags?.includes('loaded')) {
        const cap = firstTimeCap(definition, counted ? rir : 0);

        if (value > cap) {
            value = cap;
            floor = Math.min(floor, value);
            if (value < low) extraSets = 1;
        }
    }

    // Les séries : le haut de la fourchette pour un exercice principal ou du focus, le bas pour le reste ; moins la
    // première fois.
    const volume = Math.min(1, readiness.volume);
    const leading = role === 'main' || role === 'skill' || Boolean(options.focus);
    let sets = leading ? most : fewest;

    if (firstExposure) sets = fewest;
    if (firstExposure && definition.tags?.includes('eccentric')) sets = Math.min(sets, 2);

    sets = Math.max(1, Math.round((sets + extraSets) * readiness.volume));

    // Le plafond : une variante plus dure ou une reprise se découvre à une série de plus que le minimum, une
    // descente freinée à deux séries ; un premier essai ordinaire va jusqu’au nombre habituel de l’objectif.
    const usual = leading || role === 'conditioning' ? most + 1 : role === 'core' ? fewest + 1 : most;
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
    let load: { kg: number; equipment: EquipmentId; estimated?: boolean } | undefined;
    let note: string | undefined;
    let warmupSets: { reps: number; kg: number }[] | undefined;

    if (loadEquipment) {
        const loads = context.inventory.loadsOf(loadEquipment);

        if (loads.length) {
            const lastLoad = last?.loadKg;

            if (lastLoad !== undefined && step === 'comeback') {
                // À la reprise, la charge baisse avec la durée de l’arrêt : la charge d’avant, avec deux en réserve après
                // six semaines sans séance, c’est la reprise trop lourde.
                const factor = comebackLoadFactor(daysBetween(last!.date, context.date));

                load = { kg: loadAtMost(loads, lastLoad * factor), equipment: loadEquipment, ...(factor < 1 ? { estimated: true } : {}) };
            } else if (lastLoad !== undefined) {
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
                const estimate = estimatedLoad(loads, bodyweight * ratio * LEVEL_LOAD[context.level], value, rir, [Math.min(floor, low), high], [definition.range[0], high]);

                load = { kg: estimate.kg, equipment: loadEquipment, estimated: true };
                value = estimate.value;
                floor = Math.min(floor, value);
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
        // La réserve ne promet pas plus que la fiche : une traction sur un bras à une répétition n’en garde pas trois.
        ...(counted ? { rir: definition.tags?.includes('loaded') ? rir : Math.max(1, Math.min(rir, definition.range[1] - finalValue)) } : {}),
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
