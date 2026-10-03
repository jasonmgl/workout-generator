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
import type { MovementPattern } from '../library/types';
import { reason } from '../i18n/messages';
import type { BlockFormat, SessionType } from '../types';
import { plannedBlockSeconds, type PlannedBlock, type PlannedItem } from './blocks';
import type { Context } from './context';
import { feasible } from './select';
import { repSeconds, workSeconds } from './timing';

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
    squat: ['hinge', 'knee-flexion'],
    lunge: ['hinge', 'knee-flexion'],
    hinge: ['squat', 'lunge'],
    'knee-flexion': ['squat', 'lunge'],
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
        const index = left.findIndex((other) => partners.includes(other.definition.pattern));

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

/** Une copie d'exercice faite pour un bloc en tours : une série par tour. */
const perRound = (item: PlannedItem): PlannedItem => ({ ...item, sets: 1, reasons: [...item.reasons] });

/** Les blocs principaux d'une séance, à partir des exercices dosés. */
export function buildMainBlocks(items: readonly PlannedItem[], format: BlockFormat, context: Context, mainSeconds: number): PlannedBlock[] {
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
        const rounds = Math.max(1, Math.round(items.reduce((sum, item) => sum + item.sets, 0) / items.length));
        const groups = items.length >= 7 ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items];

        return groups.map((group, index) => ({
            id: `main-${index + 1}`,
            role: 'main',
            format: 'circuit',
            title: title('block-circuit', context),
            rounds,
            restBetweenRounds: settings.circuit.betweenRounds,
            restBetweenItems: settings.circuit.betweenItems,
            items: group.map(perRound),
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
export function formatReason(blocks: readonly PlannedBlock[], context: Context): string | undefined {
    const main = blocks.find((block) => block.role === 'main' || block.role === 'finisher');

    if (!main) {
        return undefined;
    }

    const params = {
        minutes: Math.round((main.durationSeconds ?? plannedBlockSeconds(main)) / 60),
        work: main.workSeconds ?? 0,
        rest: main.restSeconds ?? 0,
    };

    return reason(`format-${main.format}`, params, context.locale).text;
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
export function cardioCandidates(context: Context, exclude: ReadonlySet<string> = new Set()): PlannedItem['definition'][] {
    const ceiling = context.level === 'beginner' ? 4 : context.level === 'intermediate' ? 6 : 8;

    return context.library
        .filter({ kinds: ['conditioning', 'power'], patterns: ['full-body', 'jump', 'cardio', 'locomotion'] })
        .filter((definition) => feasible(definition, context) && !exclude.has(definition.id) && definition.difficulty <= ceiling && definition.measure !== 'distance')
        .filter((definition) => !definition.tags?.includes('machine') && !definition.tags?.includes('outdoor'))
        .sort((a, b) => b.difficulty - a.difficulty || a.id.localeCompare(b.id));
}

/** Le cardio de fin de séance : quatre à six minutes d'intervalles. */
export function buildFinisher(context: Context, seconds: number, used: ReadonlySet<string>): PlannedBlock | undefined {
    const candidates = cardioCandidates(context, used);

    if (candidates.length === 0) {
        return undefined;
    }

    const count = Math.min(2, candidates.length);
    const picked = context.random.shuffle(candidates.slice(0, 6)).slice(0, count);
    const tabata = context.maxImpact === 'high' && context.level !== 'beginner' && context.random.next() < 0.5;

    return buildIntervals('finisher', 'finisher', picked, seconds, context, tabata);
}
