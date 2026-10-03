/**
 * Ranger les exercices choisis selon un format : séries classiques, par
 * deux (supersets), en circuit, le plus de tours possible (AMRAP), une série
 * par minute (EMOM), en échelle, ou en intervalles chronométrés.
 *
 * Le format se tire selon l'objectif (la force aime les séries classiques,
 * la perte de gras les circuits), sauf si la personne en demande un. Une
 * séance très courte passe en circuit : c'est ce qui tient le mieux dans dix
 * minutes.
 */
import { GROUP_REGION, MUSCLE_INFO } from '../library/anatomy';
import type { MovementPattern } from '../library/types';
import { reason } from '../i18n/messages';
import type { BlockFormat, Reason, SessionType } from '../types';
import { plannedBlockSeconds, type PlannedBlock, type PlannedItem } from './blocks';
import type { Context } from './context';
import { feasible } from './select';
import { repSeconds, workSeconds } from './timing';
import { POSTURE_ORDER } from './warmup';

/** Les formats que sait faire un bloc principal de renforcement. */
const MAIN_FORMATS: readonly BlockFormat[] = ['straight', 'superset', 'circuit', 'amrap', 'emom', 'ladder'];

export function chooseFormat(context: Context, type: SessionType, mainSeconds: number): BlockFormat {
    const asked = context.request.format;

    if (asked && asked !== 'auto' && MAIN_FORMATS.includes(asked)) {
        return asked;
    }

    if (type === 'skill') {
        return 'straight';
    }

    if (mainSeconds <= 12 * 60) {
        return context.goal === 'strength' ? 'emom' : 'circuit';
    }

    // Un AMRAP ou un EMOM de plus de 20 minutes use plus qu’il ne sert : au-delà, un circuit.
    const drawn = context.random.weighted(context.settings.formats, ([, chance]) => chance)[0];

    return (drawn === 'amrap' || drawn === 'emom') && mainSeconds > 20 * 60 ? 'circuit' : drawn;
}

/** Les schémas qui se répondent : on les met ensemble dans un superset. */
const PARTNERS: Readonly<Partial<Record<MovementPattern, readonly MovementPattern[]>>> = {
    'horizontal-push': ['horizontal-pull', 'vertical-pull'],
    'vertical-push': ['vertical-pull', 'horizontal-pull'],
    'horizontal-pull': ['horizontal-push', 'vertical-push'],
    'vertical-pull': ['vertical-push', 'horizontal-push'],
    squat: ['horizontal-pull', 'vertical-pull', 'hinge', 'knee-flexion'],
    lunge: ['horizontal-pull', 'vertical-pull', 'hinge', 'knee-flexion'],
    hinge: ['horizontal-push', 'vertical-push', 'squat', 'lunge'],
    'knee-flexion': ['horizontal-push', 'vertical-push', 'squat', 'lunge'],
    'elbow-flexion': ['elbow-extension'],
    'elbow-extension': ['elbow-flexion'],
    'anti-extension': ['trunk-extension'],
    'trunk-extension': ['anti-extension', 'trunk-flexion'],
};

/** Former des paires : chaque exercice avec son opposé s'il y en a un, sinon avec le suivant. */
export function pairUp(items: readonly PlannedItem[]): PlannedItem[][] {
    const left = [...items];
    const pairs: PlannedItem[][] = [];

    while (left.length) {
        const first = left.shift()!;
        const partners = PARTNERS[first.definition.pattern] ?? [];
        // Le partenaire le plus haut dans la liste de préférence, pas le premier venu.
        const ranked = partners.map((pattern) => left.findIndex((other) => other.definition.pattern === pattern)).filter((found) => found >= 0);
        const index = ranked.length ? ranked[0]! : -1;

        if (index >= 0) {
            pairs.push([first, left.splice(index, 1)[0]!]);
        } else if (left.length) {
            pairs.push([first, left.shift()!]);
        } else if (pairs.length) {
            // Resté seul : il rejoint la dernière paire, qui devient un trio, plutôt que de traîner en séries à part.
            pairs[pairs.length - 1]!.push(first);
        } else {
            pairs.push([first]);
        }
    }

    return pairs;
}

