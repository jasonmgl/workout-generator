/**
 * La séance du jour, de bout en bout : la forme du jour et le type de
 * séance, le gabarit et ses places, l'exercice et le dosage de chaque
 * place, le format, l'échauffement et le retour au calme, puis l'ajustement
 * à la durée demandée. Chaque décision laisse une raison.
 *
 * Même entrée, même séance : la date et la graine font tout le hasard.
 */
import { GROUP_REGION, MUSCLE_GROUPS, MUSCLE_INFO, type MuscleGroupId } from '../library/anatomy';
import { EQUIPMENT, inventory, satisfies, type EquipmentId } from '../library/equipment';
import type { ExerciseDefinition, MovementPattern } from '../library/types';
import { EQUIPMENT_NAMES, GROUP_NAMES, GROUP_NAMES_WITH_ARTICLE, JOINT_NAMES, PATTERN_NAMES } from '../i18n/fr/labels';
import { reason } from '../i18n/messages';
import type { GenerateInput, Intensity, ReadinessAssessment, Reason, Session, SessionType } from '../types';
import { easyTarget, plannedBlockSeconds, toSessionBlock, type PlannedBlock, type PlannedItem } from './blocks';
import { chooseType, type TypeChoice } from './choose';
import { buildContext, type Context } from './context';
import { GOAL_SETTINGS } from './goals';
import { buildCooldown, cooldownSeconds, muscleLoad } from './cooldown';
import { buildFinisher, buildIntervals, buildMainBlocks, cardioCandidates, chooseFormat, formatReason, pickIntervalExercises } from './formats';
import { prescribe } from './prescribe';
import { feasible, pick } from './select';
import { FOCUS_SLOTS, PATTERN_GROUPS, TEMPLATES, type Slot } from './templates';
import { BLOCK_TRANSITION_SECONDS } from './timing';
import { buildWarmup, byPosture, gentleCeiling, warmupSeconds } from './warmup';

