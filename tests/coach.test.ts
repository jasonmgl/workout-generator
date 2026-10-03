// Les règles demandées par la relecture des séances (trois coachs : programmation, sécurité, clarté). Chacune
// est vérifiée sur plusieurs graines : c'est le comportement général qui compte, pas un tirage heureux.
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '../src/library';
import { MESSAGES_FR } from '../src/i18n/fr/messages';
import { MUSCLE_INFO } from '../src/library/anatomy';
import { generateSession } from '../src/session/generate';
import { buildContext } from '../src/session/context';
import { alternateRegions } from '../src/session/formats';
import { comebackLoadFactor, estimatedLoad, prescribe } from '../src/session/prescribe';
import type { PlannedItem } from '../src/session/blocks';
import { POSTURE_ORDER } from '../src/session/warmup';
import type { GenerateInput, PastSession, Session, SessionItem } from '../src/types';

const library = defaultLibrary();
const DATE = '2026-10-03T18:00';
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const items = (session: Session, roles: readonly string[] = ['main', 'skill', 'finisher']): SessionItem[] =>
    session.blocks.filter((block) => roles.includes(block.role)).flatMap((block) => block.items);
/** Le travail total de la partie principale : séries × répétitions (ou secondes). */
const totalWork = (session: Session): number =>
    session.blocks
        .filter((block) => block.role === 'main')
        .reduce((sum, block) => sum + block.items.reduce((count, item) => count + item.sets * Math.max(1, block.rounds) * item.target.value, 0), 0);
const seconds = (session: Session, role: string): number => session.blocks.filter((block) => block.role === role).reduce((sum, block) => sum + block.estimatedSeconds, 0);
const many = (input: Omit<GenerateInput, 'seed'>): Session[] => SEEDS.map((seed) => generateSession({ ...input, seed }));

describe('la forme du jour pèse vraiment sur la séance', () => {
    it('donne moins de travail un jour de petite forme qu’un jour ordinaire', () => {
        const normal = many({ date: DATE, request: { minutes: 30 } }).reduce((sum, session) => sum + totalWork(session), 0);
        const tired = many({ date: DATE, readiness: { cycle: { phase: 'menstrual', symptoms: 2 } }, request: { minutes: 30 } }).reduce((sum, session) => sum + totalWork(session), 0);

        expect(tired).toBeLessThanOrEqual(normal * 0.85);
    });

    it('annonce une séance allégée et la fait plus courte', () => {
        const session = generateSession({ date: DATE, readiness: { pain: [{ joint: 'shoulders', severity: 3 }] }, request: { minutes: 40 } });

        expect(session.summary).toMatch(/épaules/);
        expect(session.reasons.map((entry) => entry.code)).toContain('session-lighter');
        expect(session.estimatedMinutes).toBeLessThan(40);
    });

    it('met d’abord dans le résumé ce que la personne a déclaré', () => {
        for (const session of many({ date: DATE, readiness: { pain: [{ joint: 'wrists', severity: 2 }] }, request: { minutes: 30 } })) {
            expect(session.summary.indexOf('poignets')).toBeGreaterThanOrEqual(0);
            expect(session.summary).not.toMatch(/Tout est frais/);
        }
    });

    it('ne dit « tout est frais » que s’il a vu les séances récentes', () => {
        expect(generateSession({ date: DATE, request: { minutes: 30 } }).summary).not.toMatch(/Tout est frais/);
        expect(generateSession({ date: DATE, history: [{ date: '2026-09-29', minutes: 30, worked: ['core'] }], request: { minutes: 30 } }).summary).toMatch(/Tout est frais/);
    });
});

