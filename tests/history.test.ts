// L'historique : la charge des jours passés, la fatigue de chaque muscle et
// ce qu'on sait faire dans chaque famille. Sur le petit catalogue de test.
import { describe, expect, it } from 'vitest';
import { activityLoad } from '../src/history/activities';
import { bodyState, sorenessByMuscle } from '../src/history/fatigue';
import { pastSessions, sessionLoad, sessionMinutes, trainingLoad } from '../src/history/load';
import { capacity, levelFor, performancesOf, succeeded } from '../src/history/progress';
import { Library } from '../src/library/library';
import type { PastSession } from '../src/types';
import { FIXTURE, FIXTURE_FR } from './fixtures/catalog';

const library = new Library(FIXTURE, { fr: FIXTURE_FR });
const NOW = '2026-10-02T18:00';
const squats = (date: string, sets = 4, reps = 15, extra: Partial<PastSession> = {}): PastSession => ({
    date,
    minutes: 30,
    exercises: [{ exercise: 'air-squat', sets: Array.from({ length: sets }, () => ({ reps })) }],
    ...extra,
});

describe('la charge d’entraînement', () => {
    it('suppose une durée aux séances qui n’en ont pas', () => {
        expect(sessionMinutes({ date: '2026-10-01' })).toBe(30);
        expect(sessionMinutes(squats('2026-10-01', 4, 10, { minutes: undefined as never }))).toBe(6);
        expect(sessionMinutes({ date: '2026-10-01', exercises: [{ exercise: 'push-up', sets: [{ reps: 10 }, { reps: 10 }] }] })).toBe(3);
    });

    it('multiplie la durée par l’effort perçu', () => {
        expect(sessionLoad({ date: '2026-10-01', minutes: 40, effort: 'hard' })).toBe(280);
        expect(sessionLoad({ date: '2026-10-01', minutes: 40, rpe: 9 })).toBe(360);
        expect(sessionLoad({ date: '2026-10-01', minutes: 40 })).toBe(200);
    });

    it('ignore les séances à venir et range les autres de la plus récente à la plus ancienne', () => {
        const ordered = pastSessions([squats('2026-09-30'), squats('2026-10-05'), squats('2026-10-02T08:00'), squats('2026-10-01')], NOW);

        expect(ordered.map((session) => session.date)).toEqual(['2026-10-02T08:00', '2026-10-01', '2026-09-30']);
    });

    it('garde une séance du jour notée sans heure, même tôt le matin', () => {
        expect(pastSessions([squats('2026-10-02')], '2026-10-02T07:00')).toHaveLength(1);
    });

    it('compte les jours d’affilée sans repos, et un repos déclaré coupe la série', () => {
        const week = Array.from({ length: 7 }, (_, index) => squats(`2026-09-${String(25 + index).padStart(2, '0')}`));

        expect(trainingLoad(week, '2026-10-02').daysWithoutRest).toBe(7);
        expect(trainingLoad(week, '2026-10-02', ['2026-09-29']).daysWithoutRest).toBe(2);
        expect(trainingLoad(week.slice(0, 5), '2026-10-02').daysWithoutRest).toBe(0);
    });

    it('compte la séance du jour dans la série quand il y en a déjà une', () => {
        expect(trainingLoad([squats('2026-10-01'), squats('2026-10-02T07:00')], NOW).daysWithoutRest).toBe(2);
    });

    it('compare la semaine à l’habitude, une fois trois semaines d’historique', () => {
        const habit = [0, 3, 7, 10, 14, 17, 21, 24].map((days) => ({ date: `2026-09-${String(30 - days).padStart(2, '0')}`, minutes: 30, effort: 'right' as const }));
        const calm = trainingLoad(habit, '2026-10-02');
        const spike = trainingLoad(
            [...habit, ...['2026-09-27', '2026-09-28', '2026-09-29', '2026-10-01'].map((date) => ({ date, minutes: 60, effort: 'hard' as const }))],
            '2026-10-02',
        );

        expect(calm.ratio).toBeGreaterThan(0.6);
        expect(calm.ratio).toBeLessThan(1.3);
        expect(spike.ratio).toBeGreaterThan(1.5);
        expect(trainingLoad(habit.slice(0, 3), '2026-10-02').ratio).toBeUndefined();
    });

    it('retient le dernier ressenti de la semaine et les jours depuis la dernière séance', () => {
        const load = trainingLoad([squats('2026-09-20', 4, 15, { effort: 'easy' }), squats('2026-09-29', 4, 15, { effort: 'hard' }), squats('2026-09-30')], NOW);

        expect(load.lastEffort).toBe('hard');
        expect(load.daysSinceLast).toBe(2);
        expect(load.sessions7).toBe(2);
        expect(load.minutes7).toBe(60);
    });
});

