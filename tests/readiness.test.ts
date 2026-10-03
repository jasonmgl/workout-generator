// La forme du jour : les règles qui imposent le repos, la note de forme, et
// les ajustements fins. Chaque décision laisse une raison avec son code.
import { describe, expect, it } from 'vitest';
import { assessReadiness, jointsToSpare, pulseStatus } from '../src/readiness/assess';
import type { PastSession, PulseReading } from '../src/types';

const DATE = '2026-10-02T07:30';
const codes = (assessment: { reasons: readonly { code: string }[] }): string[] => assessment.reasons.map((entry) => entry.code);
const mornings = (bpm: number[], from = '2026-09-'): PulseReading[] => bpm.map((value, index) => ({ date: `${from}${String(20 + index).padStart(2, '0')}`, bpm: value }));

describe('la forme du jour', () => {
    it('suppose une journée ordinaire quand on ne sait rien', () => {
        const assessment = assessReadiness({ date: DATE });

        expect(assessment.level).toBe('normal');
        expect(assessment.volume).toBe(1);
        expect(assessment.known).toBe(false);
        expect(assessment.score).toBe(0.65);
        expect(assessment.reasons).toEqual([]);
    });

    it('donne le repos un jour de repos déclaré, ou malade', () => {
        expect(assessReadiness({ date: DATE, readiness: { restDay: true } }).level).toBe('rest');
        expect(assessReadiness({ date: DATE, restDays: ['2026-10-02'] }).level).toBe('rest');
        expect(codes(assessReadiness({ date: DATE, readiness: { ill: true, energy: 5 } }))).toContain('ill');
        expect(assessReadiness({ date: DATE, readiness: { ill: true, energy: 5 } }).level).toBe('rest');
    });

    it('lit une petite forme, une forme moyenne et une grande forme', () => {
        expect(assessReadiness({ date: DATE, readiness: { energy: 1, sleepQuality: 1, stress: 5 } }).level).toBe('recovery');
        expect(assessReadiness({ date: DATE, readiness: { energy: 2, sleepQuality: 2, stress: 3 } }).level).toBe('easy');
        expect(assessReadiness({ date: DATE, readiness: { energy: 3, sleepQuality: 4 } }).level).toBe('normal');
        expect(assessReadiness({ date: DATE, readiness: { energy: 5, sleepQuality: 5, motivation: 5, soreness: 1 } }).level).toBe('push');
    });

    it('ne pousse pas avec des courbatures, même en pleine forme', () => {
        expect(assessReadiness({ date: DATE, readiness: { energy: 5, sleepQuality: 5, soreness: 3 } }).level).not.toBe('push');
    });

    it('n’autorise rien d’intense après une nuit de moins de 5 heures', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { energy: 5, sleepHours: 4 } });

        expect(assessment.level).toBe('easy');
        expect(codes(assessment)).toContain('short-sleep');
        expect(assessment.maxImpact).toBe('low');
    });

    it('règle les facteurs selon le niveau', () => {
        const easy = assessReadiness({ date: DATE, readiness: { energy: 2, sleepQuality: 2 } });
        const push = assessReadiness({ date: DATE, readiness: { energy: 5, sleepQuality: 5 } });

        expect(easy.volume).toBeLessThan(1);
        expect(easy.intensity).toBeLessThan(1);
        expect(push.volume).toBeGreaterThan(1);
    });
});

describe('le pouls du matin', () => {
    const base = mornings([52, 54, 53, 55, 52, 53]);

    it('fait sa base sur la médiane des matins précédents, sans celui du jour', () => {
        const status = pulseStatus({ restingHeartRate: 60, heartRateHistory: [...base, { date: '2026-10-02', bpm: 99 }] }, DATE);

        expect(status.baseline).toBe(53);
        expect(status.gap).toBe(13);
    });

    it('affiche un écart qui se recalcule à partir des nombres affichés', () => {
        const status = pulseStatus({ restingHeartRate: 60, heartRateHistory: mornings([52, 53, 51, 54, 52, 53]) }, DATE);

        expect(status.baseline).toBe(53);
        expect(status.gap).toBe(Math.round(((60 - 53) / 53) * 100));
    });

    it('attend quatre matins avant d’avoir une base', () => {
        expect(pulseStatus({ restingHeartRate: 70, heartRateHistory: base.slice(0, 3) }, DATE).baseline).toBeUndefined();
        expect(assessReadiness({ date: DATE, readiness: { restingHeartRate: 70, heartRateHistory: base.slice(0, 3) } }).level).toBe('normal');
    });

    it('accepte une base calculée par l’application', () => {
        expect(pulseStatus({ restingHeartRate: 66, restingHeartRateBaseline: 60 }, DATE).gap).toBe(10);
    });

    it('donne le repos à +10 % et allège à partir de +5 %', () => {
        const high = assessReadiness({ date: DATE, readiness: { restingHeartRate: 59, heartRateHistory: base } });
        const raised = assessReadiness({ date: DATE, readiness: { restingHeartRate: 56, heartRateHistory: base } });

        expect(high.level).toBe('rest');
        expect(high.reasons.find((entry) => entry.code === 'pulse-high')?.text).toMatch(/\+11 %/);
        expect(raised.level).toBe('easy');
        expect(codes(raised)).toContain('pulse-raised');
        expect(assessReadiness({ date: DATE, readiness: { restingHeartRate: 53, heartRateHistory: base } }).level).toBe('normal');
    });

    it('attend deux matins normaux après une alerte avant de recharger', () => {
        const afterAlert = [...base, { date: '2026-10-01', bpm: 62 }];
        const twoNormal = [...base, { date: '2026-09-29', bpm: 62 }, { date: '2026-09-30', bpm: 53 }, { date: '2026-10-01', bpm: 53 }];

        expect(codes(assessReadiness({ date: DATE, readiness: { restingHeartRate: 53, heartRateHistory: afterAlert } }))).toContain('pulse-recovering');
        expect(assessReadiness({ date: DATE, readiness: { restingHeartRate: 53, heartRateHistory: afterAlert } }).level).toBe('easy');
        expect(assessReadiness({ date: DATE, readiness: { restingHeartRate: 53, heartRateHistory: twoNormal } }).level).toBe('normal');
    });
});