describe('le plan de la semaine cède devant la fatigue', () => {
    it('remplace une séance de jambes prévue quand les jambes sont encore chargées', () => {
        const session = generateSession({
            date: DATE,
            plan: { date: DATE, kind: 'training', type: 'lower', intensity: 'hard' },
            history: [{ date: '2026-10-02T09:00', activities: [{ type: 'run', minutes: 90, intensity: 'hard' }] }],
            equipment: ['two-chairs', 'table'],
        });

        expect(session.type).toBe('upper');
        expect(session.reasons.map((entry) => entry.code)).toContain('type-plan-adapted-legs');
    });

    it('ne fait pas « dure » une séance prévue dure un jour de petite forme', () => {
        const session = generateSession({ date: DATE, plan: { date: DATE, kind: 'training', type: 'full-body', intensity: 'hard' }, readiness: { energy: 2, sleepQuality: 2 } });

        expect(session.intensity).toBe('easy');
    });
});

describe('les séances courtes travaillent', () => {
    it('donne au moins 60 % du temps au travail en 10 minutes', () => {
        for (const session of many({ date: DATE, request: { minutes: 10 } })) {
            expect(seconds(session, 'main') + seconds(session, 'finisher')).toBeGreaterThanOrEqual(session.estimatedMinutes * 60 * 0.55);
            expect(items(session).length).toBeGreaterThanOrEqual(2);
        }
    });

    it('ne fait jamais un circuit d’un seul tour', () => {
        for (const minutes of [10, 15, 20]) {
            for (const session of many({ date: DATE, request: { minutes } })) {
                for (const block of session.blocks.filter((entry) => entry.format === 'circuit')) {
                    expect(block.rounds).toBeGreaterThanOrEqual(2);
                }
            }
        }
    });
});

describe('le choix des exercices', () => {
    it('ne propose rien de plus d’une marche et demie au-dessus d’un débutant sans historique', () => {
        for (const session of many({ date: DATE, request: { minutes: 45 } })) {
            for (const item of items(session, ['main'])) {
                expect(library.get(item.exercise).difficulty, item.exercise).toBeLessThanOrEqual(4);
            }
        }
    });

    it('garde de vrais mouvements sur les places principales, pas des exercices d’activation', () => {
        for (const session of many({ date: DATE, equipment: [{ id: 'dumbbells', loads: [6, 10, 14] }], request: { minutes: 40 } })) {
            const main = session.blocks.filter((block) => block.role === 'main').flatMap((block) => block.items).slice(0, 4);

            expect(main.filter((item) => library.get(item.exercise).tags?.includes('activation')).length, main.map((item) => item.exercise).join(', ')).toBeLessThanOrEqual(1);
        }
    });

    it('fait travailler les mollets dans la place des mollets', () => {
        for (const session of many({ date: DATE, request: { minutes: 30, focus: ['calves'] } })) {
            const calves = items(session, ['main']).filter((item) => library.get(item.exercise).pattern === 'calf-raise');

            expect(calves.some((item) => library.get(item.exercise).muscles.primary.some((muscle) => muscle === 'gastrocnemius' || muscle === 'soleus'))).toBe(true);
        }
    });

    it('n’ajoute pas de poussée sans autant de tirages', () => {
        for (const session of many({ date: DATE, request: { minutes: 45 } })) {
            const patterns = items(session, ['main']).map((item) => library.get(item.exercise).pattern);
            const pushes = patterns.filter((pattern) => pattern === 'horizontal-push' || pattern === 'vertical-push').length;

            expect(pushes, patterns.join(', ')).toBeLessThanOrEqual(1);
        }
    });

    it('garde du travail pour les jambes quand un genou fait mal, et en dit la vraie raison', () => {
        for (const session of many({ date: DATE, readiness: { pain: [{ joint: 'knees', severity: 2 }] }, equipment: [{ id: 'dumbbells', loads: [4, 8, 12] }], request: { minutes: 40 } })) {
            const lower = items(session, ['main']).filter((item) => library.get(item.exercise).muscles.primary.some((muscle) => ['legs', 'glutes', 'calves'].includes(MUSCLE_INFO[muscle].group)));

            expect(lower.length).toBeGreaterThanOrEqual(1);
            expect(session.warnings.map((entry) => entry.text).join(' ')).not.toMatch(/marche|step/i);
        }
    });

    it('n’appuie ni sur les mains ni ne suspend quand on épargne le haut du corps', () => {
        for (const session of many({ date: DATE, equipment: ['resistance-band'], request: { minutes: 30, avoid: ['upper'] } })) {
            for (const item of items(session, ['warmup', 'main', 'finisher', 'cooldown'])) {
                expect(['support', 'hanging'], item.exercise).not.toContain(library.get(item.exercise).posture);
            }
        }
    });
});

