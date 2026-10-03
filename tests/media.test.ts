// Les photos des fiches : chacune vient d'une correspondance vérifiée avec free-exercise-db (domaine public), se
// sert depuis GitHub par défaut, ou depuis l'adresse que l'application choisit.
import { describe, expect, it } from 'vitest';
import { CATALOG, createLibrary, defaultLibrary, MEDIA, MEDIA_BASE } from '../src/library';
import { generateSession } from '../src/session/generate';

const library = defaultLibrary();
const ids = new Set(CATALOG.map((definition) => definition.id));

describe('les photos des fiches', () => {
    it('ne concernent que des fiches du catalogue', () => {
        for (const id of Object.keys(MEDIA)) {
            expect(ids.has(id), id).toBe(true);
        }
    });

    it('ont chacune au moins une photo, un chemin relatif propre et une correspondance qualifiée', () => {
        for (const [id, entry] of Object.entries(MEDIA)) {
            expect(entry.images.length, id).toBeGreaterThan(0);
            expect(['exact', 'close'], id).toContain(entry.match);

            for (const path of entry.images) {
                expect(path, id).toMatch(/^[\w().'-]+\/\d+\.(jpg|jpeg|png|gif)$/i);
            }
        }
    });

    it('couvrent une bonne part du catalogue', () => {
        expect(Object.keys(MEDIA).length).toBeGreaterThanOrEqual(120);
    });

    it('se servent depuis GitHub par défaut', () => {
        const [id] = Object.keys(MEDIA);
        const media = library.media(id!)!;

        expect(media.images[0]).toMatch(new RegExp(`^${MEDIA_BASE.replace(/[.]/g, '\\.')}`));
        expect(library.exercise(id!).media?.images).toEqual(media.images);
    });

    it('se servent depuis l’adresse choisie par l’application', () => {
        const [id] = Object.keys(MEDIA);
        const own = createLibrary({ mediaBase: 'https://didit.example/photos/' });

        expect(own.media(id!)!.images[0]).toMatch(/^https:\/\/didit\.example\/photos\//);
    });

    it('accompagnent les exercices d’une séance', () => {
        const session = generateSession({ date: '2026-10-03T18:00', equipment: [{ id: 'dumbbells', loads: [6, 10, 14] }, 'bench'], request: { minutes: 45 } });
        const items = session.blocks.flatMap((block) => block.items);

        for (const item of items) {
            if (MEDIA[item.exercise]) expect(item.images?.length, item.exercise).toBeGreaterThan(0);
            else expect(item.images, item.exercise).toBeUndefined();
        }

        expect(items.some((item) => item.images?.length)).toBe(true);
    });

    it('manquent plutôt que d’être fausses : aucune fiche sans photo n’en reçoit une', () => {
        const without = CATALOG.filter((definition) => !MEDIA[definition.id]).slice(0, 20);

        for (const definition of without) {
            expect(library.media(definition.id)).toBeUndefined();
        }
    });
});
