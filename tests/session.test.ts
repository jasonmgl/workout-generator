// La séance du jour, sur le catalogue intégré. D'abord des règles qui
// doivent tenir pour toutes les séances d'une grille de profils (matériel,
// objectifs, niveaux, durées, contraintes), puis des cas précis : jambes
// fatiguées, focus, progression, repos imposé.
import { describe, expect, it } from 'vitest';
import { defaultLibrary } from '../src/library';
import { inventory, satisfies, type EquipmentInput } from '../src/library/equipment';
import { MUSCLE_INFO } from '../src/library/anatomy';
import { generateSession } from '../src/session/generate';
import { sessionToText } from '../src/output/text';
import { toTimeline } from '../src/output/timeline';
import { toTree } from '../src/output/tree';
import type { GenerateInput, Goal, Level, Session, SessionItem } from '../src/types';

const library = defaultLibrary();
const DATE = '2026-10-02T18:00';

const items = (session: Session, roles: readonly string[] = ['main', 'skill', 'finisher']): SessionItem[] =>
    session.blocks.filter((block) => roles.includes(block.role)).flatMap((block) => block.items);
const ids = (session: Session, roles?: readonly string[]): string[] => items(session, roles).map((item) => item.exercise);

const EQUIPMENT: Readonly<Record<string, readonly EquipmentInput[]>> = {
    rien: [],
    maison: ['two-chairs', 'table', 'towel', 'door'],
    barre: ['pullup-bar', 'resistance-band'],
    halteres: [{ id: 'dumbbells', loads: [2, 4, 6, 8, 10, 12, 16, 20] }, 'bench'],
    salle: [{ id: 'barbell', loads: [20, 40, 60, 80] }, 'rack', 'bench', { id: 'dumbbells', loads: [5, 10, 15, 20] }, 'pullup-bar', 'dip-bars', { id: 'kettlebell', loads: [12, 16, 24] }],
    exterieur: ['outdoor', 'jump-rope'],
};
const GOALS: readonly Goal[] = ['health', 'strength', 'hypertrophy', 'endurance', 'fat-loss'];
const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];
const MINUTES = [10, 20, 30, 45, 60];

/** La grille : chaque matériel, chaque objectif, chaque niveau, une durée qui tourne. */
const GRID: GenerateInput[] = Object.entries(EQUIPMENT).flatMap(([, equipment], e) =>
    GOALS.flatMap((goal, g) =>
        LEVELS.map((level, l) => ({
            date: DATE,
            seed: 1000 + e * 100 + g * 10 + l,
            equipment,
            profile: { goal, level },
            request: { minutes: MINUTES[(e + g + l) % MINUTES.length]! },
        })),
    ),
);