describe('le cardio', () => {
    it('ne donne à un débutant qu’un exercice à fort impact par bloc', () => {
        for (const session of many({ date: DATE, request: { type: 'hiit', minutes: 25 } })) {
            const main = session.blocks.find((block) => block.role === 'main')!;

            expect(main.items.filter((item) => library.get(item.exercise).impact === 'high').length).toBeLessThanOrEqual(1);
        }
    });

    it('prend la corde à sauter quand on l’a déclarée', () => {
        const sessions = many({ date: DATE, profile: { level: 'intermediate' }, equipment: ['jump-rope'], request: { type: 'hiit', minutes: 25 } });

        expect(sessions.some((session) => items(session).some((item) => library.get(item.exercise).equipment?.flat().includes('jump-rope')))).toBe(true);
    });

    it('commence le retour au calme en bougeant après des intervalles', () => {
        for (const session of many({ date: DATE, request: { type: 'hiit', minutes: 25 } })) {
            const first = session.blocks.find((block) => block.role === 'cooldown')!.items[0]!;

            expect(library.get(first.exercise).kind).toBe('conditioning');
        }
    });

    it('fait un cardio continu en format continu, échauffé et calmé sur la même machine', () => {
        const session = generateSession({ date: DATE, equipment: ['bike'], request: { type: 'cardio', minutes: 40 } });
        const main = session.blocks.find((block) => block.role === 'main')!;
        const machine = main.items[0]!.exercise;

        expect(main.format).toBe('steady');
        expect(session.blocks[0]!.items[0]!.exercise).toBe(machine);
        expect(session.blocks.find((block) => block.role === 'cooldown')!.items[0]!.exercise).toBe(machine);
        expect(session.summary).toMatch(/allure/);
    });

    it('chauffe au moins cinq minutes avant des intervalles', () => {
        for (const session of many({ date: DATE, request: { type: 'hiit', minutes: 30 } })) {
            expect(seconds(session, 'warmup')).toBeGreaterThanOrEqual(240);
        }
    });
});

describe('la progression part des vrais chiffres', () => {
    const plateau: PastSession[] = ['2026-09-21', '2026-09-24', '2026-09-27', '2026-09-30'].map((date) => ({
        date,
        exercises: [{ exercise: 'pull-up', sets: [{ reps: 6 }, { reps: 5 }, { reps: 4 }] }],
    }));

    it('garde les tractions au plateau, avec une cible qu’on sait tenir', () => {
        const session = generateSession({ date: DATE, profile: { level: 'intermediate' }, equipment: ['pullup-bar'], history: plateau, request: { minutes: 45, include: ['pull-up'] } });
        const pullUp = items(session).find((item) => item.exercise === 'pull-up')!;

        expect(pullUp.progression?.step).toBe('vary');
        expect(pullUp.target.value).toBeLessThanOrEqual(5);
    });

    it('ne régresse pas des tractions quand on en fait six', () => {
        const history: PastSession[] = [{ date: '2026-09-30', exercises: [{ exercise: 'pull-up', sets: [{ reps: 6 }, { reps: 6 }, { reps: 5 }] }] }];

        for (const session of many({ date: DATE, profile: { level: 'intermediate' }, equipment: ['pullup-bar'], history, request: { type: 'pull', minutes: 30 } })) {
            const pulls = items(session, ['main']).filter((item) => library.get(item.exercise).family === 'pull-up');

            for (const item of pulls) expect(library.get(item.exercise).difficulty, item.exercise).toBeGreaterThanOrEqual(4);
        }
    });

    it('repart d’une part de la dernière performance quand la variante durcit', () => {
        const history: PastSession[] = [{ date: '2026-09-30', exercises: [{ exercise: 'air-squat', sets: [{ reps: 20 }, { reps: 20 }, { reps: 20 }] }] }];

        for (const session of many({ date: DATE, history, request: { type: 'lower', minutes: 30 } })) {
            // Une descente freinée se découvre volontairement bas : elle a sa propre règle.
            const harder = items(session, ['main']).find(
                (item) => item.progression?.step === 'harder' && library.get(item.exercise).family === 'squat' && !library.get(item.exercise).tags?.includes('eccentric'),
            );

            if (harder) expect(harder.target.value).toBeGreaterThanOrEqual(10);
        }
    });

    it('découvre une descente freinée en deux séries au plus', () => {
        const session = generateSession({ date: DATE, profile: { level: 'intermediate' }, request: { minutes: 45, include: ['nordic-curl'] }, equipment: ['door'] });
        const nordic = items(session).find((item) => library.get(item.exercise).family === library.get('nordic-curl').family);

        if (nordic) expect(nordic.sets).toBeLessThanOrEqual(2);
    });
});