const title = (code: string, context: Context, params = {}): string => reason(code, params, context.locale).text;

/** La région d'un exercice, d'après son premier muscle principal. */
const regionOf = (item: PlannedItem): string => GROUP_REGION[MUSCLE_INFO[item.definition.muscles.primary[0]!].group];

/** L'écart entre deux positions : se relever du sol pour un exercice debout coûte, enchaîner deux exercices au sol non. */
const postureGap = (a: PlannedItem, b: PlannedItem): number => Math.abs(POSTURE_ORDER.indexOf(a.definition.posture) - POSTURE_ORDER.indexOf(b.definition.posture));

/** Ce que coûte un ordre : deux exercices de la même région d'affilée pèsent plus que deux allers-retours au sol. */
function orderCost(order: readonly PlannedItem[], original: readonly PlannedItem[]): number {
    let cost = 0;

    for (let index = 1; index < order.length; index++) {
        cost += (regionOf(order[index]!) === regionOf(order[index - 1]!) ? 12 : 0) + postureGap(order[index]!, order[index - 1]!);
    }

    // À coût égal, l'ordre le plus proche de l'ordre d'importance.
    return cost + order.reduce((sum, item, index) => sum + Math.abs(original.indexOf(item) - index), 0) / 100;
}

function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) {
        return [[...items]];
    }

    return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

/**
 * Ranger un circuit : ne pas enchaîner deux exercices de la même région
 * quand on peut l'éviter, et ne pas se relever et se recoucher à chaque
 * exercice. Le premier, le plus important, reste en tête ; les autres
 * prennent le meilleur ordre (un circuit en a six au plus, 120 ordres).
 */
export function alternateRegions(items: readonly PlannedItem[]): PlannedItem[] {
    if (items.length <= 2 || items.length > 7) {
        return [...items];
    }

    const [first, ...others] = items;
    let best: PlannedItem[] = [...items];
    let bestCost = orderCost(best, items);

    for (const order of permutations(others)) {
        const candidate = [first!, ...order];
        const cost = orderCost(candidate, items);

        if (cost < bestCost) {
            best = candidate;
            bestCost = cost;
        }
    }

    return best;
}

const TRUNK: ReadonlySet<MovementPattern> = new Set(['anti-extension', 'anti-rotation', 'anti-lateral-flexion', 'trunk-flexion', 'trunk-rotation', 'trunk-extension']);

/** Une copie d'exercice faite pour un bloc en tours : une série par tour. */
const perRound = (item: PlannedItem): PlannedItem => ({ ...item, sets: 1, reasons: [...item.reasons] });

/**
 * Les blocs principaux d'une séance, à partir des exercices dosés. Un exercice plafonné à deux séries (une première
 * descente freinée) sort d'un bloc qui a plus de tours, en séries classiques avant les
 * autres : un circuit de quatre tours ne fait pas faire quatre fois une première série de curls nordiques.
 */
export function buildMainBlocks(items: readonly PlannedItem[], format: BlockFormat, context: Context, mainSeconds: number): PlannedBlock[] {
    const blocks = assembleBlocks(items, format, context, mainSeconds);
    const held: PlannedItem[] = [];
    const kept: PlannedBlock[] = [];

    for (const block of blocks) {
        const out = block.format === 'straight' || block.format === 'ladder' ? [] : block.items.filter((item) => (item.maxSets ?? Infinity) < block.rounds && (item.maxSets ?? Infinity) <= 2);

        if (!out.length) {
            kept.push(block);
            continue;
        }

        held.push(...out.map((item) => items.find((original) => original.definition.id === item.definition.id) ?? item));

        const left = block.items.filter((item) => !out.includes(item));

        if (left.length === 1) {
            // Son partenaire resté seul le suit en séries classiques, plutôt que de traîner seul plus loin.
            const original = items.find((entry) => entry.definition.id === left[0]!.definition.id) ?? left[0]!;

            held.push({ ...original, sets: Math.max(original.sets, block.rounds) });
        } else if (left.length > 1) {
            const pair = left.length === 2 && (block.format === 'superset' || block.format === 'circuit') && block.items.length === 3;

            kept.push({ ...block, items: left, ...(pair ? { format: 'superset' as const, title: title('block-superset', context) } : {}) });
        }
    }

    if (!held.length) {
        return blocks;
    }

    // Les gros mouvements d’abord, le gainage à la fin.
    const rank = (item: PlannedItem): number => (TRUNK.has(item.definition.pattern) ? 2 : item.definition.compound ? 0 : 1);
    const first: PlannedBlock = { id: 'main-0', role: 'main', format: 'straight', title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: [...held].sort((a, b) => rank(a) - rank(b)) };

    return [first, ...kept].map((block, index) => ({ ...block, id: `main-${index + 1}` }));
}

