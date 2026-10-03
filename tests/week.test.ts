// Le plan de la semaine : le découpage selon le nombre de séances, des jours
// bien espacés, une intensité qui ondule, les sorties longues respectées, et
// la séance du jour qui suit le plan.
import { describe, expect, it } from 'vitest';
import { generateSession } from '../src/session/generate';
import { formatDay } from '../src/i18n/fr/labels';
import { planWeek, plannedDayFor, splitFor, spreadDays } from '../src/week/plan';

const MONDAY = '2026-10-05';

describe('le découpage', () => {
    it('fait corps entier jusqu’à trois séances, puis découpe', () => {
        expect(splitFor(2, 'health')).toEqual(['full-body', 'full-body']);
        expect(splitFor(3, 'strength')).toEqual(['full-body', 'full-body', 'full-body']);
        expect(splitFor(4, 'hypertrophy')).toEqual(['upper', 'lower', 'upper', 'lower']);
        expect(splitFor(6, 'hypertrophy')).toEqual(['push', 'pull', 'lower', 'push', 'pull', 'lower']);
    });

    it('glisse une séance d’intervalles pour un objectif cardio', () => {
        expect(splitFor(3, 'fat-loss')).toContain('hiit');
        expect(splitFor(4, 'endurance')).toContain('hiit');
        expect(splitFor(2, 'fat-loss')).not.toContain('hiit');
    });
});

describe('les jours', () => {
    it('espace les séances au mieux', () => {
        expect(spreadDays([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([1, 3, 5]);
        expect(spreadDays([1, 2, 3, 4, 5, 6, 7], 2)).toEqual([1, 4]);
        expect(spreadDays([1, 2, 6, 7], 2)).toEqual([2, 6]);
    });

    it('ne prévoit pas plus de séances que de jours disponibles, et le dit', () => {
        const plan = planWeek({ start: MONDAY, days: [6, 7], sessionsPerWeek: 3 });

        expect(plan.sessions).toBe(2);
        expect(plan.reasons.map((entry) => entry.code)).toContain('week-fewer-days');
        expect(plan.days.filter((day) => day.kind === 'training').map((day) => day.weekday)).toEqual([6, 7]);
    });

    it('couvre sept jours à partir du premier, même s’il n’est pas un lundi', () => {
        const plan = planWeek({ start: '2026-10-08' });

        expect(plan.days).toHaveLength(7);
        expect(plan.days[0]!.date).toBe('2026-10-08');
        expect(plan.days[0]!.weekday).toBe(4);
    });
});

describe('l’intensité et les activités', () => {
    it('fait onduler l’intensité, sans deux séances dures d’affilée', () => {
        const plan = planWeek({ start: MONDAY, sessionsPerWeek: 6, profile: { goal: 'hypertrophy', level: 'advanced' } });
        const training = plan.days.filter((day) => day.kind === 'training');

        expect(new Set(training.map((day) => day.intensity))).toEqual(new Set(['hard', 'moderate', 'easy']));

        for (let index = 1; index < plan.days.length; index++) {
            const today = plan.days[index]!;
            const yesterday = plan.days[index - 1]!;

            expect(today.kind === 'training' && yesterday.kind === 'training' && today.intensity === 'hard' && yesterday.intensity === 'hard').toBe(false);
        }
    });

    it('évite les jambes autour d’une longue sortie vélo', () => {
        const plan = planWeek({
            start: MONDAY,
            sessionsPerWeek: 4,
            profile: { goal: 'hypertrophy' },
            activities: [{ date: '2026-10-08', type: 'bike', minutes: 150, intensity: 'hard' }],
        });
        const around = plan.days.filter((day) => ['2026-10-07', '2026-10-08', '2026-10-09'].includes(day.date) && day.kind === 'training');

        expect(around.every((day) => day.type === 'upper')).toBe(true);
        expect(plan.days.find((day) => day.date === '2026-10-08')!.activities).toHaveLength(1);
    });

    it('propose un jour de mobilité facultatif à qui s’entraîne peu', () => {
        const plan = planWeek({ start: MONDAY, sessionsPerWeek: 3 });

        expect(plan.days.some((day) => day.kind === 'active-recovery' && day.optional)).toBe(true);
    });

    it('vise des séries par groupe selon l’objectif et le niveau', () => {
        const light = planWeek({ start: MONDAY, profile: { goal: 'health', level: 'beginner' } });
        const heavy = planWeek({ start: MONDAY, profile: { goal: 'hypertrophy', level: 'advanced' } });

        expect(heavy.targets.chest).toBeGreaterThan(light.targets.chest);
    });
});

describe('ce que les coachs ont demandé au plan', () => {
    it('ne fait jamais un fractionné « léger »', () => {
        for (const sessionsPerWeek of [3, 4, 5, 6]) {
            const plan = planWeek({ start: MONDAY, sessionsPerWeek, profile: { goal: 'fat-loss' } });

            for (const day of plan.days.filter((entry) => entry.type === 'hiit')) {
                expect(day.intensity, `${sessionsPerWeek} séances`).not.toBe('easy');
            }
        }
    });

    it('rend légère la séance de jambes voisine d’une sortie dure qu’on ne peut pas éviter', () => {
        const plan = planWeek({
            start: MONDAY,
            sessionsPerWeek: 3,
            days: [3, 5, 7],
            activities: [{ date: '2026-10-08', type: 'run', minutes: 90, intensity: 'hard' }],
        });
        const legs = plan.days.filter((day) => day.kind === 'training' && ['2026-10-07', '2026-10-09'].includes(day.date));

        expect(legs.every((day) => day.intensity === 'easy')).toBe(true);
        expect(plan.reasons.map((entry) => entry.code)).toContain('week-legs-activity-kept');
    });

    it('décrit les séances réellement placées, et nomme la sortie avec sa date', () => {
        const plan = planWeek({
            start: MONDAY,
            sessionsPerWeek: 4,
            profile: { goal: 'endurance' },
            activities: [{ date: '2026-10-08', type: 'bike', minutes: 150, intensity: 'hard' }],
        });
        const texts = plan.reasons.map((entry) => entry.text).join(' ');

        expect(plan.reasons[0]!.text).toMatch(/cardio fractionné/);
        expect(texts).toMatch(/Vélo jeudi 8 octobre \(2 h 30\)/);
        expect(plan.days.find((day) => day.date === '2026-10-08')!.title).toMatch(/Vélo/);
    });

    it('écrit les jours comme on les dit', () => {
        expect(formatDay('2026-09-01')).toBe('mardi 1er septembre');
        expect(formatDay('2026-10-08')).toBe('jeudi 8 octobre');
    });
});

describe('la séance du jour qui suit le plan', () => {
    it('prend le type et l’intensité prévus', () => {
        const plan = planWeek({ start: MONDAY, sessionsPerWeek: 4 });
        const day = plan.days.find((entry) => entry.kind === 'training')!;
        const planned = plannedDayFor(plan, day.date)!;
        const session = generateSession({ date: day.date, plan: planned });

        expect(session.type).toBe(day.type);
        expect(plannedDayFor(plan, '2027-01-01')).toBeUndefined();
    });

    it('fait de la mobilité un jour de récupération prévu', () => {
        const plan = planWeek({ start: MONDAY, sessionsPerWeek: 3 });
        const day = plan.days.find((entry) => entry.kind === 'active-recovery')!;

        expect(generateSession({ date: day.date, plan: plannedDayFor(plan, day.date)! }).type).toBe('mobility');
    });
});
