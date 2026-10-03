/**
 * La séance du jour, de bout en bout : la forme du jour et le type de
 * séance, le gabarit et ses places, l'exercice et le dosage de chaque
 * place, le format, l'échauffement et le retour au calme, puis l'ajustement
 * à la durée demandée. Chaque décision laisse une raison.
 *
 * Même entrée, même séance : la date et la graine font tout le hasard.
 */
import { MUSCLE_GROUPS, MUSCLE_INFO, type MuscleGroupId } from '../library/anatomy';
import { EQUIPMENT, satisfies, type EquipmentId } from '../library/equipment';
import type { ExerciseDefinition, MovementPattern } from '../library/types';
import { EQUIPMENT_NAMES, GROUP_NAMES, PATTERN_NAMES } from '../i18n/fr/labels';
import { reason } from '../i18n/messages';
import type { GenerateInput, Intensity, ReadinessAssessment, Reason, Session, SessionType } from '../types';
import { easyTarget, plannedBlockSeconds, toSessionBlock, type PlannedBlock, type PlannedItem } from './blocks';
import { chooseType, type TypeChoice } from './choose';
import { buildContext, type Context } from './context';
import { buildCooldown, cooldownSeconds, muscleLoad } from './cooldown';
import { buildFinisher, buildIntervals, buildMainBlocks, cardioCandidates, chooseFormat, formatReason } from './formats';
import { prescribe } from './prescribe';
import { feasible, pick } from './select';
import { FOCUS_SLOTS, PATTERN_GROUPS, TEMPLATES, type Slot } from './templates';
import { BLOCK_TRANSITION_SECONDS } from './timing';
import { buildWarmup, warmupSeconds } from './warmup';

/** Une demande d'intensité corrige la forme du jour : plus doux, ou un cran au-dessus. */
function withIntensity(context: Context): Context {
    const asked = context.request.intensity && context.request.intensity !== 'auto' ? context.request.intensity : context.input.plan?.intensity;

    if (!asked || asked === 'moderate') {
        return context;
    }

    const fromPlan = !context.request.intensity || context.request.intensity === 'auto';

    const factor = asked === 'easy' ? { volume: 0.8, intensity: 0.85 } : { volume: 1.1, intensity: 1.05 };
    const readiness: ReadinessAssessment = {
        ...context.readiness,
        volume: Math.round(Math.min(1.2, context.readiness.volume * factor.volume) * 100) / 100,
        intensity: Math.min(1.1, context.readiness.intensity * factor.intensity),
        reasons: [...context.readiness.reasons, reason(`${fromPlan ? 'plan-intensity' : 'intensity'}-${asked}`, {}, context.locale)],
    };

    return { ...context, readiness };
}

/** Les places de la séance : le gabarit, sans ce qu'on évite, avec ce qu'on vise juste après la base. */
export function slotsFor(type: SessionType, context: Context): Slot[] {
    const template = TEMPLATES[type];
    const avoided = (slot: Slot): boolean =>
        slot.patterns.every((pattern) => (PATTERN_GROUPS[pattern] ?? []).length > 0 && (PATTERN_GROUPS[pattern] ?? []).every((group) => context.avoidGroups.includes(group)));
    const focus = context.focusGroups.flatMap((group) => FOCUS_SLOTS[group]);

    return [...template.base.filter((slot) => !avoided(slot)), ...focus, ...template.extras.filter((slot) => !avoided(slot))];
}