function assembleBlocks(items: readonly PlannedItem[], format: BlockFormat, context: Context, mainSeconds: number): PlannedBlock[] {
    if (items.length === 0) {
        return [];
    }

    const settings = context.settings;

    if (format === 'straight') {
        return [{ id: 'main-1', role: 'main', format, title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: [...items] }];
    }

    if (format === 'ladder') {
        const [first, ...others] = items;
        const rungs = Math.max(3, Math.min(5, Math.round(first!.target.value * 0.6)));
        const ladders = Math.max(2, Math.min(4, first!.sets));
        const perSet = Array.from({ length: ladders }, () => Array.from({ length: rungs }, (_, index) => index + 1)).flat();
        const ladder: PlannedBlock = {
            id: 'main-1',
            role: 'main',
            format: 'ladder',
            title: title('block-ladder', context),
            rounds: 1,
            restBetweenRounds: 0,
            items: [{ ...first!, perSet, sets: perSet.length, restSeconds: Math.round(first!.restSeconds / 4) }],
        };

        return others.length
            ? [ladder, { id: 'main-2', role: 'main', format: 'straight', title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: others }]
            : [ladder];
    }

    if (format === 'superset') {
        return pairUp(items).map((pair, index): PlannedBlock => {
            if (pair.length === 1) {
                return { id: `main-${index + 1}`, role: 'main', format: 'straight', title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: pair };
            }

            return {
                id: `main-${index + 1}`,
                role: 'main',
                format: pair.length === 2 ? 'superset' : 'circuit',
                title: title(pair.length === 2 ? 'block-superset' : 'block-triset', context),
                rounds: Math.max(...pair.map((item) => item.sets)),
                restBetweenRounds: Math.max(...pair.map((item) => item.restSeconds)),
                restBetweenItems: 10,
                items: pair.map(perRound),
            };
        });
    }

    if (format === 'circuit') {
        const groups = items.length >= 7 ? [items.filter((_, index) => index % 2 === 0), items.filter((_, index) => index % 2 === 1)] : [items];

        return groups.map((group, index) => ({
            id: `main-${index + 1}`,
            role: 'main',
            format: 'circuit',
            title: title('block-circuit', context),
            rounds: Math.max(2, Math.round(group.reduce((sum, item) => sum + item.sets, 0) / group.length)),
            restBetweenRounds: settings.circuit.betweenRounds,
            restBetweenItems: settings.circuit.betweenItems,
            items: alternateRegions(group).map(perRound),
        }));
    }

    if (format === 'amrap') {
        const minutes = Math.max(5, Math.min(20, Math.round(mainSeconds / 60)));
        const chosen = items.slice(0, 5).map((item) => ({
            ...perRound(item),
            target: { ...item.target, value: Math.max(1, Math.round(item.target.value * 0.7)), range: [Math.min(item.target.range[0], Math.max(1, Math.round(item.target.value * 0.7))), item.target.range[1]] as const },
        }));
        const oneRound = chosen.reduce((sum, item) => sum + workSeconds(item.definition, item.target, item.tempo) + 10, 0);

        return [
            {
                id: 'main-1',
                role: 'main',
                format: 'amrap',
                title: title('block-amrap', context, { minutes }),
                rounds: Math.max(1, Math.floor((minutes * 60) / oneRound)),
                restBetweenRounds: 0,
                durationSeconds: minutes * 60,
                items: chosen,
            },
        ];
    }

    if (format === 'emom') {
        const chosen = items.slice(0, 3).map((item) => {
            const capped =
                item.target.measure === 'reps'
                    ? Math.min(item.target.value, Math.max(1, Math.floor(40 / ((item.tempo ? repSeconds(item.tempo) : (item.definition.secondsPerRep ?? 3)) * (item.target.perSide ? 2 : 1)))))
                    : Math.min(item.target.value, item.target.perSide ? 20 : 40);

            return { ...perRound(item), target: { ...item.target, value: capped, range: [Math.min(item.target.range[0], capped), item.target.range[1]] as const } };
        });
        const cycles = Math.max(2, Math.floor(mainSeconds / 60 / chosen.length));

        return [
            {
                id: 'main-1',
                role: 'main',
                format: 'emom',
                title: title('block-emom', context, { minutes: cycles * chosen.length }),
                rounds: cycles,
                restBetweenRounds: 0,
                durationSeconds: cycles * chosen.length * 60,
                items: chosen,
            },
        ];
    }

    return [{ id: 'main-1', role: 'main', format: 'straight', title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: [...items] }];
}