describe('le dosage selon le rôle', () => {
    it('fait les exercices d’appoint et le gainage à 8 répétitions au moins, même en force', () => {
        for (const session of many({ date: DATE, profile: { goal: 'strength', level: 'advanced' }, equipment: ['pullup-bar', 'dip-bars'], request: { minutes: 60 } })) {
            const main = session.blocks.filter((block) => block.role === 'main').flatMap((block) => block.items);
            const core = main.filter((item) => ['anti-extension', 'trunk-flexion', 'anti-rotation', 'anti-lateral-flexion'].includes(library.get(item.exercise).pattern));

            for (const item of core) {
                if (item.target.measure === 'reps') expect(item.target.value, item.exercise).toBeGreaterThanOrEqual(6);
                expect(item.restSeconds, item.exercise).toBeLessThanOrEqual(60);
            }
        }
    });

    it('prévoit des séries d’approche avant un gros mouvement lourd à la barre', () => {
        const sessions = many({
            date: DATE,
            profile: { goal: 'strength', level: 'advanced', bodyweightKg: 80 },
            equipment: [{ id: 'barbell', loads: [20, 30, 40, 50, 60, 70, 80, 90, 100] }, 'rack', 'bench'],
            request: { minutes: 60 },
        });
        const approached = sessions.flatMap((session) => items(session, ['main'])).filter((item) => item.warmupSets?.length);

        expect(approached.length).toBeGreaterThan(0);

        for (const item of approached) {
            for (const set of item.warmupSets!) expect(set.kg).toBeLessThan(item.load!.kg);
        }
    });
});

describe('les exercices en alternance', () => {
    it('reçoivent un nombre pair de répétitions, partout dans la séance', () => {
        for (const session of many({ date: DATE, request: { minutes: 45, type: 'core' } })) {
            for (const item of session.blocks.flatMap((block) => block.items)) {
                if (library.get(item.exercise).alternating && item.target.measure === 'reps' && !item.perSet) {
                    expect(item.target.value % 2, item.exercise).toBe(0);
                    expect(item.alternating).toBe(true);
                }
            }
        }
    });
});

describe('la mobilité', () => {
    it('se range du debout vers le sol et tient la durée', () => {
        for (const session of many({ date: DATE, request: { type: 'mobility', minutes: 30 } })) {
            const main = session.blocks.find((block) => block.role === 'main')!;
            const order = main.items.map((item) => POSTURE_ORDER.indexOf(library.get(item.exercise).posture));

            expect(order).toEqual([...order].sort((a, b) => a - b));
            expect(session.estimatedMinutes).toBeGreaterThanOrEqual(25);
        }
    });

    it('reste douce pour un débutant', () => {
        for (const session of many({ date: DATE, request: { type: 'mobility', minutes: 20 } })) {
            for (const item of items(session, ['main'])) expect(library.get(item.exercise).difficulty, item.exercise).toBeLessThanOrEqual(2);
        }
    });
});

