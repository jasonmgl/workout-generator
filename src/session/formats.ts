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
import { feasible, loadsErectors } from './select';
import { BLOCK_TRANSITION_SECONDS, repSeconds, workSeconds } from './timing';
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

    // Le hasard se tire toujours, et dans le même ordre : un jour léger donne la même séance en plus doux, pas un autre
    // tirage.
    const drawn = context.random.weighted(context.settings.formats, ([, chance]) => chance)[0];
    const format: BlockFormat = mainSeconds <= 12 * 60 ? (context.goal === 'strength' ? 'emom' : 'circuit') : drawn;

    // Un AMRAP ou un EMOM pousse à l’effort maximal : jamais un jour léger, et jamais plus de 20 minutes (il use plus
    // qu’il ne sert). Un circuit à la place.
    return (format === 'amrap' || format === 'emom') && (lightDay(context) || mainSeconds > 20 * 60) ? 'circuit' : format;
}

/** Un jour léger : petite forme, ou séance légère du plan. Rien qui pousse à l’effort maximal, plus de repos entre les tours. */
export function lightDay(context: Context): boolean {
    return context.readiness.volume < 0.95 || context.readiness.level === 'easy' || context.readiness.level === 'recovery';
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

/**
 * Former des paires : chaque exercice avec son opposé s'il y en a un, sinon avec le suivant qui ne charge pas les
 * mêmes muscles (pas un good morning derrière un soulevé de terre).
 */
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
            const apart = left.findIndex((other) => !shareLoad(first, other));

            pairs.push([first, left.splice(Math.max(0, apart), 1)[0]!]);
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

/** Deux exercices sollicitent-ils tous les deux les érecteurs du rachis, même en aide ? */
const bothErectors = (a: PlannedItem, b: PlannedItem): boolean => loadsErectors(a.definition) && loadsErectors(b.definition);

/** Deux exercices ont-ils un groupe en commun parmi leurs muscles principaux ? */
function sharePrimary(a: PlannedItem, b: PlannedItem): boolean {
    const groups = new Set(a.definition.muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group));

    return b.definition.muscles.primary.some((muscle) => groups.has(MUSCLE_INFO[muscle].group));
}

/** Deux exercices chargent-ils un même groupe : par leurs muscles principaux, ou le bas du dos par les érecteurs ? */
const shareLoad = (a: PlannedItem, b: PlannedItem): boolean => bothErectors(a, b) || sharePrimary(a, b);

/** L'écart entre deux positions : se relever du sol pour un exercice debout coûte, enchaîner deux exercices au sol non. */
const postureGap = (a: PlannedItem, b: PlannedItem): number => Math.abs(POSTURE_ORDER.indexOf(a.definition.posture) - POSTURE_ORDER.indexOf(b.definition.posture));

/**
 * Ce que coûte un ordre : deux exercices de la même région d'affilée, qui ont des muscles principaux en commun, et
 * surtout qui chargent tous les deux les érecteurs (un good morning puis des extensions lombaires), pèsent plus que
 * deux allers-retours au sol.
 */