/** Pour une place vide : le matériel qui la débloquerait, le plus souvent demandé par ses exercices. */
function missingEquipment(slot: Slot, context: Context): EquipmentId[] {
    const counts = new Map<EquipmentId, number>();
    const candidates = context.library.filter({ kinds: slot.kinds, patterns: slot.patterns });

    for (const definition of candidates) {
        if (satisfies(definition.equipment, context.inventory)) continue;

        for (const group of definition.equipment ?? []) {
            if (group.some((id) => context.inventory.has(id))) continue;

            for (const id of group) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || EQUIPMENT.indexOf(a[0]) - EQUIPMENT.indexOf(b[0]))
        .slice(0, 2)
        .map(([id]) => id);
}

/** La raison d'un exercice : ce qu'on vise, un favori, un groupe en retard. */
function itemReasons(definition: ExerciseDefinition, context: Context): Reason[] {
    const groups = [...new Set(definition.muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group))];
    const focused = groups.find((group) => context.focusGroups.includes(group));

    if (focused) return [reason('item-focus', { group: GROUP_NAMES[focused].toLowerCase() }, context.locale)];
    if (context.favorites.has(definition.id)) return [reason('item-favorite', {}, context.locale)];

    const behind = groups.find((group) => context.needs[group] >= 0.9 && context.body.groups[group].weeklySets > 0);

    if (behind) return [reason('item-need', { group: GROUP_NAMES[behind] }, context.locale)];

    return [];
}

function plan(definition: ExerciseDefinition, slot: Slot, context: Context): PlannedItem {
    const prescription = prescribe(definition, slot.role, context);

    return {
        definition,
        sets: prescription.sets,
        target: prescription.target,
        restSeconds: prescription.restSeconds,
        ...(prescription.rir !== undefined ? { rir: prescription.rir } : {}),
        ...(prescription.tempo ? { tempo: prescription.tempo } : {}),
        ...(prescription.load ? { load: prescription.load } : {}),
        equipment: prescription.equipment,
        progression: prescription.progression,
        ...(prescription.note ? { note: prescription.note } : {}),
        reasons: [...itemReasons(definition, context), ...prescription.reasons],
        slotRole: slot.role,
    };
}

/** L'ordre de la séance : poly-articulaire avant isolation, le plus dur d'abord, abdominaux et lombaires à la fin. */
const RANK_OF_ROLE: Readonly<Record<string, number>> = { skill: -1, main: 0, accessory: 1, core: 2, conditioning: 1 };

function order(items: readonly PlannedItem[]): PlannedItem[] {
    const rank = (item: PlannedItem): number => {
        const role = RANK_OF_ROLE[item.slotRole ?? 'accessory'] ?? 1;

        return role === 0 && !item.definition.compound ? 1 : role;
    };

    return [...items].sort((a, b) => rank(a) - rank(b) || b.definition.difficulty - a.definition.difficulty);
}

const totalSeconds = (blocks: readonly PlannedBlock[]): number =>
    blocks.reduce((sum, block) => sum + plannedBlockSeconds(block), 0) + Math.max(0, blocks.length - 1) * BLOCK_TRANSITION_SECONDS;

/** Les séries dures prévues par groupe : un muscle principal compte une série, un muscle qui aide une demi. */
function plannedVolume(blocks: readonly PlannedBlock[]): Partial<Record<MuscleGroupId, number>> {
    const volume: Partial<Record<MuscleGroupId, number>> = {};

    for (const block of blocks) {
        if (block.role === 'warmup' || block.role === 'cooldown') continue;

        for (const item of block.items) {
            if (!['strength', 'power', 'skill'].includes(item.definition.kind)) continue;

            const sets = item.sets * Math.max(1, block.rounds);
            const primary = new Set(item.definition.muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group));
            const helpers = new Set((item.definition.muscles.secondary ?? []).map((muscle) => MUSCLE_INFO[muscle].group));

            for (const group of MUSCLE_GROUPS) {
                const credit = primary.has(group) ? 1 : helpers.has(group) ? 0.5 : 0;

                if (credit) volume[group] = Math.round(((volume[group] ?? 0) + credit * sets) * 10) / 10;
            }
        }
    }

    return volume;
}