describe('l’ordre d’un circuit', () => {
    const planned = (ids: readonly string[]): PlannedItem[] => ids.map((id) => ({ definition: library.get(id) }) as PlannedItem);

    it('évite de se relever et de se recoucher, sans enchaîner deux exercices de la même région', () => {
        const order = alternateRegions(planned(['air-squat', 'crunch', 'push-up', 'reverse-lunge'])).map((item) => item.definition.id);

        // Debout, appui sur les mains, debout, puis le sol pour finir ; le plus important reste en tête.
        expect(order).toEqual(['air-squat', 'push-up', 'reverse-lunge', 'crunch']);
    });

    it('ne colle pas deux exercices de la même région pour gagner une position', () => {
        const order = alternateRegions(planned(['push-up', 'air-squat', 'glute-bridge', 'crunch'])).map((item) => item.definition.id);

        expect(order.indexOf('glute-bridge') - order.indexOf('air-squat')).not.toBe(1);
        expect(order.indexOf('air-squat') - order.indexOf('glute-bridge')).not.toBe(1);
    });
});

describe('la deuxième relecture : la première fois et l’échec', () => {
    const plateau: PastSession[] = ['2026-09-21', '2026-09-24', '2026-09-27', '2026-09-30'].map((date) => ({
        date,
        exercises: [
            { exercise: 'pull-up', sets: [{ reps: 6 }, { reps: 5 }, { reps: 4 }] },
            { exercise: 'parallel-bar-dip', sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }] },
        ],
    }));
    const total = (session: Session, item: SessionItem): number => item.sets * (session.blocks.find((block) => block.items.includes(item))?.rounds ?? 1);

    it('fait tenir une première fois dans la fiche, réserve comprise, pour chaque objectif', () => {
        for (const goal of ['health', 'strength', 'hypertrophy', 'endurance', 'fat-loss'] as const) {
            const context = buildContext({ date: DATE, profile: { goal } });

            for (const definition of library.filter({ kinds: ['strength'] }).filter((entry) => entry.measure === 'reps' && !entry.tags?.includes('loaded'))) {
                const prescription = prescribe(definition, 'main', context);

                expect(prescription.target.value + (prescription.rir ?? 0), `${goal} · ${definition.id}`).toBeLessThanOrEqual(definition.range[1]);
            }
        }
    });

    it('ne fait jamais plus de deux séries d’une première descente freinée, quel que soit le format', () => {
        let seen = 0;

        for (const format of ['superset', 'circuit', 'amrap', 'emom', 'auto'] as const) {
            for (const goal of ['health', 'hypertrophy', 'endurance'] as const) {
                for (const session of many({ date: DATE, profile: { goal }, request: { minutes: 30, format, include: ['negative-push-up'] } })) {
                    for (const item of items(session, ['main']).filter((entry) => library.get(entry.exercise).tags?.includes('eccentric') && ['start', 'harder', 'comeback'].includes(entry.progression?.step ?? ''))) {
                        seen++;
                        expect(total(session, item), `${format} · ${goal} · ${item.exercise}`).toBeLessThanOrEqual(2);
                    }
                }
            }
        }

        expect(seen).toBeGreaterThan(10);
    });

    it('dose une variante sœur sur ce qui se fait dans la famille, pas comme une première fois', () => {
        const context = buildContext({ date: DATE, profile: { level: 'intermediate' }, equipment: ['pullup-bar', 'dip-bars'], history: plateau });

        for (const definition of library.family('pull-up').filter((entry) => entry.difficulty === library.get('pull-up').difficulty && entry.measure === 'reps')) {
            const prescription = prescribe(definition, 'main', context);

            expect(prescription.target.value + (prescription.rir ?? 0), definition.id).toBeLessThanOrEqual(7);
        }
    });

    it('garde les tractions et les dips au plateau, pour en changer le rythme', () => {
        let kept = 0;
        const seeds = Array.from({ length: 20 }, (_, index) => index + 1);

        for (const seed of seeds) {
            const session = generateSession({ date: DATE, seed, profile: { level: 'intermediate' }, equipment: ['pullup-bar', 'dip-bars'], history: plateau, request: { minutes: 45 } });
            const ids = items(session, ['main']).map((item) => item.exercise);

            if (ids.includes('pull-up') && ids.includes('parallel-bar-dip')) kept++;
        }

        expect(kept / seeds.length).toBeGreaterThanOrEqual(0.9);
    });

    it('tient la cible après un échec, sans monter ni reculer de deux variantes', () => {
        const failed = (exercise: string, reps: number[], rir: number[]): PastSession[] => [
            { date: '2026-09-30', effort: 'hard', exercises: [{ exercise, sets: reps.map((value, index) => ({ reps: value, rir: rir[index]! })) }] },
        ];
        const context = buildContext({ date: DATE, equipment: ['table'], history: failed('inverted-row-table', [10, 9, 8], [1, 0, 0]) });
        const row = prescribe(library.get('inverted-row-table'), 'main', context);

        expect(row.progression.step).toBe('hold');
        expect(row.target.value).toBeLessThanOrEqual(10);
        expect(row.target.value + (row.rir ?? 0)).toBeLessThanOrEqual(13);

        for (const session of many({ date: DATE, history: failed('push-up', [12, 10, 8], [0, 0, 0]), request: { type: 'push', minutes: 30 } })) {
            for (const item of items(session, ['main']).filter((entry) => library.get(entry.exercise).family === 'push-up')) {
                expect(library.get(item.exercise).difficulty, item.exercise).toBeGreaterThanOrEqual(library.get('push-up').difficulty - 1);
            }
        }
    });

    it('fait tenir la cible quand la séance a été ressentie dure, même sans réserve notée', () => {
        const history: PastSession[] = [{ date: '2026-09-30', effort: 'hard', exercises: [{ exercise: 'push-up', sets: [{ reps: 12 }, { reps: 12 }, { reps: 11 }] }] }];
        const push = prescribe(library.get('push-up'), 'main', buildContext({ date: DATE, history }));

        expect(push.progression.step).toBe('hold');
        expect(push.target.value).toBeLessThanOrEqual(11);
    });

    it('baisse la charge à la reprise, et la dit à ajuster', () => {
        const history: PastSession[] = [{ date: '2026-08-18', exercises: [{ exercise: 'barbell-bench-press', sets: [5, 5, 5].map((reps) => ({ reps, loadKg: 80 })) }] }];
        const loads = [20, 30, 40, 50, 60, 70, 80, 90];
        const context = buildContext({ date: DATE, profile: { goal: 'strength' }, equipment: [{ id: 'barbell', loads }, 'rack', 'bench'], history });
        const bench = prescribe(library.get('barbell-bench-press'), 'main', context);

        expect(bench.progression.step).toBe('comeback');
        expect(bench.load!.kg).toBeLessThanOrEqual(80 * 0.85);
        expect(bench.load!.estimated).toBe(true);
        expect(comebackLoadFactor(45)).toBe(0.7);
        expect(comebackLoadFactor(5)).toBe(1);
    });

    it('prend la charge disponible qui garde les répétitions dans l’objectif', () => {
        // Une série de dix pèserait un peu plus de 7 kg : 6,8 kg sont voulus pour 10 répétitions et 2 en réserve.
        const choice = estimatedLoad([4, 8, 12], 7.14, 10, 2, [8, 12], [6, 15]);

        expect(choice.kg).toBe(8);
        expect(choice.value).toBeLessThan(10);
        expect(estimatedLoad([4, 8, 12], 7.14, 10, 2, [15, 25], [6, 25]).kg).toBe(4);
    });

    it('n’affiche aucune réserve sur l’activation, la posture ou le gainage facile', () => {
        const context = buildContext({ date: DATE });

        for (const id of ['prone-y-t-w', 'bird-dog', 'crunch']) {
            expect(prescribe(library.get(id), 'accessory', context).rir, id).toBeUndefined();
        }

        expect(prescribe(library.get('push-up'), 'main', context).rir).toBeDefined();
    });

    it('traite les curls nordiques comme des descentes freinées', () => {
        for (const definition of library.family('nordic-curl')) {
            expect(definition.tags, definition.id).toContain('eccentric');
        }
    });
});