describe('la fatigue des muscles', () => {
    it('laisse tout frais sans historique', () => {
        const state = bodyState([], NOW, library);

        expect(state.muscles.quads.recovery).toBe(1);
        expect(state.groups.legs.weeklySets).toBe(0);
    });

    it('fatigue les muscles travaillés hier, et ceux-là seulement', () => {
        const state = bodyState([squats('2026-10-01T18:00')], NOW, library);

        expect(state.muscles.quads.recovery).toBeLessThan(0.7);
        expect(state.muscles['glute-max'].recovery).toBeLessThan(0.7);
        expect(state.muscles.pecs.recovery).toBe(1);
        expect(state.muscles.quads.lastWorked).toBe('2026-10-01T18:00');
    });

    it('efface la fatigue avec le temps', () => {
        const yesterday = bodyState([squats('2026-10-01T18:00')], NOW, library).muscles.quads.recovery;
        const threeDays = bodyState([squats('2026-09-29T18:00')], NOW, library).muscles.quads.recovery;
        const fortnight = bodyState([squats('2026-09-10T18:00')], NOW, library).muscles.quads.recovery;

        expect(threeDays).toBeGreaterThan(yesterday);
        expect(threeDays).toBeGreaterThan(0.85);
        expect(fortnight).toBe(1);
    });

    it('fait récupérer un petit muscle plus vite qu’un gros', () => {
        const session: PastSession = { date: '2026-10-01T06:00', exercises: [{ exercise: 'jump-squat', sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }] };
        const state = bodyState([session], NOW, library);

        expect(state.muscles.gastrocnemius.residual).toBeLessThan(state.muscles.quads.residual);
    });

    it('pèse plus une série à l’échec qu’une série facile', () => {
        const hard = bodyState([{ date: '2026-10-01', exercises: [{ exercise: 'push-up', sets: [{ reps: 20, rir: 0 }] }] }], NOW, library);
        const easy = bodyState([{ date: '2026-10-01', exercises: [{ exercise: 'push-up', sets: [{ reps: 10, rir: 4 }] }] }], NOW, library);

        expect(hard.muscles.pecs.residual).toBeGreaterThan(easy.muscles.pecs.residual * 1.5);
    });

    it('compte les séries dures de la semaine par groupe, une demi-série pour un groupe qui aide', () => {
        const state = bodyState(
            [squats('2026-09-30', 3), { date: '2026-10-01', exercises: [{ exercise: 'inverted-row-table', sets: [{ reps: 10 }, { reps: 10 }] }] }],
            NOW,
            library,
        );

        expect(state.groups.legs.weeklySets).toBe(3);
        expect(state.groups.glutes.weeklySets).toBe(3);
        expect(state.groups.back.weeklySets).toBe(2);
        expect(state.groups.arms.weeklySets).toBe(1);
        expect(bodyState([squats('2026-09-20', 3)], NOW, library).groups.legs.weeklySets).toBe(0);
    });

    it('voit les cuisses fatiguées après une sortie vélo', () => {
        const state = bodyState([{ date: '2026-10-01T10:00', activities: [{ type: 'bike', minutes: 90, intensity: 'hard' }] }], NOW, library);

        expect(state.groups.legs.recovery).toBeLessThan(0.75);
        expect(state.groups.chest.recovery).toBe(1);
        expect(state.groups.legs.weeklySets).toBe(0);
    });

    it('tient compte d’une activité libre dont on ne connaît que les zones', () => {
        const state = bodyState([{ date: '2026-10-01T18:00', minutes: 60, worked: ['back', 'arms'] }], NOW, library);

        expect(state.groups.back.recovery).toBeLessThan(1);
        expect(state.groups.legs.recovery).toBe(1);
    });

    it('signale les exercices que la bibliothèque ne connaît pas, sans planter', () => {
        const state = bodyState([{ date: '2026-10-01', exercises: [{ exercise: 'tractions-maison', sets: [{ reps: 5 }] }] }], NOW, library);

        expect(state.unknownExercises).toEqual(['tractions-maison']);
    });

    it('prend en compte les courbatures déclarées', () => {
        const state = bodyState([], NOW, library, { sore: [{ target: 'calves', level: 3 }] });

        expect(state.muscles.soleus.recovery).toBe(0.25);
        expect(state.muscles.quads.recovery).toBe(1);
        expect(sorenessByMuscle({ soreness: 5 }).pecs).toBe(2);
        expect(sorenessByMuscle({ soreness: 3 })).toEqual({});
    });

    it('n’est pas fatigué par des étirements', () => {
        expect(activityLoad('yoga', 60).quads).toBeLessThan(0.5);
        expect(activityLoad('bike', 60, 'easy').quads).toBeCloseTo(2.16, 5);
    });
});