/** Une demande d'intensité corrige la forme du jour : plus doux, ou un cran au-dessus. */
function withIntensity(context: Context): Context {
    const requested = context.request.intensity && context.request.intensity !== 'auto' ? context.request.intensity : undefined;
    // L'intensité du plan est plafonnée par la forme : une séance « dure » prévue ne l'est pas un jour de petite forme.
    const planned = context.input.plan?.intensity;
    const tired = context.readiness.intensity < 1;
    const asked = requested ?? (planned === 'hard' && tired ? undefined : planned);

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

const PUSHES: readonly MovementPattern[] = ['horizontal-push', 'vertical-push'];
const PULLS: readonly MovementPattern[] = ['horizontal-pull', 'vertical-pull'];

/**
 * Pour une place vide ou tenue par un secours : le matériel qui débloquerait un exercice de la place que la
 * personne pourrait vraiment faire aujourd'hui (articulations, sauts, ce qu'elle évite compris), le plus souvent
 * demandé d'abord. Jamais une marche pour des squats qu'un genou douloureux écarterait de toute façon.
 */
function missingEquipment(slot: Slot, context: Context): EquipmentId[] {
    const counts = new Map<EquipmentId, number>();
    const candidates = context.library.filter({ kinds: slot.kinds, patterns: slot.patterns });

    for (const definition of candidates) {
        if (satisfies(definition.equipment, context.inventory)) continue;

        const pieces = new Set((definition.equipment ?? []).flat().filter((id) => !context.inventory.has(id)));

        for (const id of pieces) {
            const extended = inventory([...context.inventory.ids, id], []);

            if (satisfies(definition.equipment, extended) && feasible(definition, { ...context, inventory: extended })) {
                counts.set(id, (counts.get(id) ?? 0) + 1);
            }
        }
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || EQUIPMENT.indexOf(a[0]) - EQUIPMENT.indexOf(b[0]))
        .slice(0, 2)
        .map(([id]) => id);
}

/** La place est-elle vide à cause du corps (articulations, sauts, évitements) plutôt que du matériel ? */
function blockedByBody(slot: Slot, context: Context): boolean {
    return context.library
        .filter({ kinds: slot.kinds, patterns: slot.patterns })
        .some((definition) => satisfies(definition.equipment, context.inventory) && !feasible(definition, context));
}

/** Les articulations ménagées aujourd'hui, nommées. */
function sparedJoints(context: Context): string {
    return listOf(
        [...context.jointTolerance.keys()].map((joint) => JOINT_NAMES[joint].toLowerCase()),
        context,
    );
}

/** « a », « a ou b », « a, b ou c ». */
function listOf(items: readonly string[], context: Context): string {
    if (items.length <= 1) return items[0] ?? '';

    return `${items.slice(0, -1).join(', ')} ${reason('list-or', {}, context.locale).text} ${items[items.length - 1]}`;
}

/** La raison d'un exercice : ce qu'on vise, un favori, un groupe en retard. */
function itemReasons(definition: ExerciseDefinition, context: Context): Reason[] {
    const groups = [...new Set(definition.muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group))];
    const focused = groups.find((group) => context.focusGroups.includes(group));

    if (focused) return [reason('item-focus', { group: GROUP_NAMES_WITH_ARTICLE[focused] }, context.locale)];
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
        maxSets: prescription.maxSets,
        ...(prescription.warmupSets ? { warmupSets: prescription.warmupSets } : {}),
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

            // Un exercice d'activation ou de posture (Y-T-W, cobra) ne vaut pas une série dure : il compte pour moitié.
            const light = item.definition.tags?.some((tag) => tag === 'activation' || tag === 'posture' || tag === 'rehab') ? 0.5 : 1;
            const sets = item.sets * Math.max(1, block.rounds) * light;
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
    const requested = context.request.intensity && context.request.intensity !== 'auto' ? context.request.intensity : undefined;
    const planned = context.input.plan?.intensity;
    const asked = requested ?? (planned === 'hard' && context.readiness.intensity < 1 ? 'easy' : planned);

    if (asked) return asked;
    if (context.readiness.intensity < 1) return 'easy';
    if (context.readiness.level === 'push' || context.goal === 'strength') return 'hard';

    return 'moderate';
}

function finish(
    context: Context,
    choice: TypeChoice,
    type: SessionType,
    blocks: PlannedBlock[],
    extra: { reasons?: Reason[]; warnings?: Reason[]; notes?: Reason[] } = {},
): Session {
    const volume = plannedVolume(blocks);
    const focus = context.focusGroups.length
        ? [...context.focusGroups]
        : (Object.entries(volume) as [MuscleGroupId, number][])
              .filter(([, sets]) => sets >= 2)
              .sort((a, b) => b[1] - a[1])
              .map(([group]) => group);
    const seconds = totalSeconds(blocks);
    const reasons = [...context.readiness.reasons, ...choice.reasons, ...(extra.reasons ?? [])];
    const typeName = reason(`session-${type}`, {}, context.locale).text;
    const rest = choice.rest;
    const summary = summarize(context, choice, extra.reasons ?? []);

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
        // Chaque bloc compte le temps pour s’y mettre : la somme des blocs fait la durée annoncée.
        blocks: blocks.filter((block) => block.items.length > 0).map((block, index) => toSessionBlock(block, context, index > 0 ? BLOCK_TRANSITION_SECONDS : 0)),
        readiness: context.readiness,
        reasons,
        warnings: [...context.readiness.warnings, ...(extra.warnings ?? [])],
        notes: extra.notes ?? [],
    };
}