function intensityOf(context: Context): Intensity {
    const asked = context.request.intensity && context.request.intensity !== 'auto' ? context.request.intensity : context.input.plan?.intensity;

    if (asked) return asked;
    if (context.readiness.intensity < 1) return 'easy';
    if (context.readiness.level === 'push' || context.goal === 'strength') return 'hard';

    return 'moderate';
}

function finish(context: Context, choice: TypeChoice, type: SessionType, blocks: PlannedBlock[], extra: { reasons?: Reason[]; warnings?: Reason[] } = {}): Session {
    const volume = plannedVolume(blocks);
    const focus = context.focusGroups.length
        ? [...context.focusGroups]
        : (Object.entries(volume) as [MuscleGroupId, number][])
              .filter(([, sets]) => sets >= 2)
              .sort((a, b) => b[1] - a[1])
              .map(([group]) => group);
    const seconds = totalSeconds(blocks);
    const reasons = [...choice.reasons, ...(extra.reasons ?? []), ...context.readiness.reasons];
    const typeName = reason(`session-${type}`, {}, context.locale).text;
    const rest = choice.rest;
    const summary = [rest ? reason('rest-session', {}, context.locale).text : undefined, ...reasons.slice(0, 2).map((entry) => entry.text)]
        .filter((text): text is string => Boolean(text))
        .join(' ');

    return {
        version: 1,
        date: context.date,
        seed: context.seed,
        type,
        goal: context.goal,
        level: context.level,
        intensity: rest ? 'easy' : intensityOf(context),
        rest,
        title: reason(rest ? 'title-rest' : 'title', { type: typeName, minutes: Math.max(1, Math.round(seconds / 60)) }, context.locale).text,
        summary,
        minutes: context.minutes,
        estimatedMinutes: Math.round(seconds / 60),
        focus,
        volume,
        blocks: blocks.filter((block) => block.items.length > 0).map((block) => toSessionBlock(block, context)),
        readiness: context.readiness,
        reasons,
        warnings: [...context.readiness.warnings, ...(extra.warnings ?? [])],
    };
}

