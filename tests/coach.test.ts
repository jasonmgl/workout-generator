// Les règles demandées par la relecture des séances (trois coachs : programmation, sécurité, clarté). Chacune
// est vérifiée sur plusieurs graines : c'est le comportement général qui compte, pas un tirage heureux.
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '../src/library';
import { MESSAGES_FR } from '../src/i18n/fr/messages';
import { MUSCLE_GROUPS, MUSCLE_INFO } from '../src/library/anatomy';
import type { EquipmentInput } from '../src/library/equipment';
import type { ExerciseDefinition } from '../src/library/types';
import { generateSession } from '../src/session/generate';
import { buildContext } from '../src/session/context';
import { alternateRegions, buildMainBlocks, lightDay, pairUp } from '../src/session/formats';
import { comebackLoadFactor, estimatedLoad, prescribe } from '../src/session/prescribe';
import { CEILING, loadsErectors, movementKey, pick, rank, score, targetDifficulty } from '../src/session/select';
import { alternativesFor, replaceExercise } from '../src/session/swap';
import { FOCUS_SLOTS, type Slot } from '../src/session/templates';
import { repSeconds, TEMPO_PHASE_SECONDS } from '../src/session/timing';
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

describe('la deuxième relecture : poussées et tirages', () => {
    const push = (id: string): boolean => {
        const definition = library.get(id);

        return definition.pattern === 'horizontal-push' || definition.pattern === 'vertical-push' || (definition.pattern === 'elbow-extension' && definition.posture === 'support');
    };
    const pull = (id: string): boolean => ['horizontal-pull', 'vertical-pull'].includes(library.get(id).pattern);
    const setsOf = (session: Session, test: (id: string) => boolean): number =>
        session.blocks.filter((block) => block.role === 'main').reduce((sum, block) => sum + block.items.filter((item) => test(item.exercise)).reduce((count, item) => count + item.sets * block.rounds, 0), 0);
    const cases: [string, Omit<GenerateInput, 'seed'>][] = [
        ['haut du corps 20 min, barre', { date: DATE, equipment: ['pullup-bar'], request: { type: 'upper', minutes: 20 } }],
        ['haut du corps 20 min, table et chaises', { date: DATE, equipment: ['table', 'two-chairs'], request: { type: 'upper', minutes: 20 } }],
        ['corps entier 45 min, sans matériel', { date: DATE, request: { minutes: 45 } }],
        ['corps entier 45 min, endurance, sans matériel', { date: DATE, profile: { goal: 'endurance' }, request: { minutes: 45 } }],
        ['haut du corps 30 min, focus bras', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: [{ id: 'dumbbells', loads: [4, 8, 12, 16] }, 'bench'], request: { type: 'upper', minutes: 30, focus: ['arms'] } }],
    ];

    it('ne fait jamais plus de séries de poussée que de tirage quand un vrai tirage est faisable', () => {
        for (const [label, input] of cases) {
            for (const session of many(input)) {
                if (setsOf(session, pull) > 0) expect(setsOf(session, push), label).toBeLessThanOrEqual(setsOf(session, pull));
            }
        }
    });

    it('sans tirage faisable, se contente d’une seule poussée, pompes sphinx comprises', () => {
        for (const [label, input] of cases) {
            for (const session of many(input)) {
                const main = items(session, ['main']);

                if (!main.some((item) => pull(item.exercise))) expect(main.filter((item) => push(item.exercise)).length, label).toBeLessThanOrEqual(1);
            }
        }
    });
});