describe('toutes les séances de la grille', () => {
    const sessions = GRID.map((input) => ({ input, session: generateSession(input) }));

    it(`sont ${GRID.length}, et se génèrent toutes`, () => {
        expect(sessions).toHaveLength(GRID.length);
    });

    it('se rejouent à l’identique avec la même entrée', () => {
        for (const { input, session } of sessions.slice(0, 20)) {
            expect(generateSession(input)).toEqual(session);
        }
    });

    it('tiennent la durée demandée', () => {
        for (const { input, session } of sessions) {
            const asked = input.request!.minutes!;
            const label = `${JSON.stringify(input.profile)} ${asked} min : ${session.estimatedMinutes} min`;

            expect(session.estimatedMinutes, label).toBeGreaterThanOrEqual(Math.floor(asked * 0.75) - 1);
            expect(session.estimatedMinutes, label).toBeLessThanOrEqual(Math.ceil(asked * 1.2) + 1);
        }
    });

    it('ne proposent que ce qui se fait avec le matériel', () => {
        for (const { input, session } of sessions) {
            const available = inventory(input.equipment ?? []);

            for (const item of items(session, ['warmup', 'main', 'skill', 'finisher', 'cooldown'])) {
                expect(satisfies(library.get(item.exercise).equipment, available), `${item.exercise} avec ${JSON.stringify(input.equipment)}`).toBe(true);
            }
        }
    });

    it('commencent par l’échauffement et finissent par le retour au calme', () => {
        for (const { session } of sessions) {
            expect(session.blocks[0]?.role).toBe('warmup');
            expect(session.blocks[session.blocks.length - 1]?.role).toBe('cooldown');
        }
    });

    it('n’étirent pas à froid, et étirent au retour au calme', () => {
        for (const { session } of sessions) {
            const warmup = session.blocks.find((block) => block.role === 'warmup')!;
            const cooldown = session.blocks.find((block) => block.role === 'cooldown')!;

            expect(warmup.items.some((item) => library.get(item.exercise).kind === 'stretch')).toBe(false);
            expect(cooldown.items.some((item) => library.get(item.exercise).kind === 'stretch')).toBe(true);
        }
    });

    it('ont au moins deux exercices de travail', () => {
        for (const { input, session } of sessions) {
            expect(items(session).length, JSON.stringify(input)).toBeGreaterThanOrEqual(2);
        }
    });

    it('ne répètent pas un exercice dans la partie principale', () => {
        for (const { session } of sessions) {
            const main = ids(session, ['main', 'skill']);

            expect(new Set(main).size).toBe(main.length);
        }
    });

    it('gardent toujours une répétition en réserve, et des cibles dans leur fourchette', () => {
        for (const { session } of sessions) {
            for (const item of items(session, ['main', 'skill', 'finisher'])) {
                if (item.rir !== undefined) expect(item.rir).toBeGreaterThanOrEqual(1);

                expect(item.sets).toBeGreaterThanOrEqual(1);
                expect(item.target.value).toBeGreaterThanOrEqual(item.target.range[0]);
                expect(item.target.value).toBeLessThanOrEqual(item.target.range[1]);
                expect(item.restSeconds).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('donnent un tempo à chaque exercice de renforcement en répétitions', () => {
        for (const { session } of sessions) {
            for (const item of items(session, ['main', 'skill'])) {
                const definition = library.get(item.exercise);

                if (definition.measure === 'reps' && (definition.kind === 'strength' || definition.kind === 'power')) {
                    expect(item.tempo, item.exercise).toBeDefined();
                }
            }
        }
    });

    it('rangent les gros mouvements avant l’isolation, et le gainage à la fin', () => {
        for (const { session } of sessions) {
            const main = session.blocks.filter((block) => block.role === 'main' && block.format === 'straight').flatMap((block) => block.items);
            const coreIndex = main.findIndex((item) => ['anti-extension', 'anti-rotation', 'anti-lateral-flexion', 'trunk-flexion', 'trunk-extension'].includes(library.get(item.exercise).pattern));

            if (coreIndex >= 0) {
                for (const item of main.slice(coreIndex)) {
                    expect(library.get(item.exercise).compound && library.get(item.exercise).muscles.primary.some((muscle) => ['legs', 'chest', 'back'].includes(MUSCLE_INFO[muscle].group)), item.exercise).toBe(false);
                }
            }
        }
    });

    it('nomment chaque exercice en français et expliquent chaque choix sans trou', () => {
        for (const { session } of sessions) {
            for (const item of items(session, ['warmup', 'main', 'skill', 'finisher', 'cooldown'])) {
                expect(item.name, item.exercise).not.toBe(item.exercise);
            }

            for (const entry of [...session.reasons, ...session.warnings, ...items(session).flatMap((item) => item.reasons)]) {
                expect(entry.text, entry.code).not.toMatch(/[{}]/);
                expect(entry.text.length, entry.code).toBeGreaterThan(5);
            }

            expect(session.title).not.toMatch(/[{}]/);
        }
    });

    it('se lisent en texte, se déplient en étapes et en arbre', () => {
        for (const { session } of sessions) {
            const steps = toTimeline(session);
            const seconds = steps.reduce((sum, step) => sum + step.seconds, 0);

            expect(sessionToText(session)).toContain(session.title);
            expect(steps.length).toBeGreaterThan(3);
            expect(seconds).toBeGreaterThan(session.estimatedMinutes * 60 * 0.6);
            expect(seconds).toBeLessThan(session.estimatedMinutes * 60 * 1.4 + 60);
            expect(toTree(session)).toHaveLength(session.blocks.length);
        }
    });

    it('prennent des charges parmi celles qu’on a', () => {
        for (const { input, session } of sessions) {
            const available = inventory(input.equipment ?? []);

            for (const item of items(session)) {
                if (item.load) {
                    expect(available.loadsOf(item.load.equipment), item.exercise).toContain(item.load.kg);
                }
            }
        }
    });
});

describe('les contraintes du jour', () => {
    it('ne saute pas quand on demande du calme', () => {
        for (let seed = 1; seed <= 15; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'fat-loss' }, equipment: ['jump-rope'], request: { minutes: 30, quiet: true } });

            for (const item of items(session, ['warmup', 'main', 'finisher', 'cooldown'])) {
                expect(library.get(item.exercise).impact, item.exercise).not.toBe('high');
            }
        }
    });

    it('ménage une articulation douloureuse', () => {
        for (let seed = 1; seed <= 15; seed++) {
            const session = generateSession({ date: DATE, seed, readiness: { pain: [{ joint: 'wrists', severity: 2 }] }, request: { minutes: 30 } });

            for (const item of items(session, ['warmup', 'main', 'finisher', 'cooldown'])) {
                expect(library.get(item.exercise).joints?.wrists ?? 0, item.exercise).toBeLessThanOrEqual(1);
            }
        }
    });

    it('n’entre pas dans ce qu’on veut éviter', () => {
        for (let seed = 1; seed <= 15; seed++) {
            const session = generateSession({ date: DATE, seed, equipment: EQUIPMENT.maison!, request: { minutes: 40, avoid: ['legs', 'glutes'] } });

            for (const item of items(session)) {
                const groups = library.get(item.exercise).muscles.primary.map((muscle) => MUSCLE_INFO[muscle].group);

                expect(groups.includes('legs') || groups.includes('glutes'), item.exercise).toBe(false);
            }
        }
    });

    it('écarte les exercices exclus et ceux qu’on n’aime pas', () => {
        const first = generateSession({ date: DATE, seed: 4, request: { minutes: 30 } });
        const banned = ids(first).slice(0, 2);
        const second = generateSession({ date: DATE, seed: 4, profile: { dislikes: [banned[0]!] }, request: { minutes: 30, exclude: [banned[1]!] } });

        expect(ids(second, ['warmup', 'main', 'finisher', 'cooldown'])).not.toContain(banned[0]);
        expect(ids(second, ['warmup', 'main', 'finisher', 'cooldown'])).not.toContain(banned[1]);
    });

    it('met ce qu’on demande d’inclure', () => {
        const session = generateSession({ date: DATE, equipment: ['pullup-bar'], request: { minutes: 30, include: ['pull-up'] } });

        expect(ids(session)).toContain('pull-up');
    });
});

describe('le type de séance', () => {
    it('fait le haut du corps après une longue sortie vélo', () => {
        const session = generateSession({
            date: DATE,
            history: [{ date: '2026-10-01T10:00', activities: [{ type: 'bike', minutes: 120, intensity: 'hard' }] }],
            equipment: EQUIPMENT.maison!,
            request: { minutes: 40 },
        });

        expect(session.type).toBe('upper');
        expect(session.reasons[0]?.code).toBe('type-legs-tired-activity');
    });

    it('fait le bas du corps quand le haut a travaillé hier', () => {
        const session = generateSession({
            date: DATE,
            history: [
                {
                    date: '2026-10-01T18:00',
                    exercises: [
                        { exercise: 'push-up', sets: [{ reps: 15 }, { reps: 14 }, { reps: 12 }, { reps: 12 }] },
                        { exercise: 'pull-up', sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }, { reps: 6 }] },
                        { exercise: 'pike-push-up', sets: [{ reps: 10 }, { reps: 9 }, { reps: 8 }] },
                        { exercise: 'inverted-row-bar', sets: [{ reps: 12 }, { reps: 12 }, { reps: 10 }] },
                    ],
                },
            ],
            equipment: ['pullup-bar', 'low-bar'],
            request: { minutes: 40 },
        });

        expect(session.type).toBe('lower');
    });

    it('fait corps entier quand tout est frais', () => {
        expect(generateSession({ date: DATE, request: { minutes: 30 } }).type).toBe('full-body');
    });

    it('suit le groupe demandé', () => {
        const session = generateSession({ date: DATE, equipment: EQUIPMENT.halteres!, request: { minutes: 40, focus: ['glutes'] } });
        const glutes = items(session).filter((item) => library.get(item.exercise).muscles.primary.some((muscle) => MUSCLE_INFO[muscle].group === 'glutes'));

        expect(session.type).toBe('lower');
        expect(glutes.length).toBeGreaterThanOrEqual(3);
        expect(session.focus).toEqual(['glutes']);
    });

    it('suit le type demandé, et le plan de la semaine', () => {
        expect(generateSession({ date: DATE, request: { type: 'core' } }).type).toBe('core');
        expect(generateSession({ date: DATE, plan: { date: DATE, kind: 'training', type: 'pull' }, equipment: ['pullup-bar'] }).type).toBe('pull');
    });

    it('propose une séance de mobilité les jours de petite forme', () => {
        const session = generateSession({ date: DATE, readiness: { energy: 1, sleepQuality: 1, stress: 5 } });

        expect(session.type).toBe('mobility');
        expect(items(session, ['main']).every((item) => library.get(item.exercise).kind === 'mobility')).toBe(true);
    });

    it('fait un cardio en continu quand on a de quoi courir', () => {
        const session = generateSession({ date: DATE, equipment: ['outdoor'], request: { type: 'cardio', minutes: 40 } });
        const main = items(session, ['main']);

        expect(main).toHaveLength(1);
        expect(library.get(main[0]!.exercise).kind).toBe('conditioning');
        expect(main[0]!.target.measure).toBe('time');
    });

    it('fait des intervalles en séance fractionnée', () => {
        const session = generateSession({ date: DATE, request: { type: 'hiit', minutes: 25 } });
        const main = session.blocks.find((block) => block.role === 'main')!;

        expect(['intervals', 'tabata']).toContain(main.format);
        expect(main.workSeconds).toBeGreaterThan(0);
    });
});