/** Une séance de renforcement : corps entier, haut, bas, pousser, tirer, tronc, figures. */
function strengthSession(context: Context, choice: TypeChoice, type: SessionType): Session {
    const warmBudget = context.request.warmup === false ? 0 : warmupSeconds(context);
    const coolBudget = context.request.cooldown === false ? 0 : cooldownSeconds(context);
    const total = context.minutes * 60;
    const canFinish =
        type !== 'skill' &&
        type !== 'core' &&
        context.readiness.level !== 'easy' &&
        context.minutes >= 25 &&
        context.random.next() < context.settings.finisher;
    const finisherBudget = canFinish ? (context.minutes >= 45 ? 360 : 240) : 0;
    const mainBudget = Math.max(150, total - warmBudget - coolBudget - finisherBudget - 3 * BLOCK_TRANSITION_SECONDS);
    const format = chooseFormat(context, type, mainBudget);
    const warnings: Reason[] = [];
    const skillItems: PlannedItem[] = [];
    let items: PlannedItem[] = [];
    const chosen = (): ExerciseDefinition[] => [...skillItems, ...items].map((item) => item.definition);
    const mainSeconds = (list: readonly PlannedItem[]): number =>
        totalSeconds([
            ...(skillItems.length ? [{ id: 'skill', role: 'skill', format: 'straight', title: '', rounds: 1, restBetweenRounds: 0, items: skillItems } as PlannedBlock] : []),
            ...buildMainBlocks(order(list), format, context, mainBudget),
        ]);

    // Ce qu'on a demandé d'inclure passe d'abord.
    for (const id of context.request.include ?? []) {
        const definition = context.library.find(id);

        if (definition && feasible(definition, context) && !chosen().some((other) => other.id === id)) {
            items.push(plan(definition, { key: `include-${id}`, role: definition.compound ? 'main' : 'accessory', patterns: [definition.pattern], kinds: [definition.kind] }, context));
        }
    }

    const slots = slotsFor(type, context);
    const baseKeys = new Set(TEMPLATES[type].base.map((slot) => slot.key));
    // Assez d'exercices pour couvrir le corps, pas tant qu'on n'en fasse que deux séries chacun.
    const minutesPerItem = format === 'circuit' ? 2.5 : format === 'amrap' || format === 'emom' ? 3 : format === 'superset' ? 3.5 : 5;
    const maxItems = Math.min(9, Math.max(3, Math.round(mainBudget / 60 / minutesPerItem)));
    const [, most] = context.settings.sets[context.level];
    const fits = (list: readonly PlannedItem[]): boolean => mainSeconds(list) <= mainBudget * 1.08;

    // Une série de plus, d'abord aux gros exercices, tant que le temps le permet.
    const grow = (ceiling: (item: PlannedItem) => number): void => {
        if (format === 'amrap' || format === 'emom') return;

        for (let guard = 0; guard < 40 && mainSeconds(items) < mainBudget * 0.9; guard++) {
            const item = order(items)
                .filter((entry) => entry.sets < ceiling(entry))
                .sort((a, b) => a.sets - b.sets)[0];

            if (!item) return;

            item.sets += 1;

            if (!fits(items)) {
                item.sets -= 1;
                return;
            }
        }
    };

    const place = (slot: Slot, optional = false): void => {
        // Les schémas de secours s'essaient dans l'ordre : les omoplates avant le gainage du dos.
        const definition =
            pick(slot, context, chosen()) ??
            (slot.fallback ?? []).reduce<ExerciseDefinition | undefined>(
                (found, pattern) => found ?? pick({ ...slot, key: `${slot.key}-fallback`, patterns: [pattern] }, context, chosen()),
                undefined,
            );

        if (!definition) {
            if (baseKeys.has(slot.key)) {
                const missing = missingEquipment(slot, context);

                warnings.push(
                    reason(
                        missing.length ? 'slot-empty-equipment' : 'slot-empty',
                        {
                            pattern: PATTERN_NAMES[slot.patterns[0] as MovementPattern].toLowerCase(),
                            equipment: missing.map((id) => EQUIPMENT_NAMES[id].toLowerCase()).join(' ou '),
                        },
                        context.locale,
                    ),
                );
            }

            return;
        }

        // Une place en plus ne vaut pas un doublon : si le seul candidat est de la même famille qu’un exercice déjà
        // choisi (des troisièmes pompes), on la laisse vide.
        if (optional && chosen().some((other) => other.family === definition.family)) {
            return;
        }

        const planned = plan(definition, slot, context);

        if (slot.role === 'skill') {
            skillItems.push(planned);
        } else if (items.length < 2 || (items.length < maxItems && fits([...items, planned]))) {
            items.push(planned);
        }
    };

    // Ce qu'on vise passe avant la base : avec « les bras » en focus, un curl et une extension des triceps sont
    // garantis, même si les gros mouvements du haut du corps remplissent déjà le temps.
    const focusKeys = new Set(context.focusGroups.flatMap((group) => FOCUS_SLOTS[group].map((slot) => slot.key)));
    const first = [...slots.filter((entry) => focusKeys.has(entry.key)), ...slots.filter((entry) => baseKeys.has(entry.key))];

    // 1. Ce qu'on vise et les places de base. 2. Des séries en plus. 3. Les places en plus. 4. Encore des séries.
    for (const slot of first) place(slot);

    grow((item) => (item.slotRole === 'main' ? most : most - 1));

    for (const slot of slots.filter((entry) => !baseKeys.has(entry.key) && !focusKeys.has(entry.key))) {
        if (items.length >= maxItems || mainSeconds(items) >= mainBudget * 0.92) break;

        place(slot, true);
    }

    grow(() => most + 1);

    for (let guard = 0; guard < 40 && mainSeconds(items) > mainBudget * 1.1; guard++) {
        const shrinkable = [...order(items)].reverse().find((item) => item.sets > 1);

        if (shrinkable) {
            shrinkable.sets -= 1;
        } else if (items.length > 2) {
            items = order(items).slice(0, -1);
        } else {
            break;
        }
    }

    const orderedItems = order(items);
    const blocks: PlannedBlock[] = [];
    const main = buildMainBlocks(orderedItems, format, context, mainBudget);
    const mainDefinitions = [...skillItems, ...orderedItems].map((item) => item.definition);

    if (warmBudget > 0) blocks.push(buildWarmup(mainDefinitions, context, warmBudget));
    if (skillItems.length) {
        blocks.push({ id: 'skill', role: 'skill', format: 'straight', title: reason('block-skill', {}, context.locale).text, rounds: 1, restBetweenRounds: 0, items: skillItems });
    }

    blocks.push(...main);

    const used = new Set(mainDefinitions.map((definition) => definition.id));
    const finisher = canFinish ? buildFinisher(context, finisherBudget, used) : undefined;
    const extraReasons: Reason[] = [];
    const explained = formatReason(main, context);

    if (explained) extraReasons.push({ code: `format-${format}`, text: explained });

    if (finisher) {
        blocks.push(finisher);
        extraReasons.push(reason('finisher', {}, context.locale));
    }

    if (coolBudget > 0) {
        blocks.push(buildCooldown(muscleLoad(blocks), context, { afterCardio: Boolean(finisher), budget: coolBudget }));
    }

    if (orderedItems.length === 0 && skillItems.length === 0) {
        warnings.push(reason('nothing-feasible', {}, context.locale));
    }

    return finish(context, choice, type, blocks, { reasons: extraReasons, warnings });
}

