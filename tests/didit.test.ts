// Le contrat avec DidIt. DidIt appelle la commande JSON depuis PHP
// (`app/Support/WorkoutGenerator.php`) : l'entrée est construite comme là-bas,
// et chaque champ que DidIt relit dans la réponse est vérifié ici. Un
// changement du moteur qui casserait l'écran de DidIt casse d'abord ce test.
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import { bodyState } from '../src/history/fatigue';
import { capacity, performancesOf } from '../src/history/progress';
import { resolveHistory } from '../src/history/resolve';
import { defaultLibrary } from '../src/library/index';
import type { GenerateInput, PastSession, Session } from '../src/types';

const library = defaultLibrary();
const TODAY = '2026-10-05';

/** Une séance de DidIt telle que `historyOf` l'envoie : le nom de l'exercice, autant de séries que notées, le meilleur nombre à chacune. */
const didItSession = (date: string, entries: Readonly<Record<string, [number, number]>>, effort?: 'easy' | 'right' | 'hard'): PastSession => ({
    date,
    minutes: 30,
    ...(effort ? { effort } : {}),
    exercises: Object.entries(entries).map(([exercise, [sets, reps]]) => ({ exercise, sets: Array.from({ length: sets }, () => ({ reps })) })),
});

/** L'entrée de `WorkoutGenerator::inputFor` : objectif, matériel, pouls, quatre semaines, jours de repos, demande. */
const didItInput = (overrides: Partial<GenerateInput> = {}): GenerateInput => ({
    date: TODAY,
    profile: { goal: 'health' },
    equipment: ['two-chairs', 'pullup-bar'],
    readiness: { restingHeartRate: 54, heartRateHistory: ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((date) => ({ date, bpm: 53 })) },
    history: [
        didItSession('2026-09-29', { Pompes: [3, 12], Squats: [3, 20], 'Gainage planche': [3, 40] }, 'right'),
        didItSession('2026-10-01', { Tractions: [3, 5], 'Fentes alternées': [3, 16], 'Relevés de jambes': [3, 10] }, 'hard'),
    ],
    restDays: ['2026-10-04'],
    ...overrides,
});

const MEASURES = ['reps', 'time'];
const STEPS = ['start', 'hold', 'more', 'add-set', 'add-load', 'harder', 'easier', 'vary', 'comeback'];
const ROLES = ['warmup', 'skill', 'main', 'finisher', 'cooldown'];

/** Ce que `movementsOf`, `asDailyPlan` et `asGenerated` lisent, et ce qu'ils attendent. */
function expectReadableByDidIt(session: Session, label: string): void {
    expect(typeof session.title, label).toBe('string');
    expect(typeof session.summary, label).toBe('string');
    expect(Number.isFinite(session.estimatedMinutes), label).toBe(true);
    expect(typeof session.type, label).toBe('string');
    expect(session.blocks.some((block) => block.role === 'main'), `${label} : un bloc principal, pour le repos annoncé`).toBe(true);

    for (const block of session.blocks) {
        expect(typeof block.id, label).toBe('string');
        expect(typeof block.title, label).toBe('string');
        expect(ROLES, label).toContain(block.role);
        expect(Number.isInteger(block.rounds) && block.rounds >= 1, label).toBe(true);

        for (const item of block.items) {
            const where = `${label} · ${block.title} · ${item.name}`;

            // DidIt écarte sans rien dire un exercice qui n'est ni en répétitions ni en secondes.
            expect(MEASURES, where).toContain(item.target.measure);
            expect(typeof item.name, where).toBe('string');
            expect(typeof item.exercise, where).toBe('string');
            expect(Number.isInteger(item.target.value) && item.target.value >= 1, where).toBe(true);
            expect(Number.isInteger(item.sets) && item.sets >= 1, where).toBe(true);
            expect(Number.isInteger(item.restSeconds) && item.restSeconds >= 0, where).toBe(true);
            expect(typeof item.target.perSide, where).toBe('boolean');

            for (const value of item.perSet ?? []) {
                expect(Number.isInteger(value) && value >= 1, where).toBe(true);
            }

            if (item.reasons.length) {
                expect(typeof item.reasons[0]!.text, where).toBe('string');
            }

            if (item.progression) {
                expect(STEPS, where).toContain(item.progression.step);
                expect(typeof item.progression.text, where).toBe('string');
            }
        }
    }
}

