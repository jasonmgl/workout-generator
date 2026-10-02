// Les phrases à trous, les durées lisibles et la recherche sans accents.
import { describe, expect, it } from 'vitest';
import { format, formatSeconds, normalize } from '../src/i18n/format';

describe('les phrases à trous', () => {
    it('remplit les valeurs', () => {
        expect(format('{sets} séries de {reps}', { sets: 3, reps: 12 })).toBe('3 séries de 12');
    });

    it('accorde au pluriel à partir de 2, comme en français', () => {
        const template = '{n} {n|série|séries}';

        expect(format(template, { n: 0 })).toBe('0 série');
        expect(format(template, { n: 1 })).toBe('1 série');
        expect(format(template, { n: 2 })).toBe('2 séries');
    });

    it('accepte une autre règle de pluriel', () => {
        expect(format('{n} {n|set|sets}', { n: 0 }, (count) => (count === 1 ? 'one' : 'other'))).toBe('0 sets');
    });

    it('laisse voir un trou plutôt que d’écrire « undefined »', () => {
        expect(format('{a} et {b}', { a: 'pompes' })).toBe('pompes et {b}');
    });
});

describe('les durées lisibles', () => {
    it('écrit les secondes, les minutes et les heures', () => {
        expect(formatSeconds(45)).toBe('45 s');
        expect(formatSeconds(120)).toBe('2 min');
        expect(formatSeconds(90)).toBe('1 min 30');
        expect(formatSeconds(3900)).toBe('1 h 05');
        expect(formatSeconds(-3)).toBe('0 s');
    });
});

describe('la recherche sans accents', () => {
    it('oublie les accents, les majuscules et la ponctuation', () => {
        expect(normalize('Pompes inclinées, mains surélevées')).toBe('pompes inclinees mains surelevees');
        expect(normalize('  Tirage à l’élastique ')).toBe('tirage a l elastique');
        expect(normalize('Squat bulgare — pied arrière')).toBe('squat bulgare pied arriere');
    });
});
