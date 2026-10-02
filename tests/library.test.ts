// La bibliothèque sur un petit catalogue fait main : filtrer, chercher,
// suivre une progression, trouver un remplaçant, ajouter ses propres fiches.
import { describe, expect, it } from 'vitest';
import { inventory } from '../src/library/equipment';
import { Library, mergeCatalogs } from '../src/library/library';
import { createLibrary } from '../src/library';
import { FIXTURE, FIXTURE_EN, FIXTURE_FR } from './fixtures/catalog';

const library = new Library(FIXTURE, { fr: FIXTURE_FR, en: FIXTURE_EN });
const ids = (list: readonly { id: string }[]): string[] => list.map((entry) => entry.id);

describe('la bibliothèque', () => {
    it('compte et rend ses fiches dans l’ordre du catalogue', () => {
        expect(library.size).toBe(FIXTURE.length);
        expect(library.ids()[0]).toBe('wall-push-up');
        expect(library.has('push-up')).toBe(true);
        expect(library.find('nope')).toBeUndefined();
    });

    it('lève une erreur sur un identifiant inconnu', () => {
        expect(() => library.get('pompes')).toThrow(/inconnu/);
    });

    it('donne le texte dans la langue demandée, sinon en français', () => {
        expect(library.name('push-up', 'en')).toBe('Push-ups');
        expect(library.name('air-squat', 'en')).toBe('Squats');
        expect(library.exercise('plank').text.name).toBe('Planche');
    });

    it('donne son identifiant pour nom à une fiche sans texte', () => {
        const bare = new Library(FIXTURE, {});

        expect(bare.name('push-up')).toBe('push-up');
    });
});

describe('le filtre', () => {
    it('garde ce qui se fait avec le matériel', () => {
        const home = ids(library.filter({ equipment: inventory(['table']) }));

        expect(home).toContain('inverted-row-table');
        expect(home).not.toContain('ring-row');
        expect(home).not.toContain('chair-dip');
        expect(ids(library.filter({ equipment: ['two-chairs'] }))).toContain('chair-dip');
    });

    it('vise un groupe par ses muscles principaux, ou aussi secondaires', () => {
        expect(ids(library.filter({ targets: ['back'] }))).toEqual(['inverted-row-table', 'ring-row']);
        expect(ids(library.filter({ targets: ['arms'] }))).not.toContain('inverted-row-table');
        expect(ids(library.filter({ targets: ['arms'], includeSecondary: true }))).toContain('inverted-row-table');
    });

    it('écarte les sauts quand on veut du calme', () => {
        expect(ids(library.filter({ maxImpact: 'low' }))).not.toContain('jump-squat');
        expect(ids(library.filter({ maxImpact: 'high' }))).toContain('jump-squat');
    });

    it('ménage une articulation : rien au-delà de la tolérance', () => {
        const gentle = ids(library.filter({ avoidJoints: ['wrists'] }));

        expect(gentle).toContain('knee-push-up');
        expect(gentle).not.toContain('push-up');
        expect(ids(library.filter({ avoidJoints: ['wrists'], jointTolerance: 2 }))).toContain('push-up');
    });

    it('combine les critères', () => {
        expect(ids(library.filter({ patterns: ['horizontal-push'], minDifficulty: 3, maxDifficulty: 5, exclude: ['wide-push-up'] }))).toEqual(['push-up']);
        expect(ids(library.filter({ measures: ['time'], tags: ['isometric'] }))).toEqual(['plank']);
        expect(ids(library.filter({ unilateral: true }))).toEqual(['archer-push-up']);
        expect(ids(library.filter({ kinds: ['power'] }))).toEqual(['jump-squat']);
        expect(library.filter({ excludeTags: ['isometric'] })).toHaveLength(FIXTURE.length - 1);
    });
});

