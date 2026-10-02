// Le matériel : ce que la personne a, ce qui en découle, et si une fiche se
// fait avec. Un groupe de besoin se lit « l'un ou l'autre », la liste des
// groupes « et ».
import { describe, expect, it } from 'vitest';
import { ASSUMED_EQUIPMENT, EQUIPMENT, equipmentUsed, inventory, LOADABLE_EQUIPMENT, satisfies } from '../src/library/equipment';
import { EQUIPMENT_NAMES } from '../src/i18n/fr/labels';

describe('le matériel', () => {
    it('suppose le sol et un mur quand on ne sait rien', () => {
        const available = inventory();

        expect(available.ids).toEqual(['floor', 'wall']);
        expect(ASSUMED_EQUIPMENT).toEqual(['floor', 'wall']);
    });

    it('ne suppose rien quand on le demande', () => {
        expect(inventory(['pullup-bar'], []).ids).toEqual(['pullup-bar']);
    });

    it('déduit ce qui découle d’une pièce', () => {
        const available = inventory(['two-chairs', 'bench', 'dip-bars']);

        expect(available.has('chair')).toBe(true);
        expect(available.has('step')).toBe(true);
        expect(available.has('parallettes')).toBe(true);
        expect(available.has('rings')).toBe(false);
    });

    it('refuse une pièce inconnue', () => {
        expect(() => inventory(['chaises' as never])).toThrow(/inconnu/);
    });

    it('garde les charges triées, sans doublon ni valeur nulle', () => {
        const available = inventory([
            { id: 'dumbbells', loads: [12, 4, 8, 4, 0] },
            { id: 'dumbbells', loads: [10] },
        ]);

        expect(available.loadsOf('dumbbells')).toEqual([4, 8, 10, 12]);
        expect(available.loadsOf('kettlebell')).toEqual([]);
    });

    it('lit un besoin comme « tous les groupes, une pièce dans chacun »', () => {
        const home = inventory(['chair', 'dumbbells']);

        expect(satisfies(undefined, home)).toBe(true);
        expect(satisfies([], home)).toBe(true);
        expect(satisfies([['bench', 'chair']], home)).toBe(true);
        expect(satisfies([['barbell'], ['rack']], home)).toBe(false);
        expect(satisfies([['dumbbells'], ['bench', 'chair']], home)).toBe(true);
        expect(satisfies([['dumbbells'], ['bench']], home)).toBe(false);
    });

    it('dit quelle pièce servira dans chaque groupe', () => {
        expect(equipmentUsed([['bench', 'chair'], ['dumbbells', 'kettlebell']], inventory(['chair', 'kettlebell']))).toEqual(['chair', 'kettlebell']);
    });

    it('ne compte comme chargeable que du matériel connu', () => {
        for (const id of LOADABLE_EQUIPMENT) {
            expect(EQUIPMENT).toContain(id);
        }
    });

    it('nomme chaque pièce en français', () => {
        for (const id of EQUIPMENT) {
            expect(EQUIPMENT_NAMES[id].length).toBeGreaterThan(3);
        }
    });
});
