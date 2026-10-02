// Le catalogue intégré, en entier : chaque fiche respecte ses règles, rien
// ne se répète d'un fichier à l'autre, les repères promis sont là, et il y a
// de quoi faire une séance avec à peu près n'importe quel matériel — y
// compris rien du tout.
import { describe, expect, it } from 'vitest';
import { ANCHORS, CATALOG, CATALOG_BY_FILE, CATALOG_FILES, CATALOG_TEXTS, defaultLibrary, validateCatalog } from '../src/library';
import { MUSCLE_GROUPS, MUSCLE_INFO, MUSCLES } from '../src/library/anatomy';
import { inventory } from '../src/library/equipment';
import type { MovementPattern } from '../src/library/types';

const library = defaultLibrary();
const french = CATALOG_TEXTS.fr!;
const nothing = inventory([]);

describe('le catalogue intégré', () => {
    it('est une bibliothèque importante', () => {
        expect(CATALOG.length).toBeGreaterThanOrEqual(400);
    });

    it('n’a aucun problème de structure ni de texte', () => {
        expect(validateCatalog(CATALOG, french)).toEqual([]);
    });

    it('a onze fichiers, tous remplis', () => {
        expect(Object.keys(CATALOG_BY_FILE)).toEqual([...CATALOG_FILES]);

        for (const file of CATALOG_FILES) {
            expect(CATALOG_BY_FILE[file]!.length, file).toBeGreaterThanOrEqual(25);
        }
    });

    it('tient chaque repère promis, dans le fichier promis', () => {
        for (const [id, file] of Object.entries(ANCHORS)) {
            expect(CATALOG_BY_FILE[file]!.some((definition) => definition.id === id), `${id} dans ${file}`).toBe(true);
        }
    });

    it('fait travailler chaque muscle en principal dans au moins deux exercices', () => {
        for (const muscle of MUSCLES) {
            const count = CATALOG.filter((definition) => definition.kind === 'strength' && definition.muscles.primary.includes(muscle)).length;

            expect(count, muscle).toBeGreaterThanOrEqual(2);
        }
    });

    it('a de quoi étirer chaque groupe', () => {
        for (const group of MUSCLE_GROUPS) {
            const stretches = CATALOG.filter(
                (definition) => definition.kind === 'stretch' && definition.muscles.primary.some((muscle) => MUSCLE_INFO[muscle].group === group),
            );

            expect(stretches.length, group).toBeGreaterThanOrEqual(1);
        }
    });

    it('permet une séance complète sans aucun matériel', () => {
        const patterns: MovementPattern[] = [
            'squat',
            'lunge',
            'hinge',
            'horizontal-push',
            'vertical-push',
            'scapular',
            'trunk-extension',
            'anti-extension',
            'anti-lateral-flexion',
            'trunk-flexion',
            'calf-raise',
        ];

        for (const pattern of patterns) {
            expect(library.filter({ patterns: [pattern], equipment: nothing }).length, pattern).toBeGreaterThanOrEqual(2);
        }

        expect(library.filter({ kinds: ['mobility'], equipment: nothing }).length).toBeGreaterThanOrEqual(20);
        expect(library.filter({ kinds: ['stretch'], equipment: nothing }).length).toBeGreaterThanOrEqual(20);
        expect(library.filter({ kinds: ['conditioning'], equipment: nothing, maxImpact: 'low' }).length).toBeGreaterThanOrEqual(4);
        expect(library.filter({ kinds: ['breathing'], equipment: nothing }).length).toBeGreaterThanOrEqual(2);
    });

    it('a des exercices pour échauffer chaque grand schéma', () => {
        for (const pattern of ['squat', 'hinge', 'horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull', 'lunge'] as const) {
            const warmers = CATALOG.filter((definition) => definition.kind === 'mobility' && definition.warmupFor?.includes(pattern));

            expect(warmers.length, pattern).toBeGreaterThanOrEqual(2);
        }
    });

    it('a de quoi faire monter le pouls sans sauter, pour l’échauffement', () => {
        const gentle = library.filter({ kinds: ['conditioning'], maxImpact: 'low', maxDifficulty: 3, equipment: nothing }).filter((definition) => definition.warmupFor?.length);

        expect(gentle.length).toBeGreaterThanOrEqual(2);
    });

    it('ordonne chaque famille sans trou de plus de quatre marches', () => {
        for (const family of library.families()) {
            const steps = library.family(family).map((definition) => definition.difficulty);

            for (let index = 1; index < steps.length; index++) {
                expect(steps[index]! - steps[index - 1]!, `${family} : ${steps.join(', ')}`).toBeLessThanOrEqual(4);
            }
        }
    });

    it('relie chaque progression écrite dans le bon sens', () => {
        for (const definition of CATALOG) {
            for (const id of definition.easier ?? []) {
                expect(library.get(id).difficulty, `${definition.id} → plus facile ${id}`).toBeLessThanOrEqual(definition.difficulty);
            }

            for (const id of definition.harder ?? []) {
                expect(library.get(id).difficulty, `${definition.id} → plus dur ${id}`).toBeGreaterThanOrEqual(definition.difficulty);
            }
        }
    });

    it('ne demande jamais le sol ni le tapis : ce ne sont pas des besoins', () => {
        for (const definition of CATALOG) {
            for (const group of definition.equipment ?? []) {
                expect(group, definition.id).not.toContain('floor');
                expect(group, definition.id).not.toContain('mat');
            }
        }
    });

    it('écrit ses textes à l’infinitif, avec l’apostrophe typographique, sans tutoiement ni vouvoiement', () => {
        // Des bornes de mot qui connaissent les lettres accentuées : « tête » ne contient pas le pronom « te ».
        const familiar = /(?<![\p{L}’'])(tu|te|toi|ton|ta|tes|vous|votre|vos)(?![\p{L}’'])/iu;

        for (const [id, text] of Object.entries(french)) {
            const lines = [text.summary, ...text.setup, ...text.steps, ...text.cues, ...text.mistakes, text.breathing ?? '', text.safety ?? ''];

            for (const line of lines) {
                expect(line, `${id} : ${line}`).not.toMatch(familiar);
                expect(line, `${id} : ${line}`).not.toMatch(/'/);
            }

            expect(text.name, id).not.toMatch(/'/);
        }
    });

    it('ne reprend rien de la méthode Lafay', () => {
        const all = JSON.stringify(french).toLowerCase();

        expect(all).not.toMatch(/lafay/);
        expect(all).not.toMatch(/100 pompes|50 tractions|cent pompes|cinquante tractions/);
    });
});

describe('la correspondance avec DidIt', () => {
    // Les noms des exercices de la bibliothèque de DidIt et des mouvements de sa séance du jour.
    const DIDIT: Readonly<Record<string, string>> = {
        Pompes: 'push-up',
        'Pompes sur les genoux': 'knee-push-up',
        'Pompes inclinées, mains surélevées': 'incline-push-up',
        'Pompes pieds surélevés': 'decline-push-up',
        'Pompes serrées': 'close-grip-push-up',
        'Pompes piquées': 'pike-push-up',
        'Dips entre deux appuis': 'chair-dip',
        'Dips entre deux chaises': 'chair-dip',
        'Dips aux barres parallèles': 'parallel-bar-dip',
        'Rowing australien': 'inverted-row-bar',
        'Tractions horizontales sous une table': 'inverted-row-table',
        'Tractions horizontales sous une barre basse': 'inverted-row-bar',
        'Tirage à l’élastique': 'band-row',
        Tractions: 'pull-up',
        'Tractions aidées à l’élastique': 'band-assisted-pull-up',
        Squats: 'air-squat',
        'Fentes alternées': 'alternating-lunge',
        'Squat bulgare, pied arrière sur une chaise': 'bulgarian-split-squat',
        'Chaise au mur': 'wall-sit',
        'Extensions mollets': 'calf-raise',
        'Gainage planche': 'plank',
        'Relevés de jambes': 'lying-leg-raise',
        'Relevés de jambes au sol': 'lying-leg-raise',
        'Relevés de jambes suspendu': 'hanging-leg-raise',
        'Extensions lombaires à plat ventre': 'superman',
        Burpees: 'burpee',
        'Corde à sauter': 'jump-rope',
        'Course à pied': 'easy-run',
        'Squats sautés': 'jump-squat',
    };

    it('retrouve chaque nom de DidIt dans le catalogue', () => {
        for (const [name, id] of Object.entries(DIDIT)) {
            expect(library.findByName(name)?.id, name).toBe(id);
        }
    });

    it('retrouve aussi un nom écrit avec une apostrophe droite', () => {
        expect(library.findByName("Tirage à l'élastique")?.id).toBe('band-row');
    });
});