/** Une séance de cardio : en continu quand on a de quoi rouler, courir ou ramer ; en intervalles sinon. */
function cardioSession(context: Context, choice: TypeChoice, type: 'cardio' | 'hiit'): Session {
    const warmBudget = context.request.warmup === false ? 0 : warmupSeconds(context);
    const coolBudget = context.request.cooldown === false ? 0 : cooldownSeconds(context);
    const mainBudget = Math.max(180, context.minutes * 60 - warmBudget - coolBudget - 2 * BLOCK_TRANSITION_SECONDS);
    const blocks: PlannedBlock[] = [];
    const reasons: Reason[] = [];
    let main: PlannedBlock | undefined;

    if (type === 'cardio' && mainBudget >= 15 * 60) {
        const steady = context.library
            .filter({ kinds: ['conditioning'], patterns: ['cardio', 'locomotion'], measures: ['time'] })
            .filter((definition) => feasible(definition, context) && definition.range[1] >= 900)
            .sort((a, b) => b.met - a.met || a.id.localeCompare(b.id));
        const choiceOf = steady.find((definition) => definition.met <= (context.readiness.intensity < 1 ? 6 : 10)) ?? steady[0];

        if (choiceOf) {
            const value = Math.min(choiceOf.range[1], Math.max(choiceOf.range[0], Math.round(mainBudget / 60) * 60));

            main = {
                id: 'main-1',
                role: 'main',
                format: 'straight',
                title: reason('block-cardio', {}, context.locale).text,
                rounds: 1,
                restBetweenRounds: 0,
                items: [{ definition: choiceOf, sets: 1, target: { ...easyTarget(choiceOf), value }, restSeconds: 0, equipment: [], reasons: [reason('cardio-steady', {}, context.locale)] }],
            };
        }
    }

    if (!main) {
        const candidates = cardioCandidates(context);
        const count = Math.min(candidates.length, mainBudget >= 20 * 60 ? 6 : 4);
        const picked = context.random.shuffle(candidates.slice(0, Math.max(count, 8))).slice(0, count);

        main = buildIntervals('main-1', 'main', picked, mainBudget, context, mainBudget <= 8 * 60 && context.maxImpact === 'high');
    }

    if (main) {
        if (warmBudget > 0) blocks.push(buildWarmup(main.items.map((item) => item.definition), context, warmBudget));

        blocks.push(main);

        const explained = formatReason([main], context);

        if (explained) reasons.push({ code: `format-${main.format}`, text: explained });
    }

    if (coolBudget > 0) blocks.push(buildCooldown(muscleLoad(blocks), context, { afterCardio: true, budget: coolBudget }));

    return finish(context, choice, type, blocks, { reasons, ...(main ? {} : { warnings: [reason('nothing-feasible', {}, context.locale)] }) });
}