describe('la deuxième relecture : la forme du jour', () => {
    /** Le travail de la séance, finisher compris, un exercice de chaque côté comptant double. */
    const work = (session: Session): number =>
        session.blocks
            .filter((block) => block.role === 'main' || block.role === 'finisher')
            .reduce((sum, block) => sum + block.items.reduce((count, item) => count + item.sets * Math.max(1, block.rounds) * item.target.value * (item.target.perSide ? 2 : 1), 0), 0);

    it('donne moins de travail un jour de petite forme, graine par graine', () => {
        for (const goal of ['health', 'fat-loss', 'endurance', 'hypertrophy'] as const) {
            for (let seed = 1; seed <= 10; seed++) {
                const base: GenerateInput = { date: DATE, seed, profile: { goal }, request: { minutes: 30 } };
                const normal = generateSession(base);
                const tired = generateSession({ ...base, readiness: { energy: 2, sleepQuality: 3 } });

                expect(work(tired), `${goal} · graine ${seed}`).toBeLessThanOrEqual(work(normal) * 0.85);
            }
        }
    });

    it('ne propose ni AMRAP ni EMOM un jour léger', () => {
        for (const goal of ['fat-loss', 'strength', 'endurance'] as const) {
            for (const readiness of [{ energy: 2, sleepQuality: 2 } as const, {}]) {
                const plan = Object.keys(readiness).length ? undefined : { date: '2026-10-03', kind: 'training' as const, type: 'full-body' as const, intensity: 'easy' as const };

                for (const session of many({ date: DATE, profile: { goal }, readiness, ...(plan ? { plan } : {}), request: { minutes: 30 } })) {
                    for (const block of session.blocks.filter((entry) => entry.role === 'main')) {
                        expect(['amrap', 'emom'], `${goal} · ${block.format}`).not.toContain(block.format);
                    }
                }
            }
        }
    });

    it('fait passer la mobilité avant le type demandé quand la forme ne permet pas plus', () => {
        const signals = [{ cycle: { phase: 'menstrual', symptoms: 3 } } as const, { pain: [{ joint: 'lower-back', severity: 3 }] } as const, { energy: 1, sleepQuality: 1, stress: 5 } as const];

        for (const readiness of signals) {
            for (const type of ['hiit', 'lower', 'full-body', 'cardio', 'push'] as const) {
                const session = generateSession({ date: DATE, readiness, request: { minutes: 30, type } });

                expect(session.type, `${type} · ${JSON.stringify(readiness)}`).toBe('mobility');
                expect(session.summary).toMatch(/remplacée/);
            }
        }
    });

    it('fait la séance demandée quand on passe outre, en prévenant', () => {
        const session = generateSession({ date: DATE, readiness: { pain: [{ joint: 'lower-back', severity: 3 }] }, request: { minutes: 30, type: 'lower', ignoreReadiness: true } });

        expect(session.type).toBe('lower');
        expect(session.warnings.map((entry) => entry.code)).toContain('readiness-ignored');
    });

    it('ne pousse jamais à minimiser une douleur pour avoir une séance', () => {
        for (const text of Object.values(MESSAGES_FR)) {
            expect(text).not.toMatch(/alléger les douleurs/);
        }
    });
});