describe('le contrat avec DidIt', () => {
    it('répond à la séance du jour comme DidIt la demande, par la commande JSON', () => {
        const session = run({ command: 'session', input: didItInput(), locale: 'fr' } as never) as Session;

        expectReadableByDidIt(session, 'séance du jour');
    });

    it('répond à la séance à la demande, zones et durée, quelle que soit la forme', () => {
        const zones = [['chest'], ['back', 'arms'], ['lower'], ['core', 'lower-back'], ['shoulders']] as const;

        for (const [index, focus] of zones.entries()) {
            for (const minutes of [10, 20, 30, 45, 60]) {
                // DidIt tire une graine de 1 à 2 147 483 647 à chaque demande.
                const input = didItInput({ seed: 2_147_483_647 - index * 7 - minutes, request: { minutes, ignoreReadiness: true, focus } });

                expectReadableByDidIt(run({ command: 'session', input }) as Session, `${focus.join('+')} ${minutes} min`);
            }
        }
    });

    it('reste lisible pour chaque objectif et chaque matériel de DidIt, cardio compris', () => {
        const goals = ['health', 'strength', 'hypertrophy', 'endurance', 'fat-loss'] as const;
        const kits = [[], ['two-chairs', 'table'], ['pullup-bar', 'dip-bars', 'resistance-band'], ['dumbbells', 'mat'], ['jump-rope', 'bike', 'outdoor']] as const;

        for (const [index, goal] of goals.entries()) {
            for (const [kit, equipment] of kits.entries()) {
                for (const request of [{}, { minutes: 30, ignoreReadiness: true, type: 'cardio' as const }]) {
                    const input = didItInput({ seed: 31 * index + kit, profile: { goal }, equipment, ...(Object.keys(request).length ? { request } : {}) });

                    expectReadableByDidIt(run({ command: 'session', input }) as Session, `${goal} · ${equipment.join(', ') || 'rien'} · ${request.type ?? 'du jour'}`);
                }
            }
        }
    });
});

describe('l’historique de DidIt, donné par les noms', () => {
    const history = didItInput().history!;

    it('retrouve chaque exercice par son nom, et ignore ce qu’il ne connaît pas', () => {
        const resolved = resolveHistory([...history, didItSession('2026-10-02', { 'Un exercice inventé': [2, 10] })], library);

        expect(resolved[0]!.exercises!.map((entry) => entry.exercise)).toEqual(['push-up', 'air-squat', 'plank']);
        expect(resolved[1]!.exercises!.map((entry) => entry.exercise)).toEqual(['pull-up', 'alternating-lunge', 'lying-leg-raise']);
        expect(resolved[2]!.exercises![0]!.exercise).toBe('Un exercice inventé');
    });

    it('lit les répétitions d’un exercice en durée comme des secondes', () => {
        const plank = performancesOf(resolveHistory(history, library), library.get('plank'), TODAY);

        expect(plank[0]?.best).toBe(40);
    });

    it('en tire la fatigue des muscles et le niveau', () => {
        const state = bodyState(history, '2026-10-02T08:00', library);

        expect(state.groups.back.recovery).toBeLessThan(1);
        expect(state.unknownExercises).toEqual([]);
        expect(capacity(history, TODAY, library).families['push-up']).toBeGreaterThan(0);
    });

    it('fait progresser à partir de ce que DidIt a noté', () => {
        const weeks = [0, 2, 4, 7, 9, 11].map((days) => didItSession(`2026-09-${String(30 - days).padStart(2, '0')}`, { Pompes: [3, 15], Squats: [3, 25] }, 'easy'));
        const session = generateFor(didItInput({ history: weeks, request: { type: 'full-body', minutes: 30 } }));
        const known = session.blocks.flatMap((block) => block.items).filter((item) => library.get(item.exercise).family === 'push-up' || library.get(item.exercise).family === 'squat');

        expect(known.length).toBeGreaterThan(0);
        expect(known.every((item) => item.progression?.step !== 'start')).toBe(true);
    });
});

function generateFor(input: GenerateInput): Session {
    return run({ command: 'session', input }) as Session;
}