/** La phrase qui explique un format. */
export function formatReason(blocks: readonly PlannedBlock[], context: Context): Reason | undefined {
    const candidates = blocks.filter((block) => block.role === 'main' || block.role === 'finisher');
    // Le format qui fait la séance : des séries classiques en tête (une première descente freinée à part) n’en font pas une séance en séries classiques.
    const main = candidates.find((block) => block.role === 'main' && block.format !== 'straight') ?? candidates[0];

    if (!main) {
        return undefined;
    }

    const params = {
        minutes: Math.round((main.durationSeconds ?? plannedBlockSeconds(main)) / 60),
        work: main.workSeconds ?? 0,
        rest: main.restSeconds ?? 0,
    };

    // Un circuit d'un seul tour n'est pas « on recommence ».
    const code = main.format === 'circuit' && main.rounds <= 1 ? 'format-circuit-once' : `format-${main.format}`;

    return reason(code, params, context.locale);
}

/**
 * Un bloc d'intervalles : chaque exercice tenu `work` secondes, `rest` de
 * récupération, autant de tours qu'il en tient dans le temps donné. Le
 * Tabata est le cas 20 / 10 en huit intervalles.
 */
export function buildIntervals(
    id: string,
    role: PlannedBlock['role'],
    exercises: readonly PlannedItem['definition'][],
    seconds: number,
    context: Context,
    tabata = false,
): PlannedBlock | undefined {
    if (exercises.length === 0) {
        return undefined;
    }

    const beginner = context.level === 'beginner';
    const work = tabata ? 20 : beginner ? Math.min(30, context.settings.intervals.work) : context.settings.intervals.work;
    const rest = tabata ? 10 : beginner ? Math.max(30, context.settings.intervals.rest) : context.settings.intervals.rest;
    // Un cardio de fin de séance enchaîne ses tours : quatre minutes coupées d'une minute de pause n'en font plus que deux.
    const restBetweenRounds = tabata || role === 'finisher' ? 0 : 60;
    const perRound = exercises.length * (work + rest);
    const rounds = tabata ? Math.max(1, Math.round(8 / exercises.length)) : Math.max(1, Math.floor((seconds + restBetweenRounds) / (perRound + restBetweenRounds)));

    return {
        id,
        role,
        format: tabata ? 'tabata' : 'intervals',
        title: title(role === 'finisher' ? 'block-finisher' : tabata ? 'block-tabata' : 'block-intervals', context),
        rounds,
        restBetweenRounds,
        workSeconds: work,
        restSeconds: rest,
        items: exercises.map((definition) => ({
            definition,
            sets: 1,
            target: { measure: 'time', value: work, range: [work, work], perSide: false },
            restSeconds: rest,
            equipment: [],
            reasons: [],
        })),
    };
}

