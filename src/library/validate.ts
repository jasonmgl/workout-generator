/**
 * Les règles qu'une fiche doit respecter. Le catalogue intégré est vérifié
 * par les tests ; un projet qui ajoute ses propres exercices peut passer les
 * siens par `validateCatalog` avant de les donner au moteur.
 */
import { isJoint, isMuscle, type MuscleId } from './anatomy';
import { isEquipment, LOADABLE_EQUIPMENT, type EquipmentId } from './equipment';
import { normalize } from '../i18n/format';
import { EXERCISE_KINDS, MOVEMENT_PATTERNS, type ExerciseDefinition, type ExerciseText } from './types';

export interface CatalogProblem {
    readonly id: string;
    readonly message: string;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEASURES = ['reps', 'time', 'distance'];
const IMPACTS = ['none', 'low', 'high'];
const POSTURES = ['standing', 'floor', 'kneeling', 'seated', 'hanging', 'support'];
const SPACES = ['spot', 'mat', 'room', 'outdoor'];
const RANGE_CEILING = { reps: 200, time: 3600, distance: 50_000 } as const;

const filled = (list: readonly string[] | undefined): boolean => Array.isArray(list) && list.length > 0 && list.every((line) => line.trim() !== '');

function checkDefinition(definition: ExerciseDefinition, known: ReadonlySet<string>): string[] {
    const problems: string[] = [];
    const say = (message: string): void => {
        problems.push(message);
    };

    if (!KEBAB.test(definition.id)) say('identifiant hors format (minuscules et tirets)');
    if (!EXERCISE_KINDS.includes(definition.kind)) say(`sorte inconnue « ${definition.kind} »`);
    if (!MOVEMENT_PATTERNS.includes(definition.pattern)) say(`schéma inconnu « ${definition.pattern} »`);
    if (!KEBAB.test(definition.family ?? '')) say('famille absente ou hors format');
    if (!Number.isInteger(definition.difficulty) || definition.difficulty < 1 || definition.difficulty > 10) say('difficulté hors de 1 à 10');
    if (!MEASURES.includes(definition.measure)) say(`mesure inconnue « ${definition.measure} »`);
    if (!IMPACTS.includes(definition.impact)) say(`impact inconnu « ${definition.impact} »`);
    if (!POSTURES.includes(definition.posture)) say(`position inconnue « ${definition.posture} »`);
    if (!SPACES.includes(definition.space)) say(`place inconnue « ${definition.space} »`);
    if (typeof definition.compound !== 'boolean') say('« compound » doit être vrai ou faux');

    const roles: [string, readonly MuscleId[] | undefined][] = [
        ['primary', definition.muscles?.primary],
        ['secondary', definition.muscles?.secondary],
        ['stabilizers', definition.muscles?.stabilizers],
    ];
    const seen = new Set<string>();

    if (!definition.muscles?.primary?.length) say('aucun muscle principal');

    for (const [role, muscles] of roles) {
        for (const muscle of muscles ?? []) {
            if (!isMuscle(muscle)) say(`muscle inconnu « ${muscle} » (${role})`);
            if (seen.has(muscle)) say(`muscle « ${muscle} » cité deux fois`);
            seen.add(muscle);
        }
    }

    for (const group of definition.equipment ?? []) {
        if (group.length === 0) say('groupe de matériel vide');

        for (const id of group) {
            if (!isEquipment(id)) say(`matériel inconnu « ${id} »`);
        }
    }

    for (const id of definition.loadableWith ?? []) {
        if (!LOADABLE_EQUIPMENT.includes(id)) say(`« ${id} » ne sert pas à charger un exercice`);
    }

    for (const [joint, stress] of Object.entries(definition.joints ?? {})) {
        if (!isJoint(joint)) say(`articulation inconnue « ${joint} »`);
        if (stress !== 1 && stress !== 2 && stress !== 3) say(`contrainte « ${stress} » hors de 1 à 3 (${joint})`);
    }

    if (!(definition.met >= 1 && definition.met <= 20)) say('dépense (met) hors de 1 à 20');

    if (definition.measure === 'reps') {
        if (!(typeof definition.secondsPerRep === 'number' && definition.secondsPerRep >= 0.5 && definition.secondsPerRep <= 15)) {
            say('temps par répétition absent ou hors de 0,5 à 15 s');
        }
    }

    const [low, high] = definition.range ?? [];
    const ceiling = RANGE_CEILING[definition.measure] ?? 0;

    if (!(typeof low === 'number' && typeof high === 'number' && low > 0 && low <= high && high <= ceiling)) {
        say(`fourchette « ${definition.range} » invalide pour la mesure ${definition.measure}`);
    }

    for (const pattern of definition.warmupFor ?? []) {
        if (!MOVEMENT_PATTERNS.includes(pattern)) say(`schéma inconnu dans warmupFor « ${pattern} »`);
    }

    for (const link of [...(definition.easier ?? []), ...(definition.harder ?? [])]) {
        if (link === definition.id) say('se cite lui-même comme progression');
        else if (!known.has(link)) say(`progression vers un exercice inconnu « ${link} »`);
    }

    for (const tag of definition.tags ?? []) {
        if (!KEBAB.test(tag)) say(`mot-clé hors format « ${tag} »`);
    }

    if ((definition.kind === 'stretch') !== (definition.pattern === 'stretch')) say('un étirement a la sorte et le schéma « stretch », et eux seuls');
    if ((definition.kind === 'breathing') !== (definition.pattern === 'breathing')) say('une respiration a la sorte et le schéma « breathing », et elles seules');
    if (definition.kind === 'stretch' && definition.measure !== 'time') say('un étirement se tient en secondes');
    if (definition.impact === 'high' && !['power', 'conditioning', 'skill'].includes(definition.kind)) say('un impact fort est réservé à l’explosivité, au cardio et aux figures');

    return problems;
}

function checkText(text: ExerciseText | undefined, definition?: ExerciseDefinition): string[] {
    if (!text) {
        return ['texte absent'];
    }

    const problems: string[] = [];

    if (!text.name?.trim()) problems.push('nom absent');
    if (text.name && text.name.length > 60) problems.push('nom de plus de 60 caractères');
    if (!text.summary?.trim()) problems.push('résumé absent');
    if (!filled(text.setup)) problems.push('mise en place absente');
    if (!filled(text.steps)) problems.push('déroulé absent');
    if (!filled(text.cues)) problems.push('repères absents');
    if (!filled(text.mistakes)) problems.push('erreurs fréquentes absentes');

    for (const [piece, name] of Object.entries(text.nameWith ?? {})) {
        if (!(definition?.equipment ?? []).some((group) => group.includes(piece as EquipmentId))) problems.push(`nom pour « ${piece} », qui n’est pas dans son matériel`);
        if (!name?.trim()) problems.push(`nom vide pour « ${piece} »`);
    }

    return problems;
}

/**
 * Les problèmes d'un catalogue : structure, texte, liens de progression,
 * doublons d'identifiant ou de nom. Une liste vide : tout va bien.
 *
 * `others` sont des identifiants connus ailleurs (le catalogue intégré, quand
 * on vérifie des ajouts) : un lien vers eux n'est pas cassé.
 */
export function validateCatalog(
    definitions: readonly ExerciseDefinition[],
    texts: Readonly<Record<string, ExerciseText>>,
    others: readonly string[] = [],
): CatalogProblem[] {
    const problems: CatalogProblem[] = [];
    const known = new Set([...others, ...definitions.map((definition) => definition.id)]);
    const ids = new Set<string>();
    const names = new Map<string, string>();

    for (const definition of definitions) {
        if (ids.has(definition.id)) {
            problems.push({ id: definition.id, message: 'identifiant en double' });
        }

        ids.add(definition.id);

        for (const message of [...checkDefinition(definition, known), ...checkText(texts[definition.id], definition)]) {
            problems.push({ id: definition.id, message });
        }

        const name = texts[definition.id]?.name;

        if (name) {
            const key = normalize(name);
            const owner = names.get(key);

            if (owner && owner !== definition.id) {
                problems.push({ id: definition.id, message: `même nom que « ${owner} »` });
            }

            names.set(key, definition.id);
        }
    }

    for (const id of Object.keys(texts)) {
        if (!ids.has(id)) {
            problems.push({ id, message: 'texte sans fiche' });
        }
    }

    return problems;
}