describe('la charge des jours passés', () => {
    const daily = (count: number, effort?: 'easy' | 'hard'): PastSession[] =>
        Array.from({ length: count }, (_, index) => ({ date: `2026-09-${String(30 - index).padStart(2, '0')}`, minutes: 30, ...(effort ? { effort } : {}) }));

    it('impose le repos après sept jours d’affilée', () => {
        const assessment = assessReadiness({ date: '2026-10-01', history: daily(7) });

        expect(assessment.level).toBe('rest');
        expect(codes(assessment)).toContain('no-rest-streak');
    });

    it('allège après une séance trop dure, et monte d’un cran après une séance facile', () => {
        expect(assessReadiness({ date: DATE, history: daily(1, 'hard') }).volume).toBe(0.85);
        expect(assessReadiness({ date: DATE, history: daily(1, 'easy') }).volume).toBe(1.05);
    });

    it('reprend une marche en dessous après une coupure', () => {
        const assessment = assessReadiness({ date: DATE, history: [{ date: '2026-09-10', minutes: 30 }] });

        expect(assessment.volume).toBe(0.8);
        expect(codes(assessment)).toContain('comeback');
    });

    it('lève le pied quand la semaine dépasse de loin l’habitude', () => {
        const habit = [3, 7, 10, 14, 17, 21, 24].map((days) => ({ date: `2026-09-${String(30 - days).padStart(2, '0')}`, minutes: 30 }));
        const spike = [...habit, ...['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-01'].map((date) => ({ date, minutes: 75, effort: 'hard' as const }))];
        const assessment = assessReadiness({ date: DATE, history: spike });

        expect(assessment.warnings.map((entry) => entry.code)).toContain('load-spike');
        expect(assessment.level).toBe('easy');
    });
});

describe('le cycle, les articulations et les courbatures', () => {
    it('adoucit les règles douloureuses et coupe les sauts', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { cycle: { phase: 'menstrual', symptoms: 2 } } });

        expect(assessment.level).toBe('easy');
        expect(assessment.maxImpact).toBe('low');
    });

    it('ne propose que de la mobilité quand les règles sont très douloureuses', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { cycle: { phase: 'menstrual', symptoms: 3 } } });

        expect(assessment.level).toBe('recovery');
        expect(assessment.maxImpact).toBe('none');
    });

    it('allège nettement une journée de douleur forte, et prévient', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { pain: [{ joint: 'shoulders', severity: 3 }] } });

        expect(assessment.level).toBe('easy');
        expect(assessment.volume).toBeLessThanOrEqual(0.55);
        expect(assessment.warnings.find((entry) => entry.code === 'joint-pain-strong')?.text).toMatch(/épaules/);
    });

    it('ne propose que de la mobilité avec un bas du dos très douloureux ou deux articulations douloureuses', () => {
        expect(assessReadiness({ date: DATE, readiness: { pain: [{ joint: 'lower-back', severity: 3 }] } }).level).toBe('recovery');
        expect(assessReadiness({ date: DATE, readiness: { pain: [{ joint: 'knees', severity: 2 }, { joint: 'wrists', severity: 2 }] } }).level).toBe('recovery');
    });

    it('dit ce qui fait la petite forme', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { energy: 1, stress: 5, sleepQuality: 1 } });

        expect(assessment.reasons[0]?.text).toMatch(/énergie basse.*stress élevé/);
    });

    it('réduit un peu le volume pendant des règles sans symptôme, et en fin de cycle', () => {
        expect(assessReadiness({ date: DATE, readiness: { cycle: { phase: 'menstrual', symptoms: 0 } } }).volume).toBe(0.9);
        expect(assessReadiness({ date: DATE, readiness: { cycle: { phase: 'luteal' } } }).volume).toBe(0.95);
    });

    it('soigne l’échauffement en milieu de cycle', () => {
        expect(assessReadiness({ date: DATE, readiness: { cycle: { phase: 'ovulation' } } }).longWarmup).toBe(true);
    });

    it('réunit les limitations durables et les douleurs du jour, la plus forte l’emportant', () => {
        expect(
            jointsToSpare({ limitations: [{ joint: 'knees', severity: 1 }] }, { pain: [{ joint: 'knees', severity: 2 }, { joint: 'wrists', severity: 1 }] }),
        ).toEqual([
            { joint: 'knees', severity: 2 },
            { joint: 'wrists', severity: 1 },
        ]);
    });

    it('coupe les sauts quand un genou fait mal', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { pain: [{ joint: 'knees', severity: 2 }] } });

        expect(assessment.maxImpact).toBe('low');
        expect(assessment.reasons.find((entry) => entry.code === 'joint-pain')?.text).toMatch(/genoux/);
    });

    it('nomme les courbatures en français', () => {
        const assessment = assessReadiness({ date: DATE, readiness: { sore: [{ target: 'legs', level: 2 }] } });

        expect(assessment.reasons.find((entry) => entry.code === 'sore')?.text).toMatch(/cuisses/);
    });

    it('refuse une cible de courbature inconnue', () => {
        expect(() => assessReadiness({ date: DATE, readiness: { sore: [{ target: 'jambes' as never, level: 2 }] } })).toThrow(/inconnue/);
    });
});