describe('la recherche par nom', () => {
    it('trouve sans accents ni majuscules', () => {
        expect(ids(library.search('squats sautes'))).toEqual(['jump-squat']);
    });

    it('met le nom exact devant ceux qui le contiennent', () => {
        const found = ids(library.search('pompes'));

        expect(found[0]).toBe('push-up');
        expect(found).toEqual(expect.arrayContaining(['knee-push-up', 'archer-push-up', 'wall-push-up']));
    });

    it('cherche aussi dans les autres noms', () => {
        expect(ids(library.search('gainage'))).toEqual(['plank']);
    });

    it('accepte les mots dans le désordre', () => {
        expect(ids(library.search('table rowing'))).toEqual(['inverted-row-table']);
    });

    it('ne trouve rien pour une recherche vide', () => {
        expect(library.search('  ')).toEqual([]);
    });

    it('relie un nom d’application à une fiche, au mot près', () => {
        expect(library.findByName('Dips entre deux appuis')?.id).toBe('chair-dip');
        expect(library.findByName('tractions horizontales sous une table')?.id).toBe('inverted-row-table');
        expect(library.findByName('Pompes')?.id).toBe('push-up');
        expect(library.findByName('Pompe')).toBeUndefined();
    });
});

describe('la progression', () => {
    it('range une famille du plus facile au plus dur', () => {
        expect(ids(library.family('push-up'))).toEqual(['wall-push-up', 'knee-push-up', 'push-up', 'wide-push-up', 'archer-push-up']);
        expect(library.families()).toEqual(['dip', 'inverted-row', 'plank', 'push-up', 'squat']);
    });

    it('trouve la marche juste au-dessus et juste en dessous', () => {
        expect(ids(library.harder('knee-push-up'))).toEqual(['push-up', 'wide-push-up']);
        expect(ids(library.harder('push-up'))).toEqual(['archer-push-up']);
        expect(ids(library.easier('push-up'))).toEqual(['knee-push-up']);
        expect(library.easier('wall-push-up')).toEqual([]);
        expect(library.harder('archer-push-up')).toEqual([]);
    });

    it('suit d’abord les liens écrits dans la fiche', () => {
        expect(ids(library.easier('chair-dip'))).toEqual(['knee-push-up']);
    });
});

describe('les remplaçants', () => {
    it('propose d’abord le même geste sur les mêmes muscles', () => {
        const found = library.alternatives('push-up');

        expect(ids(found).slice(0, 3)).toEqual(['knee-push-up', 'wide-push-up', 'wall-push-up']);
        expect(ids(found)).not.toContain('push-up');
        expect(ids(found)).not.toContain('air-squat');
        expect(found.every((entry) => entry.similarity > 0 && entry.similarity <= 1)).toBe(true);
    });

    it('ne propose que ce qui se fait avec le matériel', () => {
        expect(ids(library.alternatives('ring-row', { equipment: inventory(['table']) }))).toEqual(['inverted-row-table']);
        expect(library.alternatives('ring-row', { equipment: inventory([]) })).toEqual([]);
    });

    it('reste dans la même sorte d’exercice et se limite sur demande', () => {
        expect(ids(library.alternatives('air-squat'))).not.toContain('jump-squat');
        expect(library.alternatives('push-up', { limit: 2 })).toHaveLength(2);
    });
});

describe('les fiches ajoutées', () => {
    it('remplacent celles du même identifiant et s’ajoutent aux autres', () => {
        const merged = mergeCatalogs(
            { definitions: FIXTURE, texts: { fr: FIXTURE_FR } },
            {
                definitions: [{ ...FIXTURE[2]!, difficulty: 4 }, { ...FIXTURE[2]!, id: 'my-push-up' }],
                texts: { fr: { 'my-push-up': { ...FIXTURE_FR['push-up']!, name: 'Ma pompe' } } },
            },
        );
        const mine = new Library(merged.definitions, merged.texts);

        expect(mine.size).toBe(FIXTURE.length + 1);
        expect(mine.get('push-up').difficulty).toBe(4);
        expect(mine.name('my-push-up')).toBe('Ma pompe');
        expect(mine.name('push-up')).toBe('Pompes');
    });

    it('peuvent former une bibliothèque sans le catalogue intégré', () => {
        const own = createLibrary({ exercises: FIXTURE, texts: { fr: FIXTURE_FR }, builtIn: false });

        expect(own.size).toBe(FIXTURE.length);
    });
});