/** Les raisons de la forme du jour, de la plus importante à la moins importante : c'est la première qu'on lit. */
const READINESS_PRIORITY: readonly string[] = [
    'declared-rest',
    'ill',
    'pulse-high',
    'cycle-period-strong',
    'pulse-recovering',
    'pulse-raised',
    'no-rest-streak',
    'joint-pain',
    'cycle-period',
    'short-sleep',
    'feeling-low',
    'feeling-tired',
    'comeback',
    'last-hard',
    'cycle-period-light',
    'sore',
    'last-easy',
    'feeling-great',
    'cycle-luteal',
    'cycle-ovulation',
    'cycle-follicular',
];

/** Les raisons du type qui ne font que redire le titre ou une raison de forme : pas dans le résumé. */
const SILENT_TYPE_REASONS: readonly string[] = ['type-asked', 'type-recovery'];

/**
 * Le résumé de la séance, trois phrases au plus : ce que la personne a déclaré (douleur, cycle, pouls, petite
 * forme), puis pourquoi ce type de séance quand cela apprend quelque chose, puis comment elle se fait.
 */
function summarize(context: Context, choice: TypeChoice, extra: readonly Reason[]): string {
    const readiness = [...context.readiness.reasons].sort((a, b) => {
        const rank = (entry: Reason): number => (READINESS_PRIORITY.includes(entry.code) ? READINESS_PRIORITY.indexOf(entry.code) : READINESS_PRIORITY.length);

        return rank(a) - rank(b);
    });
    const typeReasons = choice.reasons.filter((entry) => !SILENT_TYPE_REASONS.includes(entry.code));
    const parts = [
        ...(choice.rest ? [reason('rest-session', {}, context.locale)] : []),
        ...readiness.slice(0, choice.rest ? 1 : 1),
        ...(choice.rest ? [] : typeReasons.slice(0, 1)),
        ...(choice.rest ? [] : extra.filter((entry) => entry.code.startsWith('format-') || entry.code === 'session-lighter').slice(0, 2)),
    ];

    return parts.map((entry) => entry.text).join(' ');
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
        context.random.next() < context.settings.finisher &&
        cardioCandidates(context).length > 0;
    const finisherBudget = canFinish ? (context.minutes >= 45 ? 360 : 240) : 0;
    const transitions = [warmBudget > 0, coolBudget > 0, canFinish, type === 'skill'].filter(Boolean).length * BLOCK_TRANSITION_SECONDS;
    const available = Math.max(120, total - warmBudget - coolBudget - finisherBudget - transitions);
    // Un jour léger, on travaille moins longtemps : le temps libéré n'est pas rempli d'autres séries.
    const lighter = context.readiness.volume < 0.95;
    const mainBudget = Math.round(available * Math.min(1, context.readiness.volume));
    const format = chooseFormat(context, type, mainBudget);
    const warnings: Reason[] = [];
    const notes: Reason[] = [];
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
    // Un jour léger, moins d’exercices aussi : sinon le temps libéré se remplit d’exercices en plus.
    const maxItems = Math.min(9, Math.max(3, Math.round((available / 60 / minutesPerItem) * Math.min(1, context.readiness.volume))));
    const [, most] = context.settings.sets[context.level];
    const fits = (list: readonly PlannedItem[]): boolean => mainSeconds(list) <= mainBudget * 1.08;

    // Une série de plus, d'abord aux gros exercices, tant que le temps le permet.
    const regionOf = (item: PlannedItem): string => GROUP_REGION[MUSCLE_INFO[item.definition.muscles.primary[0]!].group];
    const grow = (ceiling: (item: PlannedItem) => number): void => {
        if (format === 'amrap' || format === 'emom') return;

        const blocked = new Set<PlannedItem>();

        for (let guard = 0; guard < 60 && mainSeconds(items) < mainBudget * 0.9; guard++) {
            const regionSets = (region: string): number => items.filter((entry) => regionOf(entry) === region).reduce((sum, entry) => sum + entry.sets, 0);
            const item = order(items)
                .filter((entry) => !blocked.has(entry) && entry.sets < Math.min(ceiling(entry), entry.maxSets ?? Infinity))
                .sort((a, b) => a.sets - b.sets || regionSets(regionOf(a)) - regionSets(regionOf(b)))[0];

            if (!item) return;

            item.sets += 1;

            if (!fits(items)) {
                item.sets -= 1;
                blocked.add(item);
            }
        }
    };

    // Le temps qui reste, quand plus aucune série ne rentre : quelques répétitions ou secondes de plus, dans la fourchette.
    const lengthen = (): void => {
        const blocked = new Set<PlannedItem>();

        for (let guard = 0; guard < 80 && mainSeconds(items) < mainBudget * 0.9; guard++) {
            // Seulement ce qui n’a pas d’historique, et jusqu’au milieu de la fourchette : on ne bouscule pas une progression.
            const roomFor = (entry: PlannedItem): number => entry.target.range[0] + (entry.target.range[1] - entry.target.range[0]) * 0.6;
            const item = order(items).find(
                (entry) =>
                    !blocked.has(entry) &&
                    entry.target.measure !== 'distance' &&
                    entry.slotRole !== 'skill' &&
                    (entry.progression?.step === 'start' || entry.progression?.step === 'easier') &&
                    entry.target.value < roomFor(entry),
            );

            if (!item) return;

            const stepSize = item.target.measure === 'time' ? 5 : item.definition.alternating ? 2 : 1;
            const previous = item.target;

            item.target = { ...previous, value: Math.min(previous.range[1], previous.value + stepSize) };

            if (!fits(items)) {
                item.target = previous;
                blocked.add(item);
            }
        }
    };

    const place = (slot: Slot, optional = false): void => {
        const pushes = items.filter((entry) => PUSHES.includes(entry.definition.pattern)).length;
        const pulls = items.filter((entry) => PULLS.includes(entry.definition.pattern)).length;

        // Une poussée en plus n'entre que s'il y a déjà autant de vrais tirages que de poussées.
        if (optional && slot.patterns.every((pattern) => PUSHES.includes(pattern)) && pushes >= pulls) {
            return;
        }

        // Les schémas de secours s'essaient dans l'ordre : les omoplates avant le gainage du dos.
        const direct = pick(slot, context, chosen(), optional);
        const definition =
            direct ??
            (slot.fallback ?? []).reduce<ExerciseDefinition | undefined>(
                (found, pattern) => found ?? pick({ ...slot, key: `${slot.key}-fallback`, patterns: [pattern] }, context, chosen(), optional),
                undefined,
            );

        if (definition && !direct && baseKeys.has(slot.key)) {
            const missing = missingEquipment(slot, context);

            if (missing.length) {
                notes.push(
                    reason(
                        'slot-fallback-equipment',
                        { pattern: PATTERN_NAMES[slot.patterns[0] as MovementPattern].toLowerCase(), equipment: listOf(missing.map((id) => EQUIPMENT_NAMES[id].toLowerCase()), context) },
                        context.locale,
                    ),
                );
            }
        }

        if (!definition) {
            if (baseKeys.has(slot.key)) {
                const missing = missingEquipment(slot, context);
                const pattern = PATTERN_NAMES[slot.patterns[0] as MovementPattern].toLowerCase();

                if (blockedByBody(slot, context)) {
                    warnings.push(reason('slot-empty-joint', { pattern, joints: sparedJoints(context) }, context.locale));
                } else {
                    warnings.push(
                        reason(
                            missing.length ? 'slot-empty-equipment' : 'slot-empty',
                            { pattern, equipment: listOf(missing.map((id) => EQUIPMENT_NAMES[id].toLowerCase()), context) },
                            context.locale,
                        ),
                    );
                }
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
    lengthen();

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
    // Des sauts en fin de séance sur des cuisses qui ont déjà fait six séries ou plus : non.
    const loadSoFar = muscleLoad(blocks);
    const legsLoaded = Math.max(loadSoFar.get('quads') ?? 0, loadSoFar.get('glute-max') ?? 0) >= 6;
    const finisher = canFinish ? buildFinisher(context, finisherBudget, used, legsLoaded) : undefined;
    const extraReasons: Reason[] = [];
    const explained = formatReason(main, context);

    if (explained) extraReasons.push(explained);
    if (lighter) extraReasons.push(reason('session-lighter', {}, context.locale));

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

    return finish(context, choice, type, blocks, { reasons: extraReasons, warnings, notes });
}

/** Une séance de cardio : en continu quand on a de quoi rouler, courir ou ramer ; en intervalles sinon. */
function cardioSession(context: Context, choice: TypeChoice, type: 'cardio' | 'hiit'): Session {
    const warmBudget = context.request.warmup === false ? 0 : warmupSeconds(context, true);
    const coolBudget = context.request.cooldown === false ? 0 : cooldownSeconds(context);
    const transitions = [warmBudget > 0, coolBudget > 0].filter(Boolean).length * BLOCK_TRANSITION_SECONDS;
    const available = Math.max(180, context.minutes * 60 - warmBudget - coolBudget - transitions);
    const mainBudget = Math.round(available * Math.min(1, context.readiness.volume));
    const blocks: PlannedBlock[] = [];
    const reasons: Reason[] = [];
    let main: PlannedBlock | undefined;
    let steadyDefinition: ExerciseDefinition | undefined;

    if (type === 'cardio' && mainBudget >= 15 * 60) {
        const steady = context.library
            .filter({ kinds: ['conditioning'], patterns: ['cardio', 'locomotion'], measures: ['time'] })
            .filter((definition) => feasible(definition, context) && definition.range[1] >= 900)
            .sort((a, b) => b.met - a.met || a.id.localeCompare(b.id));

        steadyDefinition = steady.find((definition) => definition.met <= (context.readiness.intensity < 1 ? 6 : 10)) ?? steady[0];

        if (steadyDefinition) {
            const value = Math.min(steadyDefinition.range[1], Math.max(steadyDefinition.range[0], Math.round(mainBudget / 60) * 60));

            main = {
                id: 'main-1',
                role: 'main',
                format: 'steady',
                title: reason('block-cardio', {}, context.locale).text,
                rounds: 1,
                restBetweenRounds: 0,
                items: [
                    {
                        definition: steadyDefinition,
                        sets: 1,
                        target: { ...easyTarget(steadyDefinition), value },
                        restSeconds: 0,
                        equipment: [],
                        reasons: [reason('cardio-steady', {}, context.locale)],
                    },
                ],
            };
        }
    }

    if (!main) {
        const picked = pickIntervalExercises(context, mainBudget >= 20 * 60 ? 6 : 4);

        main = buildIntervals('main-1', 'main', picked, mainBudget, context, mainBudget <= 8 * 60 && context.maxImpact === 'high' && context.level !== 'beginner');
    }

    if (main) {
        if (warmBudget > 0) {
            const warmup = buildWarmup(
                main.items.map((item) => item.definition),
                context,
                warmBudget,
                steadyDefinition ? {} : { intervals: main.items.map((item) => item.definition) },
            );

            // Avant un cardio continu, l'échauffement commence sur la même machine, en douceur.
            if (steadyDefinition) {
                warmup.items[0] = {
                    definition: steadyDefinition,
                    sets: 1,
                    target: { ...easyTarget(steadyDefinition), value: Math.min(300, Math.round(warmBudget * 0.6 / 30) * 30) },
                    restSeconds: 0,
                    equipment: [],
                    reasons: [reason('warmup-steady', {}, context.locale)],
                };
            }

            blocks.push(warmup);
        }

        blocks.push(main);

        const explained = formatReason([main], context);

        if (explained) reasons.push(explained);
        if (context.readiness.volume < 0.95) reasons.push(reason('session-lighter', {}, context.locale));
    }

    if (coolBudget > 0) {
        blocks.push(buildCooldown(muscleLoad(blocks), context, { afterCardio: true, budget: coolBudget, ...(steadyDefinition ? { continueWith: steadyDefinition } : {}) }));
    }

    return finish(context, choice, type, blocks, { reasons, ...(main ? {} : { warnings: [reason('nothing-feasible', {}, context.locale)] }) });
}

/**
 * Une séance de mobilité, ou un repos actif : bouger les articulations, étirer, respirer. Douce selon le niveau et
 * la forme du jour, rangée du debout vers le sol, et remplie jusqu'à la durée demandée.
 */
function mobilitySession(context: Context, choice: TypeChoice, type: 'mobility' | 'recovery'): Session {
    const gentle = type === 'recovery';
    const minutes = gentle ? Math.min(context.minutes, 15) : context.minutes;
    const budget = minutes * 60;
    const ceiling = gentle ? 2 : gentleCeiling(context);
    const used = new Set<string>();
    const blocks: PlannedBlock[] = [];
    const breathingSeconds = gentle ? 180 : 120;
    const fill = (id: string, role: PlannedBlock['role'], code: string, kinds: ('mobility' | 'stretch')[], seconds: number): void => {
        const block: PlannedBlock = { id, role, format: 'flow', title: reason(code, {}, context.locale).text, rounds: 1, restBetweenRounds: 0, items: [] };
        const options = context.random.shuffle(
            context.library
                .filter({ kinds, maxDifficulty: ceiling })
                .filter((definition) => feasible(definition, context) && !used.has(definition.id) && !definition.tags?.includes('self-massage')),
        );
        const focus = context.focusMuscles;
        const sorted = focus.size
            ? [...options].sort((a, b) => Number(b.muscles.primary.some((muscle) => focus.has(muscle))) - Number(a.muscles.primary.some((muscle) => focus.has(muscle))))
            : options;
        const families = new Set<string>();

        for (const definition of sorted) {
            if (plannedBlockSeconds(block) >= seconds) break;
            if (families.has(definition.family)) continue;

            families.add(definition.family);
            used.add(definition.id);
            block.items.push({ definition, sets: 1, target: easyTarget(definition, 0.5), restSeconds: 0, equipment: [], reasons: [] });
        }

        // Plus assez de mouvements différents pour tenir le temps : un deuxième tour.
        if (block.items.length && plannedBlockSeconds(block) < seconds * 0.7) {
            block.rounds = 2;
        }

        block.items = byPosture(block.items);
        blocks.push(block);
    };

    fill('main-1', 'main', 'block-mobility', ['mobility'], budget * 0.55);
    fill('cooldown', 'cooldown', 'block-stretch', ['stretch'], Math.max(60, budget - plannedBlockSeconds(blocks[0]!) - breathingSeconds - BLOCK_TRANSITION_SECONDS));

    const breathing = context.library.filter({ kinds: ['breathing'] }).filter((definition) => feasible(definition, context));

    if (breathing.length) {
        const definition = breathing.find((entry) => entry.id === 'diaphragmatic-breathing') ?? breathing[0]!;
        const value = Math.min(definition.range[1], Math.max(definition.range[0], breathingSeconds));

        blocks[blocks.length - 1]!.items.push({ definition, sets: 1, target: { ...easyTarget(definition), value }, restSeconds: 0, equipment: [], reasons: [reason('cooldown-breathing', {}, context.locale)] });
    }

    return finish({ ...context, minutes }, choice, type, blocks, { reasons: [reason('format-flow', {}, context.locale)] });
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
        case 'skill':
            // Une séance de figures se travaille comme la force : séries courtes, repos complets, réserve de deux.
            return strengthSession({ ...withWarning, settings: GOAL_SETTINGS.strength }, choice, choice.type);
        default:
            return strengthSession(withWarning, choice, choice.type);
    }
}
