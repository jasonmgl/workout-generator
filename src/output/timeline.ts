/**
 * La séance dépliée, étape par étape, telle qu'un lecteur la joue : un
 * exercice, un repos, l'exercice suivant… Chaque étape dit où l'on en est
 * (« Circuit · Tour 2/3 ») et combien de temps elle doit durer.
 *
 * Un repos sépare aussi deux exercices de séries classiques : enchaîner sans
 * souffler d'un mouvement au suivant n'est pas ce qu'on prescrit.
 */
import type { Measure } from '../library/types';
import { message } from '../i18n/messages';
import type { BlockRole, Session, SessionBlock, SessionItem, Tempo } from '../types';

export interface TimelineStep {
    readonly kind: 'exercise' | 'rest';
    readonly block: string;
    readonly role: BlockRole;
    /** L'exercice (absent pour un repos). */
    readonly exercise?: string;
    readonly label: string;
    /** Ce qu'on compte : répétitions, secondes ou mètres ; un repos se compte en secondes. */
    readonly measure: Measure;
    readonly value: number;
    readonly perSide?: boolean;
    readonly tempo?: Tempo;
    readonly loadKg?: number;
    readonly note?: string;
    /** « Échauffement », « Circuit · Tour 2/3 », « Séries · Série 1/4 ». */
    readonly context: string;
    /** Le temps prévu pour l'étape, en secondes. */
    readonly seconds: number;
    /** Pour un AMRAP : le temps total du bloc, à afficher au départ. */
    readonly timeCap?: number;
}

const workOf = (item: SessionItem): number => item.setSeconds;

function exerciseStep(item: SessionItem, block: SessionBlock, context: string, value = item.target.value, seconds = workOf(item)): TimelineStep {
    return {
        kind: 'exercise',
        block: block.id,
        role: block.role,
        exercise: item.exercise,
        label: item.name,
        measure: item.target.measure,
        value,
        ...(item.target.perSide ? { perSide: true } : {}),
        ...(item.tempo ? { tempo: item.tempo } : {}),
        ...(item.load ? { loadKg: item.load.kg } : {}),
        ...(item.note ? { note: item.note } : {}),
        context,
        seconds,
    };
}

function restStep(block: SessionBlock, seconds: number, context: string, locale: string): TimelineStep {
    return { kind: 'rest', block: block.id, role: block.role, label: message('timeline-rest', {}, locale), measure: 'time', value: seconds, context, seconds };
}

function blockSteps(block: SessionBlock, locale: string): TimelineStep[] {
    const steps: TimelineStep[] = [];
    const rounds = Math.max(1, block.rounds);
    const roundContext = (round: number): string => (rounds > 1 ? `${block.title} · ${message('timeline-round', { n: round, total: rounds }, locale)}` : block.title);

    if (block.format === 'straight' || block.format === 'ladder') {
        block.items.forEach((item, index) => {
            const values = item.perSet?.length ? item.perSet : Array.from({ length: item.sets }, () => item.target.value);

            values.forEach((value, set) => {
                const context = values.length > 1 ? `${block.title} · ${message('timeline-set', { n: set + 1, total: values.length }, locale)}` : block.title;
                const perUnit = item.target.value > 0 ? workOf(item) / item.target.value : 0;

                steps.push(exerciseStep(item, block, context, value, Math.round(item.perSet ? perUnit * value : workOf(item))));

                const lastSet = set === values.length - 1;
                const nextIsLower = !lastSet && values[set + 1]! < value;

                if (!lastSet && item.restSeconds > 0) {
                    steps.push(restStep(block, nextIsLower ? item.restSeconds * 3 : item.restSeconds, context, locale));
                }
            });

            const next = block.items[index + 1];

            if (next && item.restSeconds > 0) {
                steps.push(restStep(block, item.restSeconds, block.title, locale));
            }
        });

        return steps;
    }

    if (block.format === 'tabata' || block.format === 'intervals') {
        for (let round = 1; round <= rounds; round++) {
            block.items.forEach((item, index) => {
                steps.push(exerciseStep(item, block, roundContext(round), block.workSeconds ?? item.target.value, block.workSeconds ?? item.target.value));

                const last = round === rounds && index === block.items.length - 1;

                if (!last && (block.restSeconds ?? 0) > 0) steps.push(restStep(block, block.restSeconds!, roundContext(round), locale));
            });

            if (round < rounds && block.restBetweenRounds > 0) steps.push(restStep(block, block.restBetweenRounds, roundContext(round), locale));
        }

        return steps;
    }

    if (block.format === 'emom') {
        for (let round = 1; round <= rounds; round++) {
            for (const item of block.items) {
                const work = Math.min(55, workOf(item));

                steps.push(exerciseStep(item, block, roundContext(round), item.target.value, work));
                steps.push(restStep(block, 60 - work, roundContext(round), locale));
            }
        }

        return steps;
    }

    for (let round = 1; round <= rounds; round++) {
        block.items.forEach((item, index) => {
            const step = exerciseStep(item, block, roundContext(round));

            steps.push(block.format === 'amrap' && round === 1 && index === 0 && block.durationSeconds ? { ...step, timeCap: block.durationSeconds } : step);

            const restBetweenItems = block.restBetweenItems ?? 0;

            if (index < block.items.length - 1 && restBetweenItems > 0) steps.push(restStep(block, restBetweenItems, roundContext(round), locale));
        });

        if (round < rounds && block.restBetweenRounds > 0) steps.push(restStep(block, block.restBetweenRounds, roundContext(round), locale));
    }

    return steps;
}

/** Toutes les étapes de la séance, dans l'ordre. */
export function toTimeline(session: Session, locale = 'fr'): TimelineStep[] {
    return session.blocks.flatMap((block) => blockSteps(block, locale));
}
