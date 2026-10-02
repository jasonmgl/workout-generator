/**
 * La commande « JSON en entrée, JSON en sortie », pour un serveur qui ne
 * parle pas TypeScript (Laravel, par exemple) :
 *
 *     echo '{"command":"session","input":{"date":"2026-10-02"}}' | node bin/workout-generator.mjs
 *
 * Les commandes : `session` (la séance du jour), `week` (le plan de la
 * semaine), `readiness` (la forme du jour), `body` (l'état des muscles),
 * `alternatives` et `replace` (remplacer un exercice), `exercise` et
 * `search` (la bibliothèque), `text`, `timeline` et `tree` (les sorties d'une
 * séance). Une erreur sort en JSON aussi, avec un code de retour 1.
 */
import { assessReadiness } from './readiness/assess';
import { bodyState } from './history/fatigue';
import { defaultLibrary } from './library/index';
import type { ExerciseQuery } from './library/library';
import { sessionToText } from './output/text';
import { toTimeline } from './output/timeline';
import { toTree } from './output/tree';
import { generateSession } from './session/generate';
import { alternativesFor, replaceExercise } from './session/swap';
import type { GenerateInput, Session } from './types';
import { planWeek, type WeekInput } from './week/plan';

export interface CliRequest {
    readonly command: string;
    readonly input?: unknown;
    readonly locale?: string;
}

const need = (condition: unknown, text: string): void => {
    if (!condition) {
        throw new Error(text);
    }
};

/** Exécuter une commande ; la même fonction sert aux tests et à la ligne de commande. */
export function run(request: CliRequest): unknown {
    const input = (request.input ?? {}) as Record<string, unknown>;
    const library = defaultLibrary();
    const locale = request.locale ?? 'fr';

    switch (request.command) {
        case 'session':
            need(typeof input.date === 'string', 'La séance demande une date (« date »).');

            return generateSession(input as unknown as GenerateInput);
        case 'week':
            need(typeof input.start === 'string', 'Le plan demande un premier jour (« start »).');

            return planWeek(input as unknown as WeekInput);
        case 'readiness':
            need(typeof input.date === 'string', 'La forme du jour demande une date (« date »).');

            return assessReadiness(input as never);
        case 'body': {
            const generate = input as unknown as GenerateInput;

            need(typeof generate.date === 'string', 'L’état des muscles demande une date (« date »).');

            return bodyState(generate.history ?? [], generate.date, library, generate.readiness ?? {});
        }
        case 'alternatives':
        case 'replace': {
            const { session, generate, block, index, exercise, limit } = input as {
                session: Session;
                generate: GenerateInput;
                block: string;
                index: number;
                exercise?: string;
                limit?: number;
            };

            need(session && generate && typeof block === 'string' && typeof index === 'number', 'Il faut « session », « generate », « block » et « index ».');

            if (request.command === 'alternatives') {
                return alternativesFor(session, generate, block, index, limit ?? 5);
            }

            need(typeof exercise === 'string', 'Il faut l’exercice qui remplace (« exercise »).');

            return replaceExercise(session, generate, block, index, exercise!);
        }
        case 'exercise': {
            const id = String(input.id ?? '');
            const found = library.find(id) ?? library.findByName(id, locale);

            need(found, `Exercice inconnu : « ${id} »`);

            return library.exercise(found!.id, locale);
        }
        case 'search': {
            const found = typeof input.text === 'string' ? library.search(input.text, locale) : library.filter(input as ExerciseQuery);

            return found.map((definition) => ({ ...definition, name: library.name(definition.id, locale) }));
        }
        case 'library':
            return library.ids().map((id) => library.exercise(id, locale));
        case 'text':
            return sessionToText(input as unknown as Session, locale);
        case 'timeline':
            return toTimeline(input as unknown as Session, locale);
        case 'tree':
            return toTree(input as unknown as Session);
        default:
            throw new Error(`Commande inconnue : « ${request.command} »`);
    }
}

/** Lire tout ce qui arrive sur l'entrée standard. */
async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
}

export async function main(): Promise<number> {
    try {
        const raw = await readStdin();
        const request = JSON.parse(raw) as CliRequest;

        process.stdout.write(`${JSON.stringify({ ok: true, result: run(request) })}\n`);

        return 0;
    } catch (error) {
        process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);

        return 1;
    }
}
