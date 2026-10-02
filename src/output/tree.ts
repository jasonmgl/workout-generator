/**
 * La séance en arbre de blocs : des boucles qui se répètent, des exercices,
 * des repos. C'est la forme des programmes qu'on enregistre et qu'on édite
 * (celle de DidIt : boucles avec un rôle échauffement ou retour au calme,
 * exercices en répétitions ou en temps, repos en secondes). Une application
 * n'a plus qu'à renommer les champs.
 *
 * Dans une boucle de séries, le repos suit chaque série, la dernière
 * comprise : c'est le temps de passer à l'exercice suivant.
 */
import type { Measure } from '../library/types';
import type { BlockRole, Session, SessionBlock, SessionItem, Tempo } from '../types';

export type TreeNode = TreeExercise | TreeRest | TreeLoop;

export interface TreeExercise {
    readonly type: 'exercise';
    readonly exercise: string;
    readonly label: string;
    readonly measure: Measure;
    readonly value: number;
    readonly perSide?: boolean;
    readonly tempo?: Tempo;
    readonly loadKg?: number;
    readonly note?: string;
}

export interface TreeRest {
    readonly type: 'rest';
    readonly seconds: number;
}

export interface TreeLoop {
    readonly type: 'loop';
    readonly repeat: number;
    readonly label?: string;
    readonly role?: BlockRole;
    readonly children: readonly TreeNode[];
}

function exercise(item: SessionItem, value = item.target.value, seconds?: number): TreeExercise {
    return {
        type: 'exercise',
        exercise: item.exercise,
        label: item.name,
        measure: seconds !== undefined ? 'time' : item.target.measure,
        value: seconds ?? value,
        ...(item.target.perSide ? { perSide: true } : {}),
        ...(item.tempo ? { tempo: item.tempo } : {}),
        ...(item.load ? { loadKg: item.load.kg } : {}),
        ...(item.note ? { note: item.note } : {}),
    };
}

const rest = (seconds: number): TreeRest[] => (seconds > 0 ? [{ type: 'rest', seconds: Math.round(seconds) }] : []);

function blockChildren(block: SessionBlock): TreeNode[] {
    if (block.format === 'straight' || block.format === 'ladder') {
        return block.items.map((item): TreeNode => {
            if (item.perSet?.length) {
                return { type: 'loop', repeat: 1, label: item.name, children: item.perSet.flatMap((value) => [exercise(item, value), ...rest(item.restSeconds)]) };
            }

            return { type: 'loop', repeat: item.sets, label: item.name, children: [exercise(item), ...rest(item.restSeconds)] };
        });
    }

    if (block.format === 'tabata' || block.format === 'intervals') {
        return block.items.flatMap((item) => [exercise(item, item.target.value, block.workSeconds ?? item.target.value), ...rest(block.restSeconds ?? 0)]);
    }

    if (block.format === 'emom') {
        return block.items.flatMap((item) => {
            const work = Math.min(55, item.setSeconds);

            return [exercise(item), ...rest(60 - work)];
        });
    }

    return block.items.flatMap((item, index) => [exercise(item), ...(index < block.items.length - 1 ? rest(block.restBetweenItems ?? 0) : [])]);
}

/** Une boucle par bloc, qui se répète autant de fois qu'il a de tours. */
export function toTree(session: Session): TreeLoop[] {
    return session.blocks.map((block) => {
        const children = blockChildren(block);
        const between = block.format === 'straight' || block.format === 'ladder' ? [] : rest(block.restBetweenRounds);

        return {
            type: 'loop',
            repeat: Math.max(1, block.rounds),
            label: block.title,
            role: block.role,
            children: [...children, ...between],
        };
    });
}
