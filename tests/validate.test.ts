// Les règles d'une fiche : chacune doit se déclencher quand on l'enfreint,
// et le petit catalogue de test doit passer sans un mot.
import { describe, expect, it } from 'vitest';
import { validateCatalog } from '../src/library/validate';
import type { ExerciseDefinition, ExerciseText } from '../src/library/types';
import { FIXTURE, FIXTURE_FR } from './fixtures/catalog';

const pushUp = FIXTURE[2]!;
const messagesFor = (definition: Partial<ExerciseDefinition> & Record<string, unknown>, text: ExerciseText | null = FIXTURE_FR['push-up']!): string[] =>
    validateCatalog([{ ...pushUp, ...definition } as ExerciseDefinition], text ? { [String(definition.id ?? pushUp.id)]: text } : {}).map(
        (problem) => problem.message,
    );

describe('la validation du catalogue', () => {
    it('laisse passer un catalogue propre', () => {
        expect(validateCatalog(FIXTURE, FIXTURE_FR)).toEqual([]);
    });

    it('refuse un identifiant hors format', () => {
        expect(messagesFor({ id: 'Push_Up' }).join()).toMatch(/identifiant hors format/);
    });

    it('refuse une difficulté hors de 1 à 10, ou à virgule', () => {
        expect(messagesFor({ difficulty: 0 }).join()).toMatch(/difficulté/);
        expect(messagesFor({ difficulty: 11 }).join()).toMatch(/difficulté/);
        expect(messagesFor({ difficulty: 3.5 }).join()).toMatch(/difficulté/);
    });

    it('refuse un muscle inconnu ou cité deux fois', () => {
        expect(messagesFor({ muscles: { primary: ['biceps', 'pectoraux' as never] } }).join()).toMatch(/muscle inconnu/);
        expect(messagesFor({ muscles: { primary: ['pecs'], secondary: ['pecs'] } }).join()).toMatch(/deux fois/);
        expect(messagesFor({ muscles: { primary: [] } }).join()).toMatch(/aucun muscle principal/);
    });

    it('refuse un matériel inconnu, un groupe vide, une charge impossible', () => {
        expect(messagesFor({ equipment: [['chaises' as never]] }).join()).toMatch(/matériel inconnu/);
        expect(messagesFor({ equipment: [[]] }).join()).toMatch(/groupe de matériel vide/);
        expect(messagesFor({ loadableWith: ['table'] }).join()).toMatch(/ne sert pas à charger/);
    });

    it('refuse une articulation inconnue ou une contrainte hors de 1 à 3', () => {
        expect(messagesFor({ joints: { poignets: 2 } as never }).join()).toMatch(/articulation inconnue/);
        expect(messagesFor({ joints: { wrists: 4 as never } }).join()).toMatch(/contrainte/);
    });

    it('exige un temps par répétition pour ce qui se compte en répétitions', () => {
        const { secondsPerRep: _ignored, ...withoutPace } = pushUp;

        expect(validateCatalog([withoutPace as ExerciseDefinition], { 'push-up': FIXTURE_FR['push-up']! }).map((problem) => problem.message).join()).toMatch(
            /temps par répétition/,
        );
    });

    it('refuse une fourchette à l’envers ou démesurée', () => {
        expect(messagesFor({ range: [20, 5] }).join()).toMatch(/fourchette/);
        expect(messagesFor({ range: [5, 500] }).join()).toMatch(/fourchette/);
    });

    it('refuse une progression vers un exercice inconnu ou vers soi', () => {
        expect(messagesFor({ harder: ['flying-push-up'] }).join()).toMatch(/exercice inconnu/);
        expect(messagesFor({ harder: ['push-up'] }).join()).toMatch(/lui-même/);
    });

    it('accepte une progression vers un exercice connu ailleurs', () => {
        expect(validateCatalog([{ ...pushUp, harder: ['decline-push-up'] }], { 'push-up': FIXTURE_FR['push-up']! }, ['decline-push-up'])).toEqual([]);
    });

    it('tient les étirements, la respiration et les sauts à leurs règles', () => {
        expect(messagesFor({ kind: 'stretch' }).join()).toMatch(/étirement/);
        expect(messagesFor({ pattern: 'breathing' }).join()).toMatch(/respiration/);
        expect(messagesFor({ impact: 'high' }).join()).toMatch(/impact fort/);
    });

    it('exige un texte complet', () => {
        expect(messagesFor({}, null).join()).toMatch(/texte absent/);
        expect(messagesFor({}, { ...FIXTURE_FR['push-up']!, steps: [] }).join()).toMatch(/déroulé absent/);
        expect(messagesFor({}, { ...FIXTURE_FR['push-up']!, mistakes: [''] }).join()).toMatch(/erreurs fréquentes/);
    });

    it('refuse un nom pour une pièce que la fiche ne demande pas', () => {
        const dip = FIXTURE.find((definition) => definition.id === 'chair-dip')!;
        const text = { ...FIXTURE_FR['chair-dip']!, nameWith: { rings: 'Dips aux anneaux', 'dip-bars': 'Dips aux barres' } };
        const problems = validateCatalog([dip], { 'chair-dip': text }, ['knee-push-up']).map((problem) => problem.message);

        expect(problems).toEqual(['nom pour « rings », qui n’est pas dans son matériel']);
    });

    it('repère les doublons d’identifiant, de nom, et les textes orphelins', () => {
        const problems = validateCatalog([pushUp, pushUp, { ...pushUp, id: 'other-push-up' }], {
            'push-up': FIXTURE_FR['push-up']!,
            'other-push-up': { ...FIXTURE_FR['push-up']!, name: 'POMPES' },
            ghost: FIXTURE_FR['push-up']!,
        }).map((problem) => `${problem.id} ${problem.message}`);

        expect(problems).toContain('push-up identifiant en double');
        expect(problems).toContain('other-push-up même nom que « push-up »');
        expect(problems).toContain('ghost texte sans fiche');
    });
});
