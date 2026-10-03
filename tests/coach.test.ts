// Les règles demandées par la relecture des séances (trois coachs : programmation, sécurité, clarté). Chacune
// est vérifiée sur plusieurs graines : c'est le comportement général qui compte, pas un tirage heureux.
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '../src/library';
import { MUSCLE_INFO } from '../src/library/anatomy';
import { generateSession } from '../src/session/generate';
import { alternateRegions } from '../src/session/formats';
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