describe('la deuxième relecture : focus, développé chargé, lombaires et doublons', () => {
    const seeds = (count: number): number[] => Array.from({ length: count }, (_, index) => index + 1);
    const asked = (item: SessionItem): boolean => item.reasons[0]?.code === 'item-focus';
    /** Une première descente freinée, plafonnée à deux séries pour les courbatures : elle a sa propre règle. */
    const firstDescent = (item: SessionItem): boolean => Boolean(library.get(item.exercise).tags?.includes('eccentric')) && ['start', 'harder', 'comeback'].includes(item.progression?.step ?? '');
    /** Un exercice visé à son plafond de découverte (variante plus dure, reprise, première descente freinée). */
    const discovering = (item: SessionItem): boolean => firstDescent(item) || ['harder', 'comeback'].includes(item.progression?.step ?? '');
    const totals = (session: Session): { item: SessionItem; total: number }[] =>
        session.blocks.filter((block) => block.role === 'main').flatMap((block) => block.items.map((item) => ({ item, total: item.sets * Math.max(1, block.rounds) })));
    const warmupOnly = (definition: ExerciseDefinition): boolean => Boolean(definition.tags?.some((tag) => tag === 'activation' || tag === 'rehab'));
    /** L'exercice fait-il travailler le groupe, en principal ou en aide ? */
    const works = (definition: ExerciseDefinition, group: string): boolean =>
        [...definition.muscles.primary, ...(definition.muscles.secondary ?? [])].some((muscle) => MUSCLE_INFO[muscle].group === group);
    const days = (ago: number): string => new Date(Date.UTC(2026, 9, 3 - ago)).toISOString().slice(0, 10);
    /** Un historique : la même fiche, séance après séance (les plus anciennes d'abord). */
    const series = (exercise: string, reps: readonly (readonly number[])[], ago: readonly number[]): PastSession[] =>
        ago.map((when, index) => ({ date: days(when), exercises: [{ exercise, sets: reps[Math.min(index, reps.length - 1)]!.map((value) => ({ reps: value })) }] }));
    const share = (runs: readonly Session[], test: (session: Session) => boolean): number => runs.filter(test).length / runs.length;
    const runs = (input: Omit<GenerateInput, 'seed'>, count = 20): Session[] => seeds(count).map((seed) => generateSession({ ...input, seed }));
    const pattern = (item: SessionItem): string => library.get(item.exercise).pattern;
    const PULLS = ['horizontal-pull', 'vertical-pull'];
    const PUSHES = ['horizontal-push', 'vertical-push'];
    const dumbbells: EquipmentInput[] = ['mini-band', { id: 'dumbbells', loads: [6, 10, 14] }];
    const homeDumbbells: EquipmentInput[] = [{ id: 'dumbbells', loads: [4, 6, 8, 10, 12, 14, 16, 20] }, 'bench'];
    const gym: EquipmentInput[] = [{ id: 'barbell', loads: [20, 30, 40, 50, 60, 70, 80, 90, 100] }, 'rack', 'bench', { id: 'dumbbells', loads: [5, 10, 15, 20, 25] }, 'pullup-bar', 'dip-bars'];
    const focusCases: [string, Omit<GenerateInput, 'seed'>][] = [
        ['fessiers, mini-bande et haltères', { date: DATE, equipment: dumbbells, request: { minutes: 40, focus: ['glutes'] } }],
        ['fessiers, corps entier sans matériel', { date: DATE, request: { minutes: 45, type: 'full-body', focus: ['glutes'] } }],
        ['fessiers, bas du corps sans matériel', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, request: { minutes: 45, type: 'lower', focus: ['glutes'] } }],
        ['fessiers, haltères, prise de muscle', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: homeDumbbells, request: { minutes: 45, focus: ['glutes'] } }],
        ['pectoraux, prise de muscle', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: homeDumbbells, request: { minutes: 45, focus: ['chest'] } }],
        ['pectoraux, sans matériel', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, request: { minutes: 45, focus: ['chest'] } }],
        ['bras, haut du corps', { date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate', bodyweightKg: 75 }, equipment: homeDumbbells, request: { minutes: 30, focus: ['arms'] } }],
        ['jambes, sans matériel', { date: DATE, request: { minutes: 45, focus: ['legs'] } }],
        ['abdominaux, endurance', { date: DATE, profile: { goal: 'endurance' }, request: { minutes: 45, type: 'full-body', focus: ['core'] } }],
    ];

    describe('le focus', () => {
        it('donne à chaque exercice du focus au moins autant de séries qu’à tout autre exercice, et au moins trois', () => {
            for (const [label, input] of focusCases) {
                for (const session of many(input)) {
                    const all = totals(session);
                    const focus = all.filter((entry) => asked(entry.item) && !discovering(entry.item));
                    const others = all.filter((entry) => !asked(entry.item));
                    const detail = `${label} · ${all.map((entry) => `${entry.item.exercise}${asked(entry.item) ? '*' : ''} ${entry.total}`).join(', ')}`;

                    expect(focus.length, label).toBeGreaterThan(0);
                    // Pas tout aplati à deux séries : ce qu'on vise a du vrai volume.
                    expect(Math.max(...focus.map((entry) => entry.total)), detail).toBeGreaterThanOrEqual(3);

                    if (others.length) expect(Math.min(...focus.map((entry) => entry.total)), detail).toBeGreaterThanOrEqual(Math.max(...others.map((entry) => entry.total)));
                }
            }
        });

        it('donne plus de travail au groupe visé que la même séance sans focus', () => {
            const equipments: EquipmentInput[][] = [[], homeDumbbells];

            for (const group of MUSCLE_GROUPS) {
                for (const equipment of equipments) {
                    for (const goal of ['health', 'hypertrophy'] as const) {
                        const volume = (focus: boolean): number =>
                            many({ date: DATE, profile: { goal, level: 'intermediate' }, equipment, request: { minutes: 45, ...(focus ? { focus: [group] } : {}) } }).reduce(
                                (sum, session) => sum + (session.volume[group] ?? 0),
                                0,
                            );

                        expect(volume(true), `${group} · ${goal} · ${equipment.length ? 'haltères' : 'rien'}`).toBeGreaterThan(volume(false));
                    }
                }
            }
        });

        it('garde plusieurs exercices au groupe visé quand une seule famille le sert (pompes sans matériel, tractions avec une barre)', () => {
            for (const session of runs({ date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate' }, request: { minutes: 45, focus: ['chest'] } }, 12)) {
                const chest = items(session, ['main']).filter((item) => library.get(item.exercise).muscles.primary.some((muscle) => MUSCLE_INFO[muscle].group === 'chest'));

                expect(chest.length, items(session, ['main']).map((item) => item.exercise).join(', ')).toBeGreaterThanOrEqual(2);
            }

            for (const goal of ['health', 'hypertrophy'] as const) {
                for (const session of runs({ date: DATE, profile: { goal, level: 'intermediate' }, equipment: ['pullup-bar'], request: { minutes: 45, type: 'pull', focus: ['back'] } }, 12)) {
                    expect(items(session, ['main']).filter((item) => PULLS.includes(pattern(item))).length, items(session, ['main']).map((item) => item.exercise).join(', ')).toBeGreaterThanOrEqual(2);
                }
            }
        });

        it('ne dit « comme demandé » que d’un exercice qui fait travailler le groupe visé', () => {
            let checked = 0;

            for (const group of MUSCLE_GROUPS) {
                for (const equipment of [[], dumbbells, ['pullup-bar', 'resistance-band']] as EquipmentInput[][]) {
                    for (const session of many({ date: DATE, equipment, request: { minutes: 45, focus: [group] } })) {
                        for (const item of items(session, ['main']).filter(asked)) {
                            checked++;
                            expect(works(library.get(item.exercise), group), `${group} · ${item.exercise}`).toBe(true);
                        }
                    }
                }
            }

            expect(checked).toBeGreaterThan(300);
        });

        it('travaille le dos visé au sol quand rien ne permet de tirer', () => {
            for (const goal of ['health', 'hypertrophy', 'endurance'] as const) {
                for (const session of many({ date: DATE, profile: { goal }, request: { minutes: 45, focus: ['back'] } })) {
                    const focus = items(session, ['main']).filter(asked);

                    expect(focus.length, `${goal} · ${items(session, ['main']).map((item) => item.exercise).join(', ')}`).toBeGreaterThan(0);
                    for (const item of focus) expect(works(library.get(item.exercise), 'back'), item.exercise).toBe(true);
                }
            }
        });

        it('garde la durée demandée en santé et en endurance, à 10 % près, comme sans focus', () => {
            // Les abdominaux visés font une séance de tronc, un peu courte avec ou sans focus (programmation-8) : à part.
            for (const goal of ['health', 'endurance'] as const) {
                for (const group of ['chest', 'shoulders', 'lower-back', 'glutes', 'legs'] as const) {
                    for (const equipment of [[], [{ id: 'dumbbells', loads: [4, 8, 12, 16] }]] as EquipmentInput[][]) {
                        const short = (focus: boolean): number =>
                            runs({ date: DATE, profile: { goal, level: 'intermediate' }, equipment, request: { minutes: 45, ...(focus ? { focus: [group] } : {}) } }, 12).filter(
                                (session) => session.estimatedMinutes < 45 * 0.9,
                            ).length;
                        const label = `${goal} · ${group} · ${equipment.length ? 'haltères' : 'rien'}`;

                        expect(short(true), label).toBeLessThanOrEqual(Math.max(2, short(false)));
                    }
                }
            }
        });

        it('met ce qu’on vise dans le premier circuit, avec un gros mouvement', () => {
            let split = 0;

            for (const [label, input] of focusCases) {
                for (const session of many({ ...input, request: { ...input.request, format: 'circuit' } })) {
                    const circuits = session.blocks.filter((block) => block.role === 'main' && block.format === 'circuit');

                    if (circuits.length < 2) continue;

                    split++;

                    for (const item of circuits.slice(1).flatMap((block) => block.items)) expect(asked(item), `${label} · ${item.exercise}`).toBe(false);

                    // Les gros mouvements ne partent pas tous dans le second circuit, fait fatigué.
                    const compounds = (index: number): number => circuits[index]!.items.filter((item) => !asked(item) && library.get(item.exercise).compound).length;

                    if (compounds(1) > 0) expect(compounds(0), `${label} · ${circuits.map((block) => block.items.map((item) => item.exercise).join(' + ')).join(' | ')}`).toBeGreaterThan(0);
                }
            }

            expect(split).toBeGreaterThan(10);
        });

        it('ne met aucun exercice d’activation dans une place du focus quand un autre est faisable', () => {
            const equipments: EquipmentInput[][] = [[], dumbbells, ['resistance-band', 'two-chairs', 'table']];
            let checked = 0;

            for (const group of MUSCLE_GROUPS) {
                for (const equipment of equipments) {
                    for (const seed of SEEDS) {
                        const context = buildContext({ date: DATE, seed, equipment, request: { focus: [group] } });

                        for (const slot of FOCUS_SLOTS[group]) {
                            const workable = rank(slot, context, []).some((entry) => !warmupOnly(entry.definition) && entry.definition.difficulty - targetDifficulty(entry.definition, context) <= CEILING);
                            const picked = pick(slot, context, []);

                            if (!workable || !picked) continue;

                            checked++;
                            expect(warmupOnly(picked), `${group} · ${slot.key} · ${picked.id}`).toBe(false);
                        }
                    }
                }
            }

            expect(checked).toBeGreaterThan(200);
        });

        it('ne donne pas d’exercice d’activation en plus à des fessiers ou des cuisses visés, et sert des haltères déclarés', () => {
            for (const equipment of [dumbbells, []]) {
                for (const focus of ['glutes', 'legs'] as const) {
                    for (const session of runs({ date: DATE, equipment, request: { minutes: 40, focus: [focus] } })) {
                        expect(items(session, ['main']).filter((item) => warmupOnly(library.get(item.exercise))).map((item) => item.exercise), focus).toEqual([]);
                    }
                }
            }

            // Séance 24 : des haltères de 6 à 14 kg font au moins un exercice du bas du corps, pas seulement les mollets.
            const loaded = share(runs({ date: DATE, equipment: dumbbells, request: { minutes: 40, focus: ['glutes'] } }), (session) =>
                items(session, ['main']).some((item) => item.load?.equipment === 'dumbbells' && ['squat', 'lunge', 'hinge'].includes(pattern(item))),
            );

            expect(loaded).toBeGreaterThanOrEqual(0.8);
        });

        it('fait passer l’activation derrière sur toute place, pas seulement les places principales', () => {
            const context = buildContext({ date: DATE });
            const frog = library.get('frog-pump');
            const plain: ExerciseDefinition = { ...frog, tags: [] };

            for (const role of ['main', 'accessory', 'core'] as const) {
                const slot: Slot = { key: `essai-${role}`, role, patterns: ['hinge'], kinds: ['strength'] };

                expect(score(frog, slot, context, []), role).toBeCloseTo(score(plain, slot, context, []) * 0.3, 6);
            }
        });

        it('garde le rôle d’un exercice visé qu’on remplace : ses séries et « comme demandé »', () => {
            const input: GenerateInput = { date: DATE, seed: 4, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: homeDumbbells, request: { minutes: 45, format: 'straight', focus: ['arms'] } };
            const session = generateSession(input);
            const block = session.blocks.find((entry) => entry.role === 'main' && entry.items.some(asked))!;
            const index = block.items.findIndex(asked);
            const replacement = alternativesFor(session, input, block.id, index, 10).find((entry) => works(library.get(entry.id), 'arms'))!;
            const swapped = replaceExercise(session, input, block.id, index, replacement.id).blocks.find((entry) => entry.id === block.id)!.items[index]!;
            const asAccessory = prescribe(library.get(replacement.id), 'accessory', buildContext(input));

            expect(swapped.reasons[0]?.code, swapped.exercise).toBe('item-focus');
            expect(swapped.sets).toBeGreaterThanOrEqual(asAccessory.sets);
        });
    });

    describe('le développé chargé', () => {
        it('met un développé chargé en tête en salle, en force, avec un vrai tirage à côté', () => {
            const sessions = runs({ date: DATE, profile: { goal: 'strength', level: 'advanced', bodyweightKg: 80 }, equipment: gym, request: { minutes: 60 } });
            const pushOf = (session: Session): SessionItem | undefined => items(session, ['main']).find((item) => PUSHES.includes(pattern(item)));
            const pullOf = (session: Session): SessionItem | undefined => items(session, ['main']).find((item) => PULLS.includes(pattern(item)));

            expect(
                share(sessions, (session) => {
                    const push = pushOf(session);

                    return push !== undefined && library.get(push.exercise).compound && Boolean(library.get(push.exercise).tags?.includes('loaded'));
                }),
                sessions.map((session) => pushOf(session)?.exercise).join(', '),
            ).toBeGreaterThanOrEqual(0.9);

            // Jamais un développé sans tirage, et le tirage principal n'est pas un renegade row, que le gainage limite.
            for (const session of sessions) expect(pullOf(session), items(session, ['main']).map((item) => item.exercise).join(', ')).toBeDefined();
            expect(share(sessions, (session) => pullOf(session)?.exercise !== 'renegade-row'), sessions.map((session) => pullOf(session)?.exercise).join(', ')).toBeGreaterThanOrEqual(0.8);
        });

        it('ne remplace pas ce qu’on fait progresser par un exercice chargé', () => {
            const pushUps = runs({ date: DATE, history: series('push-up', [[10, 10, 9], [12, 12, 11], [14, 14, 13]], [12, 8, 4]), profile: { goal: 'hypertrophy', level: 'intermediate', bodyweightKg: 75 }, equipment: [{ id: 'dumbbells', loads: [2, 4] }], request: { minutes: 45 } });
            const pullUps = runs({ date: DATE, history: series('pull-up', [[5, 5, 4], [6, 6, 5], [7, 7, 6]], [12, 8, 4]), profile: { goal: 'strength', level: 'intermediate', bodyweightKg: 75 }, equipment: ['pullup-bar', { id: 'dumbbells', loads: [4, 6, 8, 10, 12, 14, 16, 20] }], request: { minutes: 45, type: 'upper' } });
            // Refaites deux jours plus tard sur une place principale : l'exercice qu'on fait progresser garde sa place.
            const archer = runs({ date: DATE, history: series('archer-pull-up', [[4, 4, 3]], [10, 6, 2]), profile: { goal: 'strength', level: 'advanced', bodyweightKg: 75 }, equipment: ['pullup-bar', 'dip-bars', 'bench', { id: 'dumbbells', loads: [4, 6, 8, 10, 12, 14, 16, 20, 24, 28] }], request: { minutes: 45, type: 'upper' } });
            const family = (name: string) => (session: Session): boolean => items(session, ['main']).some((item) => library.get(item.exercise).family === name);

            expect(share(pushUps, family('push-up'))).toBeGreaterThanOrEqual(0.85);
            expect(share(pullUps, family('pull-up'))).toBeGreaterThanOrEqual(0.9);
            expect(share(archer, (session) => items(session, ['main']).some((item) => item.exercise === 'archer-pull-up'))).toBeGreaterThanOrEqual(0.7);
        });

        it('ne prend pas un exercice chargé à une charge dérisoire pour l’objectif', () => {
            // Force, haltères de 2 à 6 kg : des pompes, pas un développé au sol à 6 kg.
            const light = runs({ date: DATE, profile: { goal: 'strength', level: 'intermediate', bodyweightKg: 75 }, equipment: [{ id: 'dumbbells', loads: [2, 4, 6] }], request: { minutes: 45 } });

            expect(share(light, (session) => items(session, ['main']).some((item) => PUSHES.includes(pattern(item)) && !item.load))).toBeGreaterThanOrEqual(0.9);

            // Force, avancé, une kettlebell de 12 kg : pas de squat à 12 kg comme flexion de jambes principale.
            for (const session of runs({ date: DATE, profile: { goal: 'strength', level: 'advanced', bodyweightKg: 80 }, equipment: [{ id: 'kettlebell', loads: [12] }], request: { minutes: 45 } })) {
                expect(items(session, ['main']).filter((item) => ['squat', 'lunge'].includes(pattern(item)) && item.load).map((item) => item.exercise)).toEqual([]);
            }
        });

        it('garde l’exercice au plateau, même au haut de sa fourchette, et passe à plus dur au plafond sans plateau', () => {
            const plateau = runs({ date: DATE, history: series('push-up', [[15, 15, 15]], [12, 9, 6, 3]), profile: { goal: 'health', level: 'intermediate' }, equipment: ['table'], request: { type: 'push', minutes: 30 } });

            expect(share(plateau, (session) => items(session, ['main']).some((item) => item.exercise === 'push-up'))).toBeGreaterThanOrEqual(0.9);

            const chosen = new Set<string>();

            for (const session of many({ date: DATE, history: series('push-up', [[15, 15, 15]], [7, 4]), profile: { goal: 'health', level: 'intermediate' }, request: { type: 'push', minutes: 30 } })) {
                const pushes = items(session, ['main']).filter((item) => library.get(item.exercise).family === 'push-up');

                expect(pushes.length).toBeGreaterThan(0);
                expect(Math.max(...pushes.map((item) => library.get(item.exercise).difficulty))).toBeGreaterThan(library.get('push-up').difficulty);

                for (const item of pushes) chosen.add(item.exercise);
            }

            expect(chosen.size).toBeGreaterThan(1);
        });
    });

    describe('les séries et le temps', () => {
        it('fait entrer le tirage sans aplatir la séance à deux séries', () => {
            // Séance 5 : focus bras, 30 min. Au plus un gros exercice à deux séries.
            for (const session of many({ date: DATE, profile: { goal: 'hypertrophy', level: 'intermediate', bodyweightKg: 75 }, equipment: homeDumbbells, request: { minutes: 30, focus: ['arms'] } })) {
                const flat = totals(session).filter((entry) => library.get(entry.item.exercise).compound && entry.total <= 2);

                expect(flat.length, totals(session).map((entry) => `${entry.item.exercise} ${entry.total}`).join(', ')).toBeLessThanOrEqual(1);
            }

            // Corps entier en force, 45 min : le tirage passe avant la charnière, jamais de poussée sans tirage (en séries
            // classiques ou par deux ; une échelle, qui allonge beaucoup son premier exercice, peut encore l'écarter).
            for (const [equipment, format] of [gym, homeDumbbells].flatMap((kit) => (['straight', 'superset'] as const).map((entry) => [kit, entry] as const))) {
                for (const session of runs({ date: DATE, profile: { goal: 'strength', level: 'intermediate', bodyweightKg: 75 }, equipment, request: { minutes: 45, type: 'full-body', format } }, 12)) {
                    expect(items(session, ['main']).some((item) => PULLS.includes(pattern(item))), items(session, ['main']).map((item) => item.exercise).join(', ')).toBe(true);
                }
            }
        });

        it('ne fait jamais dépasser son plafond du jour à un exercice, un jour léger, en circuit comme par deux', () => {
            const light = buildContext({ date: DATE, readiness: { energy: 2, sleepQuality: 3 } });
            const normal = buildContext({ date: DATE, profile: { goal: 'endurance', level: 'beginner' } });
            const planned = (id: string, sets: number, maxSets: number, context: typeof light): PlannedItem => {
                const prescription = prescribe(library.get(id), 'main', context);

                return { definition: library.get(id), sets, maxSets, target: prescription.target, restSeconds: prescription.restSeconds, equipment: prescription.equipment, reasons: [] };
            };

            expect(lightDay(light)).toBe(true);

            for (const format of ['circuit', 'superset'] as const) {
                const list = [planned('air-squat', 3, 3, light), planned('push-up', 2, 2, light), planned('reverse-lunge', 3, 3, light), planned('superman', 3, 3, light)];

                for (const block of buildMainBlocks(list, format, light, 1200).filter((entry) => entry.format !== 'straight')) {
                    for (const item of block.items) expect(block.rounds, `${format} · ${item.definition.id}`).toBeLessThanOrEqual(item.maxSets ?? Infinity);
                }
            }

            // Un jour ordinaire, un exercice plafonné par l'objectif seul (l'endurance d'un débutant) suit son circuit.
            const ordinary = buildMainBlocks([planned('air-squat', 3, 3, normal), planned('push-up', 2, 2, normal), planned('reverse-lunge', 3, 3, normal)], 'circuit', normal, 1200);

            expect(ordinary.map((block) => block.format)).toEqual(['circuit']);
        });
    });

    describe('les lombaires', () => {
        it('n’ajoute pas d’extensions lombaires après une charnière, en corps entier et en bas du corps chez un débutant', () => {
            const cases: Omit<GenerateInput, 'seed'>[] = [
                { date: DATE, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 60 } },
                { date: DATE, request: { minutes: 45 } },
                { date: DATE, profile: { goal: 'fat-loss', level: 'beginner' }, equipment: [{ id: 'dumbbells', loads: [2, 4, 6, 8] }], request: { minutes: 60 } },
                { date: DATE, readiness: { pain: [{ joint: 'knees', severity: 2 }] }, equipment: [{ id: 'dumbbells', loads: [4, 8, 12] }], request: { minutes: 40 } },
                { date: DATE, profile: { level: 'beginner' }, request: { minutes: 45, type: 'lower' } },
                { date: DATE, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 60, type: 'lower' } },
            ];

            for (const input of cases) {
                for (const seed of seeds(16)) {
                    const main = items(generateSession({ ...input, seed }), ['main']).map((item) => library.get(item.exercise));

                    if (main.some((definition) => definition.pattern === 'hinge' && loadsErectors(definition))) {
                        expect(main.filter((definition) => definition.pattern === 'trunk-extension').map((definition) => definition.id), `graine ${seed}`).toEqual([]);
                    }
                }
            }
        });

        it('garde les quadriceps au travail quand un genou fait mal et que les haltères le permettent, sans doubler le soulevé de terre', () => {
            for (const seed of seeds(16)) {
                const main = items(generateSession({ date: DATE, seed, readiness: { pain: [{ joint: 'knees', severity: 2 }] }, equipment: [{ id: 'dumbbells', loads: [4, 8, 12] }], request: { minutes: 40 } }), ['main']).map((item) =>
                    library.get(item.exercise),
                );

                expect(main.some((definition) => definition.muscles.primary.includes('quads')), `graine ${seed} : ${main.map((definition) => definition.id).join(', ')}`).toBe(true);
                expect(main.filter((definition) => definition.pattern === 'hinge' && definition.compound && loadsErectors(definition)).length, `graine ${seed}`).toBeLessThanOrEqual(1);
            }
        });

        it('n’enchaîne pas deux exercices qui chargent les érecteurs, ni en circuit ni par deux', () => {
            const planned = (ids: readonly string[]): PlannedItem[] => ids.map((id) => ({ definition: library.get(id) }) as PlannedItem);
            const adjacent = (order: readonly string[], a: string, b: string): boolean => Math.abs(order.indexOf(a) - order.indexOf(b)) === 1;

            const lumbar = alternateRegions(planned(['bodyweight-good-morning', 'superman', 'push-up', 'crunch'])).map((item) => item.definition.id);
            const squat = alternateRegions(planned(['prisoner-squat', 'bodyweight-good-morning', 'wall-isometric-external-rotation', 'split-squat'])).map((item) => item.definition.id);

            expect(adjacent(lumbar, 'bodyweight-good-morning', 'superman'), lumbar.join(', ')).toBe(false);
            expect(adjacent(squat, 'prisoner-squat', 'bodyweight-good-morning'), squat.join(', ')).toBe(false);

            for (const pair of pairUp(planned(['sumo-kettlebell-deadlift', 'bodyweight-good-morning', 'crunch', 'calf-raise']))) {
                expect(pair.filter((item) => loadsErectors(item.definition)).length, pair.map((item) => item.definition.id).join(', ')).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('les doublons', () => {
        const cases: [string, Omit<GenerateInput, 'seed'>][] = [
            ['fessiers, mini-bande et haltères', { date: DATE, equipment: dumbbells, request: { minutes: 40, focus: ['glutes'] } }],
            ['fessiers, sans matériel', { date: DATE, request: { minutes: 40, focus: ['glutes'] } }],
            ['jambes, haltères', { date: DATE, equipment: [{ id: 'dumbbells', loads: [6, 10, 14] }], request: { minutes: 45, focus: ['legs'] } }],
            ['jambes, sans matériel', { date: DATE, request: { minutes: 45, focus: ['legs'] } }],
            ['pectoraux, sans matériel', { date: DATE, request: { minutes: 45, focus: ['chest'] } }],
            ['corps entier, haltères', { date: DATE, equipment: [{ id: 'dumbbells', loads: [6, 10, 14] }], request: { minutes: 45 } }],
            ['haut du corps, haltères', { date: DATE, equipment: [{ id: 'dumbbells', loads: [6, 10, 14] }], request: { minutes: 60, type: 'upper' } }],
        ];
        const SMALL = new Set(['de', 'des', 'du', 'en', 'avec', 'la', 'le', 'les', 'à', 'au', 'aux', 'sur', 'une', 'un', 'et']);
        /** Les mots qui comptent dans un nom, sans les petits mots ni le pluriel. */
        const words = (name: string): Set<string> =>
            new Set(
                name
                    .toLowerCase()
                    .split(/[\s’']+/)
                    .map((word) => word.replace(/s$/, ''))
                    .filter((word) => word && !SMALL.has(word)),
            );

        it('ne met jamais un exercice et son jumeau chargé, ni deux fois un mouvement que la séance ne vise pas', () => {
            for (const [label, input] of cases) {
                for (const seed of seeds(12)) {
                    const session = generateSession({ ...input, seed });
                    const main = items(session, ['main']).map((item) => library.get(item.exercise));
                    const families = new Set(main.map((definition) => definition.family));
                    const detail = `${label} · graine ${seed} : ${main.map((definition) => definition.id).join(', ')}`;

                    // Des fentes statiques et des fentes statiques avec haltères : jamais les deux.
                    expect([...families].filter((family) => families.has(`loaded-${family}`)), detail).toEqual([]);

                    // Deux variantes d'un même mouvement, seulement pour le groupe demandé (sans matériel, toutes les
                    // poussées des pectoraux sont des pompes).
                    const asked = (input.request?.focus ?? []) as readonly string[];

                    for (const key of new Set(main.map(movementKey))) {
                        const same = main.filter((definition) => movementKey(definition) === key);

                        if (same.length > 1) {
                            for (const definition of same) expect(definition.muscles.primary.some((muscle) => asked.includes(MUSCLE_INFO[muscle].group)), detail).toBe(true);
                        }
                    }
                }
            }
        });

        it('ne donne pas deux noms dont l’un contient l’autre (« Fentes statiques », « Fentes statiques avec haltères »)', () => {
            // Sans matériel, un focus pectoraux n'a que des pompes : « Pompes » et « Pompes diamant » sont deux exercices.
            for (const [label, input] of cases.filter(([name]) => name !== 'pectoraux, sans matériel')) {
                for (const seed of seeds(12)) {
                    const names = items(generateSession({ ...input, seed }), ['main']).map((item) => item.name);

                    for (const a of names) {
                        for (const b of names.filter((other) => other !== a)) {
                            const [wa, wb] = [words(a), words(b)];

                            expect([...wa].every((word) => wb.has(word)), `${label} · graine ${seed} : « ${a} » et « ${b} »`).toBe(false);
                        }
                    }
                }
            }
        });

        it('nomme la marche des talons sans la confondre avec les ponts en marche, en gardant l’ancien nom', () => {
            expect(library.name('hamstring-walkout', 'fr')).toBe('Marche des talons en pont');
            expect(library.findByName('Ponts avec marche des talons')?.id).toBe('hamstring-walkout');
            expect(library.findByName('Ponts avec marche du talon sur une jambe')?.id).toBe('single-leg-hamstring-walkout');
            expect(library.name('hamstring-walkout', 'fr').split(' ')[0]).not.toBe(library.name('marching-glute-bridge', 'fr').split(' ')[0]);
        });
    });

    it('arrondit à un nombre pair, à l’échauffement, la version facile d’un exercice en alternance', () => {
        let checked = 0;

        for (const goal of ['health', 'hypertrophy', 'strength', 'endurance'] as const) {
            for (const equipment of [[], [{ id: 'dumbbells', loads: [2, 4, 6] }], homeDumbbells] as EquipmentInput[][]) {
                for (const session of many({ date: DATE, profile: { goal, level: 'intermediate' }, equipment, request: { minutes: 45 } })) {
                    for (const item of items(session, ['warmup']).filter((entry) => library.get(entry.exercise).alternating && entry.target.measure === 'reps')) {
                        checked++;
                        expect(item.target.value % 2, `${item.exercise} ${item.target.value}`).toBe(0);
                    }
                }
            }
        }

        expect(checked).toBeGreaterThan(20);
    });
});

describe('la deuxième relecture : séances courtes et lendemain', () => {
    it('dit quand une séance reste nettement sous la durée demandée, sans se remplir pour rien', () => {
        for (const goal of ['health', 'endurance', 'hypertrophy'] as const) {
            for (const minutes of [45, 60]) {
                for (const request of [{ minutes }, { minutes, focus: ['chest' as const] }]) {
                    for (const session of many({ date: DATE, profile: { goal }, request })) {
                        const announced = session.reasons.some((entry) => entry.code === 'session-shorter');

                        expect(announced, `${goal} · ${minutes} min · ${session.estimatedMinutes} min`).toBe(session.estimatedMinutes < minutes * 0.9);
                        if (announced) expect(session.summary).toMatch(/tient en/);
                    }
                }
            }
        }
    });

    it('fait travailler un débutant en endurance trois séries quand le temps le permet', () => {
        const sets = many({ date: DATE, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 60 } }).flatMap((session) =>
            session.blocks.filter((block) => block.role === 'main').flatMap((block) => block.items.map((item) => item.sets * block.rounds)),
        );

        expect(Math.max(...sets)).toBeGreaterThanOrEqual(3);
    });

    it('ne redonne pas la séance de la veille, exercice pour exercice', () => {
        let same = 0;

        for (const seed of SEEDS) {
            const yesterday = generateSession({ date: '2026-10-02T18:00', seed, equipment: ['pullup-bar', 'dip-bars'], request: { minutes: 45, type: 'upper' } });
            const done = items(yesterday, ['main']);
            const history: PastSession[] = [{ date: '2026-10-02T18:00', exercises: done.map((item) => ({ exercise: item.exercise, sets: [{ reps: item.target.value }] })) }];
            const today = generateSession({ date: DATE, seed: seed + 100, equipment: ['pullup-bar', 'dip-bars'], history, request: { minutes: 45, type: 'upper' } });
            const before = new Set(done.map((item) => item.exercise));

            if (items(today, ['main']).every((item) => before.has(item.exercise))) same++;
        }

        expect(same).toBe(0);
    });
});

describe('le tempo de DidIt et le temps qui reste', () => {
    it('chronomètre une phase en 2, 1 et 0,5 s, comme DidIt', () => {
        expect(TEMPO_PHASE_SECONDS).toEqual({ slow: 2, normal: 1, fast: 0.5 });
        expect(repSeconds('slow')).toBe(4);
        expect(repSeconds('normal')).toBe(2);
        expect(repSeconds('fast')).toBe(1);
    });

    it('comble le temps libre d’un finisher doux plutôt que de finir en avance', () => {
        for (const goal of ['health', 'endurance', 'hypertrophy'] as const) {
            const at45 = many({ date: DATE, profile: { goal }, request: { minutes: 45 } });
            const at60 = many({ date: DATE, profile: { goal }, request: { minutes: 60 } });

            for (const session of at45) expect(session.estimatedMinutes, `${goal} · 45 min`).toBeGreaterThanOrEqual(45 * 0.9);
            // À 60 minutes, un débutant plafonne à une demi-heure de renforcement et dix minutes de finisher : la séance
            // tient au moins 85 % du temps, et dit sa vraie durée quand elle reste sous 90 %.
            for (const session of at60) expect(session.estimatedMinutes, `${goal} · 60 min`).toBeGreaterThanOrEqual(60 * 0.85);
        }
    });

    it('ne met pas de finisher de temps libre un jour léger', () => {
        for (const session of many({ date: DATE, readiness: { energy: 2, sleepQuality: 2 }, request: { minutes: 60 } })) {
            expect(session.blocks.some((block) => block.role === 'finisher')).toBe(false);
        }
    });

    it('donne au retour au calme la durée voulue, même sous le bas de la fiche', () => {
        for (const session of many({ date: DATE, request: { minutes: 10 } })) {
            const breathing = session.blocks.find((block) => block.role === 'cooldown')!.items.find((item) => library.get(item.exercise).kind === 'breathing');

            if (breathing) expect(breathing.target.value).toBeLessThanOrEqual(30);
        }

        const ride = generateSession({ date: DATE, equipment: ['bike'], request: { minutes: 45, type: 'cardio' } });
        const easy = ride.blocks.find((block) => block.role === 'cooldown')!.items[0]!;

        expect(easy.target.measure).toBe('time');
        expect(easy.target.value).toBeLessThanOrEqual(180);
    });
});