/** Les exercices de cardio faisables, du plus adapté au niveau au moins adapté. */
/** La difficulté visée pour le cardio : celle du niveau, un cran plus bas un jour de petite forme. */
const CARDIO_TARGET: Readonly<Record<string, number>> = { beginner: 2.5, intermediate: 4, advanced: 5.5, expert: 6.5 };

function cardioTarget(context: Context): number {
    const base = CARDIO_TARGET[context.level] ?? 3;

    return base - (context.readiness.intensity < 0.85 ? 2 : context.readiness.intensity < 1 ? 1 : 0);
}

/**
 * Les exercices de cardio faisables, du plus proche du niveau au plus lointain. Ce qui se fait avec le matériel
 * déclaré (une corde à sauter, un sac de frappe) passe devant : c'est souvent ce que la personne préfère.
 */
export function cardioCandidates(context: Context, exclude: ReadonlySet<string> = new Set()): PlannedItem['definition'][] {
    const target = cardioTarget(context);
    const declared = new Set((context.input.equipment ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.id)));

    return context.library
        .filter({ kinds: ['conditioning', 'power'], patterns: ['full-body', 'jump', 'cardio', 'locomotion'] })
        .filter((definition) => feasible(definition, context) && !exclude.has(definition.id) && definition.measure !== 'distance')
        .filter((definition) => !definition.tags?.includes('machine') && !definition.tags?.includes('outdoor'))
        .map((definition) => ({
            definition,
            distance: Math.abs(definition.difficulty - target) - ((definition.equipment ?? []).flat().some((id) => declared.has(id)) ? 1.5 : 0),
        }))
        .sort((a, b) => a.distance - b.distance || a.definition.id.localeCompare(b.definition.id))
        .map((entry) => entry.definition);
}

/**
 * Des exercices d'intervalles : variés (une famille et un schéma chacun), au plus un exercice à fort impact pour un
 * débutant, aucun quand les jambes ont déjà beaucoup travaillé. Un coach commence par des pas chassés et des
 * montées de genoux, pas par des sauts en longueur.
 */
export function pickIntervalExercises(
    context: Context,
    count: number,
    exclude: ReadonlySet<string> = new Set(),
    options: { readonly legsLoaded?: boolean } = {},
): PlannedItem['definition'][] {
    const pool = cardioCandidates(context, exclude).slice(0, Math.max(count * 3, 9));
    const order = context.random.shuffle(pool.slice(0, Math.max(count * 2, 6))).concat(pool.slice(Math.max(count * 2, 6)));
    const picked: PlannedItem['definition'][] = [];
    const families = new Set<string>();
    const maxHigh = options.legsLoaded ? 0 : context.level === 'beginner' ? 1 : count;

    for (const definition of order) {
        if (picked.length >= count) break;
        if (families.has(definition.family)) continue;
        if (definition.impact === 'high' && picked.filter((entry) => entry.impact === 'high').length >= maxHigh) continue;
        if (picked.length && picked[picked.length - 1]!.pattern === definition.pattern && order.some((other) => !families.has(other.family) && other.pattern !== definition.pattern)) continue;

        families.add(definition.family);
        picked.push(definition);
    }

    return picked;
}

/** Le cardio de fin de séance : quatre à six minutes d'intervalles, sans sauts sur des jambes déjà bien chargées. */
export function buildFinisher(context: Context, seconds: number, used: ReadonlySet<string>, legsLoaded = false): PlannedBlock | undefined {
    const picked = pickIntervalExercises(context, 2, used, { legsLoaded });

    if (picked.length === 0) {
        return undefined;
    }

    const tabata = context.maxImpact === 'high' && context.level !== 'beginner' && !legsLoaded && context.random.next() < 0.5;

    return buildIntervals('finisher', 'finisher', picked, seconds, context, tabata);
}
