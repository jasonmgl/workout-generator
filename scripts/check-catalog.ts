// Vérifier un fichier du catalogue, seul : `npx vite-node scripts/check-catalog.ts core`.
//
// Il lit la structure (`src/library/exercises/<nom>.ts`) et le texte français
// (`src/i18n/fr/exercises/<nom>.ts`), passe les fiches par `validateCatalog`,
// puis affiche les problèmes et quelques chiffres pour juger l'équilibre du
// fichier (sortes, difficultés, matériel). Les liens vers les exercices
// repères des autres fichiers (`ANCHORS`) ne comptent pas comme cassés.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ANCHORS } from '../src/library/exercises/anchors';
import { validateCatalog } from '../src/library/validate';
import type { ExerciseDefinition, ExerciseText } from '../src/library/types';

const name = process.argv[2];

if (!name) {
    console.error('Usage : npx vite-node scripts/check-catalog.ts <nom du fichier, sans .ts>');
    process.exit(2);
}

const load = async (path: string): Promise<Record<string, unknown>> => import(pathToFileURL(resolve(path)).href);
const structure = await load(`src/library/exercises/${name}.ts`);
const french = await load(`src/i18n/fr/exercises/${name}.ts`);
const definitions = Object.values(structure).find(Array.isArray) as ExerciseDefinition[] | undefined;
const texts = Object.values(french).find((value) => typeof value === 'object' && value !== null && !Array.isArray(value)) as
    | Record<string, ExerciseText>
    | undefined;

if (!definitions || !texts) {
    console.error('Il faut un tableau exporté dans la structure et un objet exporté dans le texte.');
    process.exit(2);
}

const problems = validateCatalog(definitions, texts, Object.keys(ANCHORS));
const count = <T extends string>(values: T[]): string =>
    Object.entries(values.reduce<Record<string, number>>((tally, value) => ({ ...tally, [value]: (tally[value] ?? 0) + 1 }), {}))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([value, n]) => `${value} ${n}`)
        .join(', ');

console.log(`${definitions.length} fiches dans « ${name} ».`);
console.log(`Sortes : ${count(definitions.map((definition) => definition.kind))}`);
console.log(`Difficultés : ${count(definitions.map((definition) => String(definition.difficulty).padStart(2, '0')))}`);
console.log(`Matériel : ${count(definitions.flatMap((definition) => (definition.equipment ?? []).map((group) => group.join('|'))))}`);
console.log(`Sans matériel : ${definitions.filter((definition) => !definition.equipment?.length).length}`);

const missingAnchors = Object.entries(ANCHORS)
    .filter(([, owner]) => owner === name)
    .map(([id]) => id)
    .filter((id) => !definitions.some((definition) => definition.id === id));

if (missingAnchors.length) {
    console.log(`\nRepères attendus dans ce fichier et absents : ${missingAnchors.join(', ')}`);
}

if (problems.length === 0 && missingAnchors.length === 0) {
    console.log('\nAucun problème.');
} else {
    console.log(`\n${problems.length} problème(s) :`);

    for (const problem of problems) {
        console.log(`  · ${problem.id} : ${problem.message}`);
    }

    process.exit(1);
}
