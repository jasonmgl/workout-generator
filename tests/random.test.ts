// Le hasard à graine : c'est lui qui rend une séance rejouable. Même graine,
// mêmes tirages ; jamais de valeur hors des bornes demandées.
import { describe, expect, it } from 'vitest';
import { Random, seedFrom } from '../src/random';

describe('le hasard à graine', () => {
    it('rejoue la même suite pour la même graine', () => {
        const first = new Random(42);
        const second = new Random(42);

        expect(Array.from({ length: 20 }, () => first.next())).toEqual(Array.from({ length: 20 }, () => second.next()));
    });

    it('change de suite avec la graine', () => {
        expect(new Random(1).next()).not.toEqual(new Random(2).next());
    });

    it('reste entre 0 compris et 1 exclu', () => {
        const random = new Random(7);

        for (let index = 0; index < 5000; index++) {
            const value = random.next();

            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('tire des entiers bornes comprises, et les atteint toutes les deux', () => {
        const random = new Random(3);
        const seen = new Set<number>();

        for (let index = 0; index < 2000; index++) {
            const value = random.integer(2, 5);

            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(2);
            expect(value).toBeLessThanOrEqual(5);
            seen.add(value);
        }

        expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    });

    it('prend un élément de la liste', () => {
        const random = new Random(9);
        const items = ['a', 'b', 'c'];

        for (let index = 0; index < 100; index++) {
            expect(items).toContain(random.pick(items));
        }
    });

    it('respecte les poids et ne sort jamais un poids nul', () => {
        const random = new Random(11);
        const tally = { lourd: 0, leger: 0, jamais: 0 };

        for (let index = 0; index < 6000; index++) {
            const picked = random.weighted(['lourd', 'leger', 'jamais'] as const, (item) => ({ lourd: 3, leger: 1, jamais: 0 })[item]);

            tally[picked]++;
        }

        expect(tally.jamais).toBe(0);
        expect(tally.lourd / tally.leger).toBeGreaterThan(2.5);
        expect(tally.lourd / tally.leger).toBeLessThan(3.5);
    });

    it('prend le premier quand tous les poids sont nuls', () => {
        expect(new Random(1).weighted(['a', 'b'], () => 0)).toBe('a');
    });

    it('mélange sans perdre ni dupliquer, et sans toucher la liste d’origine', () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        const shuffled = new Random(5).shuffle(items);

        expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
        expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(shuffled).toEqual(new Random(5).shuffle(items));
    });
});

describe('la graine tirée d’un texte', () => {
    it('donne toujours la même graine pour le même texte', () => {
        expect(seedFrom('2026-10-02', 'jason')).toBe(seedFrom('2026-10-02', 'jason'));
    });

    it('donne des graines différentes pour des textes différents', () => {
        const seeds = new Set(['2026-10-01', '2026-10-02', '2026-10-03', 'jason', 'camille'].map((text) => seedFrom(text)));

        expect(seeds.size).toBe(5);
    });

    it('donne un entier positif sur 32 bits', () => {
        const seed = seedFrom('n’importe quoi');

        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(2 ** 32);
    });
});
