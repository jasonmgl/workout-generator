// Les dates : le moteur ne lit jamais l'horloge, il calcule sur les textes
// ISO qu'on lui donne. Un jour sans heure est pris à midi.
import { describe, expect, it } from 'vitest';
import { addDays, dayOf, daysBetween, fromDayNumber, hoursBetween, mondayOf, toDayNumber, toHours, weekdayOf } from '../src/dates';

describe('les dates', () => {
    it('prend un jour sans heure à midi', () => {
        expect(hoursBetween('2026-10-02', '2026-10-02T18:00')).toBe(6);
    });

    it('lit les heures, les minutes et les secondes', () => {
        expect(hoursBetween('2026-10-02T08:00', '2026-10-02T09:30:36')).toBeCloseTo(1.51, 5);
    });

    it('compte les heures d’un jour à l’autre', () => {
        expect(hoursBetween('2026-10-01T18:00', '2026-10-02T08:00')).toBe(14);
        expect(hoursBetween('2026-10-03', '2026-10-01')).toBe(-48);
    });

    it('compte les jours au calendrier : hier soir à ce matin, c’est un jour', () => {
        expect(daysBetween('2026-10-01T23:00', '2026-10-02T07:00')).toBe(1);
        expect(daysBetween('2026-10-02T07:00', '2026-10-02T23:00')).toBe(0);
    });

    it('passe les fins de mois et d’année', () => {
        expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('fait l’aller-retour entre un jour et son numéro', () => {
        for (const day of ['1970-01-01', '2026-10-02', '2000-02-29', '2031-12-31']) {
            expect(fromDayNumber(toDayNumber(day))).toBe(day);
        }
    });

    it('donne le jour seul d’un instant', () => {
        expect(dayOf('2026-10-02T23:59:59Z')).toBe('2026-10-02');
    });

    it('sait quel jour de la semaine on est, du lundi (1) au dimanche (7)', () => {
        expect(weekdayOf('2026-10-02')).toBe(5);
        expect(weekdayOf('2026-10-04')).toBe(7);
        expect(weekdayOf('2026-10-05')).toBe(1);
        expect(weekdayOf('1970-01-01')).toBe(4);
    });

    it('retrouve le lundi de la semaine', () => {
        expect(mondayOf('2026-10-02')).toBe('2026-09-28');
        expect(mondayOf('2026-10-05')).toBe('2026-10-05');
        expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    });

    it('refuse un texte qui n’est pas une date', () => {
        expect(() => toHours('demain')).toThrow(/illisible/);
        expect(() => toHours('02/10/2026')).toThrow(/illisible/);
    });
});