/** Une séance de mobilité, ou un repos actif : bouger les articulations, étirer, respirer. */
function mobilitySession(context: Context, choice: TypeChoice, type: 'mobility' | 'recovery'): Session {
    const gentle = type === 'recovery';
    const minutes = gentle ? Math.min(context.minutes, 15) : context.minutes;
    const budget = minutes * 60;
    const used = new Set<string>();
    const blocks: PlannedBlock[] = [];
    const fill = (id: string, role: PlannedBlock['role'], code: string, kinds: ('mobility' | 'stretch')[], seconds: number): void => {
        const block: PlannedBlock = { id, role, format: 'flow', title: reason(code, {}, context.locale).text, rounds: 1, restBetweenRounds: 0, items: [] };
        const options = context.random.shuffle(
            context.library
                .filter({ kinds, maxDifficulty: gentle ? 2 : 4 })
                .filter((definition) => feasible(definition, context) && !used.has(definition.id) && !definition.tags?.includes('self-massage')),
        );
        const focus = context.focusMuscles;
        const sorted = focus.size ? [...options].sort((a, b) => Number(b.muscles.primary.some((muscle) => focus.has(muscle))) - Number(a.muscles.primary.some((muscle) => focus.has(muscle)))) : options;
        const families = new Set<string>();

        for (const definition of sorted) {
            if (plannedBlockSeconds(block) >= seconds) break;
            if (families.has(definition.family)) continue;

            families.add(definition.family);
            used.add(definition.id);
            block.items.push({ definition, sets: 1, target: easyTarget(definition, 0.5), restSeconds: 0, equipment: [], reasons: [] });
        }

        blocks.push(block);
    };

    fill('main-1', 'main', 'block-mobility', ['mobility'], budget * 0.45);
    fill('cooldown', 'cooldown', 'block-stretch', ['stretch'], budget * 0.3);

    const breathing = context.library.filter({ kinds: ['breathing'] }).filter((definition) => feasible(definition, context));

    if (breathing.length) {
        const definition = breathing.find((entry) => entry.id === 'diaphragmatic-breathing') ?? breathing[0]!;
        const value = Math.min(definition.range[1], Math.max(definition.range[0], gentle ? 180 : 120));

        blocks[blocks.length - 1]!.items.push({ definition, sets: 1, target: { ...easyTarget(definition), value }, restSeconds: 0, equipment: [], reasons: [reason('cooldown-breathing', {}, context.locale)] });
    }

    return finish({ ...context, minutes }, choice, type, blocks);
}

/** La séance du jour. */
export function generateSession(input: GenerateInput): Session {
    const context = withIntensity(buildContext(input));
    const choice = chooseType(context);
    const ignored = context.readiness.level === 'rest' && context.request.ignoreReadiness;
    const withWarning = ignored ? { ...context, readiness: { ...context.readiness, warnings: [...context.readiness.warnings, reason('readiness-ignored', {}, context.locale)] } } : context;

    switch (choice.type) {
        case 'mobility':
        case 'recovery':
            return mobilitySession(withWarning, choice, choice.type);
        case 'cardio':
        case 'hiit':
            return cardioSession(withWarning, choice, choice.type);
        default:
            return strengthSession(withWarning, choice, choice.type);
    }
}