describe('la progression', () => {
    const history: PastSession[] = [
        { date: '2026-09-20', exercises: [{ exercise: 'push-up', sets: [{ reps: 8 }, { reps: 7 }] }] },
        { date: '2026-09-27', exercises: [{ exercise: 'push-up', sets: [{ reps: 10, loadKg: 5 }, { reps: 9, rir: 1 }] }] },
        { date: '2026-09-28', exercises: [{ exercise: 'archer-push-up', sets: [{ reps: 2 }] }] },
        { date: '2026-09-29', exercises: [{ exercise: 'plank', sets: [{ seconds: 45 }, { seconds: 40 }] }] },
        { date: '2026-05-01', exercises: [{ exercise: 'jump-squat', sets: [{ reps: 20 }] }] },
    ];

    it('retrouve les performances d’un exercice, la plus récente d’abord', () => {
        const done = performancesOf(history, library.get('push-up'), NOW);

        expect(done.map((entry) => entry.total)).toEqual([19, 15]);
        expect(done[0]?.best).toBe(10);
        expect(done[0]?.loadKg).toBe(5);
        expect(done[0]?.minRir).toBe(1);
    });

    it('compte en secondes ce qui se tient', () => {
        expect(performancesOf(history, library.get('plank'), NOW)[0]?.best).toBe(45);
    });

    it('juge réussie une série au bas de la fourchette de la fiche', () => {
        const archer = performancesOf(history, library.get('archer-push-up'), NOW)[0]!;

        expect(succeeded(archer, library.get('archer-push-up'))).toBe(false);
    });

    it('retient la variante la plus dure réussie par famille, sur 90 jours', () => {
        const known = capacity(history, NOW, library);

        expect(known.families['push-up']).toBe(3);
        expect(known.families.plank).toBe(3);
        expect(known.families.squat).toBeUndefined();
        expect(known.patterns['horizontal-push']).toBe(3);
        expect(known.level).toBe('intermediate');
    });

    it('ne déduit pas de niveau sans renforcement réussi', () => {
        expect(capacity([], NOW, library).level).toBeUndefined();
        expect(levelFor(2)).toBe('beginner');
        expect(levelFor(5)).toBe('advanced');
        expect(levelFor(8)).toBe('expert');
    });
});