function orderCost(order: readonly PlannedItem[], original: readonly PlannedItem[]): number {
    let cost = 0;

    for (let index = 1; index < order.length; index++) {
        const [previous, current] = [order[index - 1]!, order[index]!];
        const muscles = (sharePrimary(previous, current) ? 12 : 0) + (bothErectors(previous, current) ? 12 : 0);

        cost += (regionOf(current) === regionOf(previous) ? 12 : 0) + muscles + postureGap(current, previous);
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
 * descente freinée, ou n'importe quel exercice un jour léger) sort d'un bloc qui a plus de tours, en séries classiques
 * avant les autres : un circuit de quatre tours ne fait pas faire quatre fois une première série de curls nordiques.
 */
export function buildMainBlocks(items: readonly PlannedItem[], format: BlockFormat, context: Context, mainSeconds: number): PlannedBlock[] {
    // Un bloc minuté (AMRAP, EMOM) compte des tours, pas des séries : une première descente freinée n’y entre pas du
    // tout. Elle se fait avant, en séries classiques, et le bloc garde les autres exercices et le reste du temps (jamais
    // ses tours donnés en séries à l’exercice resté seul).
    const descent = (item: PlannedItem): boolean => Boolean(item.definition.tags?.includes('eccentric')) && (item.maxSets ?? Infinity) <= 2;
    const descents = format === 'amrap' || format === 'emom' ? items.filter(descent) : [];

    if (descents.length && descents.length < items.length) {
        const before: PlannedBlock = { id: 'main-1', role: 'main', format: 'straight', title: title('block-main', context), rounds: 1, restBetweenRounds: 0, items: descents };
        const timed = assembleBlocks(
            items.filter((item) => !descents.includes(item)),
            format,
            context,
            Math.max(0, mainSeconds - plannedBlockSeconds(before) - BLOCK_TRANSITION_SECONDS),
        );

        return [before, ...timed].map((block, index) => ({ ...block, id: `main-${index + 1}` }));
    }

    const blocks = assembleBlocks(items, format, context, mainSeconds);
    const held: PlannedItem[] = [];
    const kept: PlannedBlock[] = [];

    for (const block of blocks) {
        // Une descente freinée, ou un exercice plafonné par la petite forme du jour : un exercice ordinaire plafonné à deux
        // séries par l’objectif seul (l’endurance d’un débutant) suit les tours de son circuit, plutôt que de partir seul
        // en séries classiques. Les tours d’un bloc minuté ne sont pas des séries : il garde ses exercices.
        const capped = (item: PlannedItem): boolean =>
            (Boolean(item.definition.tags?.includes('eccentric')) || lightDay(context)) && (item.maxSets ?? Infinity) < block.rounds && (item.maxSets ?? Infinity) <= 2;
        const out = ['straight', 'ladder', 'amrap', 'emom'].includes(block.format) ? [] : block.items.filter(capped);

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

/**
 * Couper une longue liste en deux circuits : ce qu'on vise dans le premier, celui qu'on fait le plus frais, puis les
 * autres un sur deux, dans l'ordre de la séance, en commençant par le premier circuit : chacun a sa part des gros
 * mouvements, et le premier d'entre eux reste en tête de séance.
 */
function splitCircuit(items: readonly PlannedItem[]): PlannedItem[][] {
    const size = Math.ceil(items.length / 2);
    const first = items.filter((item) => item.focus).slice(0, size);
    const second: PlannedItem[] = [];
    let turn = 0;

    for (const item of items) {
        if (first.includes(item)) continue;

        const toFirst = second.length >= items.length - size || (first.length < size && turn % 2 === 0);

        (toFirst ? first : second).push(item);
        turn++;
    }

    return [items.filter((item) => first.includes(item)), items.filter((item) => second.includes(item))];
}

/** Les exercices qu'un bloc limité garde : ce qu'on vise d'abord, puis l'ordre de la séance, qu'on ne change pas. */
function focusFirst(items: readonly PlannedItem[], count: number): PlannedItem[] {
    const kept = [...items.filter((item) => item.focus), ...items.filter((item) => !item.focus)].slice(0, count);

    return items.filter((item) => kept.includes(item));
}

/** Les répétitions d'un tour, arrondies ; en alternance, un nombre pair : autant de chaque côté. */
const paired = (item: PlannedItem, value: number, round: (x: number) => number): number =>
    item.definition.alternating && item.target.measure === 'reps' ? Math.max(2, round(value / 2) * 2) : Math.max(1, round(value));

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
                // Autant de tours que le mieux servi des deux ; un jour léger, pas au-delà du plafond du jour de l'autre.
                rounds: Math.min(Math.max(...pair.map((item) => item.sets)), lightDay(context) ? Math.min(...pair.map((item) => item.maxSets ?? Infinity)) : Infinity),
                restBetweenRounds: Math.max(...pair.map((item) => item.restSeconds)),
                restBetweenItems: 10,
                items: pair.map(perRound),
            };
        });
    }

    if (format === 'circuit') {
        const groups = items.length >= 7 ? splitCircuit(items) : [items];

        // Autant de tours que la moyenne des séries, et au moins celles de ce qu'on vise, sans faire dépasser aux autres
        // leur plafond (une variante découverte, la petite forme du jour). Le circuit sans ce qu'on vise n'en fait pas
        // plus que celui de ce qu'on vise.
        const roundsOf = (group: readonly PlannedItem[]): number => {
            const focus = Math.max(0, ...group.filter((item) => item.focus).map((item) => item.sets));
            const ceiling = Math.min(...group.map((item) => item.maxSets ?? Infinity));

            return Math.max(2, Math.round(group.reduce((sum, item) => sum + item.sets, 0) / group.length), Math.min(focus, ceiling));
        };
        const focusRounds = Math.max(0, ...groups.filter((group) => group.some((item) => item.focus)).map(roundsOf));
        const rounds = groups.map((group) => (focusRounds && !group.some((item) => item.focus) ? Math.max(2, Math.min(roundsOf(group), focusRounds)) : roundsOf(group)));

        return groups.map((group, index) => ({
            id: `main-${index + 1}`,
            role: 'main',
            format: 'circuit',
            title: title('block-circuit', context),
            rounds: rounds[index]!,
            restBetweenRounds: settings.circuit.betweenRounds + (lightDay(context) ? 15 : 0),
            restBetweenItems: settings.circuit.betweenItems,
            items: alternateRegions(group).map(perRound),
        }));
    }

    if (format === 'amrap') {
        const minutes = Math.max(5, Math.min(20, Math.round(mainSeconds / 60)));
        const chosen = focusFirst(items, 5).map((item) => {
            const value = paired(item, item.target.value * 0.7, Math.round);

            return { ...perRound(item), target: { ...item.target, value, range: [Math.min(item.target.range[0], value), item.target.range[1]] as const } };
        });
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
        const chosen = focusFirst(items, 3).map((item) => {
            const capped =
                item.target.measure === 'reps'
                    ? Math.min(item.target.value, Math.max(1, Math.floor(40 / ((item.tempo ? repSeconds(item.tempo) : (item.definition.secondsPerRep ?? 3)) * (item.target.perSide ? 2 : 1)))))
                    : Math.min(item.target.value, item.target.perSide ? 20 : 40);

            const value = paired(item, capped, Math.floor);

            return { ...perRound(item), target: { ...item.target, value, range: [Math.min(item.target.range[0], value), item.target.range[1]] as const } };
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
