// La commande « JSON en entrée, JSON en sortie » : chaque commande répond,
// une erreur sort proprement, et le fichier construit dans bin/ est bien
// celui des sources d'aujourd'hui (sinon : npm run build:cli).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import type { Session } from '../src/types';
import type { WeekPlan } from '../src/week/plan';

const DATE = '2026-10-02T18:00';

describe('la commande JSON', () => {
    it('génère la séance du jour', () => {
        const session = run({ command: 'session', input: { date: DATE, request: { minutes: 20 } } }) as Session;

        expect(session.version).toBe(1);
        expect(session.blocks.length).toBeGreaterThan(1);
    });

    it('fait le plan de la semaine', () => {
        expect((run({ command: 'week', input: { start: '2026-10-05', sessionsPerWeek: 3 } }) as WeekPlan).days).toHaveLength(7);
    });

    it('rend la forme du jour et l’état des muscles', () => {
        expect(run({ command: 'readiness', input: { date: DATE, readiness: { energy: 1, sleepQuality: 1 } } })).toMatchObject({ level: 'recovery' });
        expect(run({ command: 'body', input: { date: DATE, history: [] } })).toHaveProperty('groups.legs.recovery', 1);
    });

    it('cherche dans la bibliothèque, par nom comme par critères', () => {
        expect(run({ command: 'exercise', input: { id: 'Pompes' } })).toMatchObject({ id: 'push-up', text: { name: 'Pompes' } });
        expect((run({ command: 'search', input: { text: 'tractions' } }) as { id: string }[]).length).toBeGreaterThan(3);
        expect((run({ command: 'search', input: { patterns: ['squat'], equipment: [] } }) as { id: string }[]).length).toBeGreaterThan(3);
    });

    it('propose des remplaçants et remplace un exercice', () => {
        const generate = { date: DATE, request: { minutes: 30 } };
        const session = run({ command: 'session', input: generate }) as Session;
        const block = session.blocks.find((entry) => entry.role === 'main')!;
        const options = run({ command: 'alternatives', input: { session, generate, block: block.id, index: 0 } }) as { id: string }[];
        const replaced = run({ command: 'replace', input: { session, generate, block: block.id, index: 0, exercise: options[0]!.id } }) as Session;

        expect(options.length).toBeGreaterThan(0);
        expect(replaced.blocks.find((entry) => entry.id === block.id)!.items[0]!.exercise).toBe(options[0]!.id);
    });

    it('met une séance en texte, en étapes et en arbre', () => {
        const session = run({ command: 'session', input: { date: DATE } }) as Session;

        expect(run({ command: 'text', input: session })).toContain(session.title);
        expect((run({ command: 'timeline', input: session }) as unknown[]).length).toBeGreaterThan(5);
        expect((run({ command: 'tree', input: session }) as unknown[]).length).toBe(session.blocks.length);
    });

    it('refuse une commande inconnue ou une entrée incomplète', () => {
        expect(() => run({ command: 'danse' })).toThrow(/inconnue/);
        expect(() => run({ command: 'session', input: {} })).toThrow(/date/);
    });
});

describe('le fichier construit', () => {
    it('est à jour avec les sources (sinon : npm run build:cli)', () => {
        const built = buildSync({
            entryPoints: ['src/bin.ts'],
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node18',
            legalComments: 'none',
            banner: { js: '#!/usr/bin/env node' },
            write: false,
        }).outputFiles[0]!.text;

        expect(readFileSync('bin/workout-generator.mjs', 'utf8') === built).toBe(true);
    });

    it('répond en JSON sur la sortie standard, et sort en erreur sur une commande inconnue', () => {
        const ok = JSON.parse(execFileSync('node', ['bin/workout-generator.mjs'], { input: JSON.stringify({ command: 'session', input: { date: DATE } }) }).toString());
        const failed = spawnSync('node', ['bin/workout-generator.mjs'], { input: '{"command":"danse"}' });

        expect(ok.ok).toBe(true);
        expect(ok.result.version).toBe(1);
        expect(failed.status).toBe(1);
        expect(JSON.parse(failed.stdout.toString())).toEqual({ ok: false, error: 'Commande inconnue : « danse »' });
    });
});