describe('les défauts vus en relisant les séances', () => {
    it('garantit un curl et une extension des triceps quand on vise les bras, même en 30 minutes', () => {
        for (let seed = 1; seed <= 10; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: EQUIPMENT.halteres!, request: { minutes: 30, focus: ['arms'] } });
            const patterns = items(session, ['main']).map((item) => library.get(item.exercise).pattern);

            expect(patterns, `graine ${seed}`).toContain('elbow-flexion');
            expect(patterns, `graine ${seed}`).toContain('elbow-extension');
        }
    });

    it('fait la force à la barre quand on a une salle', () => {
        for (let seed = 1; seed <= 10; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'strength', level: 'advanced', bodyweightKg: 80 }, equipment: EQUIPMENT.salle!, request: { minutes: 60 } });
            const loaded = items(session, ['main']).filter((item) => library.get(item.exercise).tags?.includes('loaded'));

            expect(loaded.length, `graine ${seed} : ${ids(session, ['main']).join(', ')}`).toBeGreaterThanOrEqual(2);
        }
    });

    it('enchaîne plusieurs tours de cardio en fin de séance', () => {
        for (let seed = 1; seed <= 30; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'fat-loss', level: 'intermediate' }, request: { minutes: 35 } });
            const finisher = session.blocks.find((block) => block.role === 'finisher');

            if (finisher) {
                expect(finisher.rounds * finisher.items.length * ((finisher.workSeconds ?? 0) + (finisher.restSeconds ?? 0)), `graine ${seed}`).toBeGreaterThanOrEqual(180);
            }
        }
    });

    it('ne laisse pas un exercice seul en séries classiques après des supersets', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: EQUIPMENT.maison!, request: { minutes: 45, format: 'superset' } });
            const main = session.blocks.filter((block) => block.role === 'main');

            expect(main.some((block) => block.format === 'straight' && block.items.length === 1) && main.length > 1, `graine ${seed}`).toBe(false);
        }
    });

    it('nomme l’exercice d’après le matériel qui sert vraiment', () => {
        for (let seed = 1; seed <= 10; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { level: 'intermediate' }, equipment: [{ id: 'kettlebell', loads: [16] }], request: { minutes: 30 } });

            for (const item of items(session, ['warmup', 'main', 'finisher', 'cooldown'])) {
                expect(item.name, `graine ${seed}`).not.toMatch(/halt[eè]re/i);
            }
        }
    });

    it('ne met pas trois variantes de la même famille dans une séance', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 60 } });
            const families = items(session, ['main']).map((item) => library.get(item.exercise).family);
            const counts = families.reduce<Record<string, number>>((tally, family) => ({ ...tally, [family]: (tally[family] ?? 0) + 1 }), {});

            expect(Math.max(...Object.values(counts)), `graine ${seed} : ${families.join(', ')}`).toBeLessThanOrEqual(2);
        }
    });

    it('ne fait pas de négatives lentes dans un circuit d’endurance', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const session = generateSession({ date: DATE, seed, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 45 } });

            for (const item of items(session, ['main'])) {
                expect(library.get(item.exercise).tags ?? [], `graine ${seed} : ${item.exercise}`).not.toContain('eccentric');
            }
        }
    });

    it('travaille le haut du dos au sol quand rien ne permet de tirer', () => {
        for (let seed = 1; seed <= 10; seed++) {
            const session = generateSession({ date: DATE, seed, request: { minutes: 30 } });
            const back = items(session, ['main']).filter((item) => library.get(item.exercise).muscles.primary.some((muscle) => MUSCLE_INFO[muscle].group === 'back'));

            expect(back.length, `graine ${seed}`).toBeGreaterThanOrEqual(1);
            expect(back.some((item) => library.get(item.exercise).pattern === 'scapular'), `graine ${seed}`).toBe(true);
        }
    });
});

