// L'anatomie à trois étages : muscles, groupes, régions. Chaque muscle a son
// groupe, chaque groupe sa région, et un nom ne sert qu'à un seul étage.
import { describe, expect, it } from 'vitest';
import {
    GROUP_REGION,
    groupOf,
    groupsOfRegion,
    isBodyTarget,
    JOINTS,
    MUSCLE_GROUPS,
    MUSCLE_INFO,
    MUSCLES,
    musclesOf,
    musclesOfAll,
    musclesOfGroup,
    OPPOSING_GROUPS,
    REGIONS,
    regionOf,
} from '../src/library/anatomy';
import { GROUP_NAMES, JOINT_NAMES, MUSCLE_NAMES, REGION_NAMES } from '../src/i18n/fr/labels';

describe('l’anatomie', () => {
    it('donne un groupe et une taille à chaque muscle', () => {
        for (const muscle of MUSCLES) {
            expect(MUSCLE_GROUPS).toContain(MUSCLE_INFO[muscle].group);
            expect(['large', 'medium', 'small']).toContain(MUSCLE_INFO[muscle].size);
        }
    });

    it('n’a pas de groupe vide', () => {
        for (const group of MUSCLE_GROUPS) {
            expect(musclesOfGroup(group).length).toBeGreaterThan(0);
        }
    });

    it('range chaque groupe dans une région, et chaque région a ses groupes', () => {
        for (const group of MUSCLE_GROUPS) {
            expect(REGIONS).toContain(GROUP_REGION[group]);
        }

        for (const region of REGIONS) {
            expect(groupsOfRegion(region).length).toBeGreaterThan(0);
        }
    });

    it('n’emploie un nom qu’à un seul étage', () => {
        const all = [...MUSCLES, ...MUSCLE_GROUPS, ...REGIONS];

        expect(new Set(all).size).toBe(all.length);
    });

    it('retrouve les muscles d’un muscle, d’un groupe et d’une région', () => {
        expect(musclesOf('quads')).toEqual(['quads']);
        expect(musclesOf('calves')).toEqual(['gastrocnemius', 'soleus', 'tibialis']);
        expect(musclesOf('lower')).toEqual(expect.arrayContaining(['quads', 'hamstrings', 'glute-max', 'soleus']));
        expect(musclesOf('lower')).not.toContain('pecs');
    });

    it('mélange les étages sans doublon', () => {
        expect(musclesOfAll(['legs', 'quads', 'calves'])).toEqual(['quads', 'hamstrings', 'adductors', 'gastrocnemius', 'soleus', 'tibialis']);
    });

    it('couvre tout le corps avec les trois régions', () => {
        expect(musclesOfAll(REGIONS)).toEqual([...MUSCLES]);
    });

    it('refuse une cible inconnue plutôt que de viser « rien »', () => {
        expect(() => musclesOf('jambes')).toThrow(/inconnue/);
        expect(isBodyTarget('jambes')).toBe(false);
        expect(isBodyTarget('legs')).toBe(true);
    });

    it('sait la région d’un muscle comme d’un groupe', () => {
        expect(regionOf('erectors')).toBe('trunk');
        expect(regionOf('chest')).toBe('upper');
        expect(groupOf('soleus')).toBe('calves');
    });

    it('a des groupes opposés qui se répondent', () => {
        for (const [group, opposite] of Object.entries(OPPOSING_GROUPS)) {
            expect(OPPOSING_GROUPS[opposite]).toBe(group);
        }
    });

    it('nomme tout en français', () => {
        for (const muscle of MUSCLES) expect(MUSCLE_NAMES[muscle].length).toBeGreaterThan(2);
        for (const group of MUSCLE_GROUPS) expect(GROUP_NAMES[group].length).toBeGreaterThan(2);
        for (const region of REGIONS) expect(REGION_NAMES[region].length).toBeGreaterThan(2);
        for (const joint of JOINTS) expect(JOINT_NAMES[joint].length).toBeGreaterThan(2);
    });
});