describe('le repos', () => {
    it('ne propose qu’un repos actif quand le pouls est trop haut', () => {
        const session = generateSession({
            date: DATE,
            readiness: {
                restingHeartRate: 64,
                heartRateHistory: [52, 53, 54, 52, 53].map((bpm, index) => ({ date: `2026-09-2${index + 3}`, bpm })),
            },
            request: { minutes: 45 },
        });

        expect(session.rest).toBe(true);
        expect(session.type).toBe('recovery');
        expect(session.estimatedMinutes).toBeLessThanOrEqual(16);
        expect(session.summary).toMatch(/Repos conseillé/);
        expect(items(session, ['main', 'cooldown']).every((item) => ['mobility', 'stretch', 'breathing'].includes(library.get(item.exercise).kind))).toBe(true);
    });

    it('fait quand même la séance quand on insiste, avec un avertissement', () => {
        const session = generateSession({ date: DATE, readiness: { ill: true }, request: { minutes: 30, ignoreReadiness: true } });

        expect(session.rest).toBe(false);
        expect(session.warnings.map((entry) => entry.code)).toContain('readiness-ignored');
    });
});

describe('la progression', () => {
    const pushUps = (date: string, reps: number[]) => ({ date, exercises: [{ exercise: 'push-up', sets: reps.map((value) => ({ reps: value })) }] });

    it('passe à une variante plus dure quand la dernière fois était au plafond', () => {
        const history = [pushUps('2026-09-26', [15, 15, 15]), pushUps('2026-09-29', [15, 15, 15])];
        const session = generateSession({ date: DATE, history, profile: { goal: 'health', level: 'intermediate' }, request: { type: 'push', minutes: 30 } });
        const pushes = items(session).filter((item) => library.get(item.exercise).family === 'push-up');

        expect(pushes.length).toBeGreaterThan(0);
        expect(Math.max(...pushes.map((item) => library.get(item.exercise).difficulty))).toBeGreaterThan(3);
    });

    it('ajoute une répétition quand la dernière fois était réussie sans être au plafond', () => {
        const history = [pushUps('2026-09-29', [10, 10, 10])];
        const session = generateSession({ date: DATE, history, profile: { goal: 'health' }, request: { minutes: 30, include: ['push-up'] } });
        const item = items(session).find((entry) => entry.exercise === 'push-up')!;

        expect(item.progression?.step).toBe('more');
        expect(item.target.value).toBe(11);
    });

    it('change de rythme après un plateau', () => {
        const history = ['2026-09-20', '2026-09-23', '2026-09-26', '2026-09-29'].map((date) => pushUps(date, [10, 9, 8]));
        const session = generateSession({ date: DATE, history, request: { minutes: 30, include: ['push-up'] } });
        const item = items(session).find((entry) => entry.exercise === 'push-up')!;

        expect(item.progression?.step).toBe('vary');
        expect(item.tempo).toBe('slow');
    });

    it('allège après une coupure', () => {
        const session = generateSession({ date: DATE, history: [pushUps('2026-09-10', [12, 12, 12])], request: { minutes: 30, include: ['push-up'] } });
        const item = items(session).find((entry) => entry.exercise === 'push-up')!;

        expect(item.progression?.step).toBe('comeback');
    });

    it('prend la charge au-dessus quand le haut de la fourchette est atteint', () => {
        const history = [{ date: '2026-09-29', exercises: [{ exercise: 'goblet-squat', sets: [{ reps: 15, loadKg: 8 }, { reps: 15, loadKg: 8 }, { reps: 15, loadKg: 8 }] }] }];
        const session = generateSession({ date: DATE, history, equipment: [{ id: 'dumbbells', loads: [8, 10, 12] }], request: { minutes: 30, include: ['goblet-squat'] } });
        const item = items(session).find((entry) => entry.exercise === 'goblet-squat')!;

        expect(item.load?.kg).toBe(10);
        expect(item.progression?.step).toBe('add-load');
    });

    it('ne fait pas deux séances identiques deux jours de suite', () => {
        const monday = generateSession({ date: '2026-10-05', request: { minutes: 30 } });
        const tuesday = generateSession({ date: '2026-10-06', request: { minutes: 30 } });

        expect(ids(monday)).not.toEqual(ids(tuesday));
    });
});

describe('les objectifs', () => {
    const sample = (goal: Goal): SessionItem[] =>
        [1, 2, 3, 4, 5].flatMap((seed) =>
            items(generateSession({ date: DATE, seed, profile: { goal, level: 'intermediate' }, equipment: EQUIPMENT.salle!, request: { minutes: 45 } }), ['main']),
        ).filter((item) => item.target.measure === 'reps' && library.get(item.exercise).kind === 'strength');
    const average = (list: readonly number[]): number => list.reduce((sum, value) => sum + value, 0) / list.length;

    it('fait peu de répétitions et de longs repos pour la force', () => {
        const strength = sample('strength');

        expect(average(strength.map((item) => item.target.value))).toBeLessThanOrEqual(8);
        expect(average(strength.map((item) => item.restSeconds))).toBeGreaterThanOrEqual(90);
    });

    it('fait beaucoup de répétitions pour l’endurance', () => {
        expect(average(sample('endurance').map((item) => item.target.value))).toBeGreaterThanOrEqual(13);
    });

    it('place la prise de muscle entre les deux', () => {
        const value = average(sample('hypertrophy').map((item) => item.target.value));

        expect(value).toBeGreaterThanOrEqual(7);
        expect(value).toBeLessThanOrEqual(13);
    });
});
