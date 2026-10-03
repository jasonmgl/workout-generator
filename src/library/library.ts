/**
 * La bibliothèque : le catalogue des exercices et de quoi l'interroger.
 *
 * On s'en sert seule (chercher un exercice, lister ce qui se fait avec deux
 * chaises, trouver la version plus facile d'une pompe) ou à travers le
 * générateur, qui ne connaît les exercices que par elle. Un projet peut y
 * ajouter les siens, ou remplacer une fiche du catalogue en reprenant son
 * identifiant.
 */
import { musclesOfAll, type BodyTarget, type JointId, type MuscleId } from './anatomy';
import { inventory as makeInventory, satisfies, type EquipmentId, type EquipmentInput, type Inventory } from './equipment';
import { normalize } from '../i18n/format';
import type { Exercise, ExerciseDefinition, ExerciseKind, ExerciseText, Impact, Measure, MovementPattern, Posture } from './types';

export type Locale = string;

export const DEFAULT_LOCALE: Locale = 'fr';

/** Les textes d'un catalogue, rangés par langue puis par identifiant. */
export type CatalogTexts = Readonly<Record<Locale, Readonly<Record<string, ExerciseText>>>>;

/** Ce qu'on cherche. Tous les critères donnés doivent être remplis. */
export interface ExerciseQuery {
    readonly kinds?: readonly ExerciseKind[];
    readonly patterns?: readonly MovementPattern[];
    readonly families?: readonly string[];
    /** Au moins un de ces muscles (ou groupes, ou régions) parmi les muscles principaux. */
    readonly targets?: readonly BodyTarget[];
    /** Compter aussi les muscles secondaires pour `targets`. */
    readonly includeSecondary?: boolean;
    /** Ne garder que ce qui se fait avec ce matériel. */
    readonly equipment?: Inventory | readonly EquipmentInput[];
    readonly minDifficulty?: number;
    readonly maxDifficulty?: number;
    readonly maxImpact?: Impact;
    readonly measures?: readonly Measure[];
    readonly postures?: readonly Posture[];
    readonly compound?: boolean;
    readonly unilateral?: boolean;
    /** Écarter ce qui charge ces articulations au-delà de `jointTolerance` (1 par défaut : on ne garde que le léger). */
    readonly avoidJoints?: readonly JointId[];
    readonly jointTolerance?: 1 | 2 | 3;
    /** Tous ces mots-clés. */
    readonly tags?: readonly string[];
    readonly excludeTags?: readonly string[];
    readonly exclude?: readonly string[];
}

/** Un remplaçant, avec ce qui le rapproche de l'original. */
export interface Alternative {
    readonly id: string;
    /** De 0 à 1 : 1, c'est le même geste sur les mêmes muscles à la même difficulté. */
    readonly similarity: number;
}

const IMPACT_ORDER: Readonly<Record<Impact, number>> = { none: 0, low: 1, high: 2 };

const isInventory = (value: Inventory | readonly EquipmentInput[]): value is Inventory => !Array.isArray(value) && 'has' in value;

/** Ce qu'on retient de deux listes de muscles : la part commune (indice de Jaccard). */
const overlap = (left: readonly MuscleId[], right: readonly MuscleId[]): number => {
    const union = new Set([...left, ...right]);

    if (union.size === 0) {
        return 0;
    }

    return left.filter((muscle) => right.includes(muscle)).length / union.size;
};

export class Library {
    private readonly byId = new Map<string, ExerciseDefinition>();
    private readonly byFamily = new Map<string, ExerciseDefinition[]>();
    private readonly texts: CatalogTexts;
    private readonly nameIndex = new Map<Locale, Map<string, string>>();

    constructor(definitions: readonly ExerciseDefinition[], texts: CatalogTexts) {
        for (const definition of definitions) {
            this.byId.set(definition.id, definition);
        }

        for (const definition of this.byId.values()) {
            const family = this.byFamily.get(definition.family) ?? [];

            family.push(definition);
            this.byFamily.set(definition.family, family);
        }

        for (const family of this.byFamily.values()) {
            family.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
        }

        this.texts = texts;
    }

    /** Le nombre de fiches. */
    get size(): number {
        return this.byId.size;
    }

    /** Toutes les fiches, dans l'ordre du catalogue. */
    all(): ExerciseDefinition[] {
        return [...this.byId.values()];
    }

    /** Les identifiants de toutes les fiches. */
    ids(): string[] {
        return [...this.byId.keys()];
    }

    has(id: string): boolean {
        return this.byId.has(id);
    }

    /** Une fiche, ou une erreur si l'identifiant est inconnu. */
    get(id: string): ExerciseDefinition {
        const definition = this.byId.get(id);

        if (!definition) {
            throw new Error(`Exercice inconnu : « ${id} »`);
        }

        return definition;
    }

    find(id: string): ExerciseDefinition | undefined {
        return this.byId.get(id);
    }

    /** Les langues dont le catalogue a des textes. */
    locales(): Locale[] {
        return Object.keys(this.texts);
    }

    /**
     * Le texte d'une fiche. Une langue sans traduction pour cette fiche
     * retombe sur le français ; une fiche sans aucun texte reçoit son
     * identifiant pour nom, plutôt que de faire planter l'écran.
     */
    text(id: string, locale: Locale = DEFAULT_LOCALE): ExerciseText {
        const text = this.texts[locale]?.[id] ?? this.texts[DEFAULT_LOCALE]?.[id];

        return text ?? { name: id, summary: '', setup: [], steps: [], cues: [], mistakes: [] };
    }

    /** Le nom d'une fiche dans une langue, adapté au matériel qui sert quand la fiche en prévoit un autre. */
    name(id: string, locale: Locale = DEFAULT_LOCALE, equipment: readonly EquipmentId[] = []): string {
        const text = this.text(id, locale);
        const used = equipment.find((piece) => text.nameWith?.[piece]);

        return used ? text.nameWith![used]! : text.name;
    }

    /** La fiche complète : structure et texte. */
    exercise(id: string, locale: Locale = DEFAULT_LOCALE): Exercise {
        return { ...this.get(id), text: this.text(id, locale) };
    }

    /** Les fiches qui remplissent tous les critères, dans l'ordre du catalogue. */
    filter(query: ExerciseQuery = {}): ExerciseDefinition[] {
        const available = query.equipment ? (isInventory(query.equipment) ? query.equipment : makeInventory(query.equipment)) : undefined;
        const targets = query.targets?.length ? new Set(musclesOfAll(query.targets)) : undefined;
        const tolerance = query.jointTolerance ?? 1;

        return this.all().filter((definition) => {
            if (query.kinds && !query.kinds.includes(definition.kind)) return false;
            if (query.patterns && !query.patterns.includes(definition.pattern)) return false;
            if (query.families && !query.families.includes(definition.family)) return false;
            if (query.exclude?.includes(definition.id)) return false;
            if (query.minDifficulty !== undefined && definition.difficulty < query.minDifficulty) return false;
            if (query.maxDifficulty !== undefined && definition.difficulty > query.maxDifficulty) return false;
            if (query.maxImpact && IMPACT_ORDER[definition.impact] > IMPACT_ORDER[query.maxImpact]) return false;
            if (query.measures && !query.measures.includes(definition.measure)) return false;
            if (query.postures && !query.postures.includes(definition.posture)) return false;
            if (query.compound !== undefined && definition.compound !== query.compound) return false;
            if (query.unilateral !== undefined && Boolean(definition.unilateral) !== query.unilateral) return false;
            if (query.tags && !query.tags.every((tag) => definition.tags?.includes(tag))) return false;
            if (query.excludeTags?.some((tag) => definition.tags?.includes(tag))) return false;
            if (available && !satisfies(definition.equipment, available)) return false;
            if (query.avoidJoints?.some((joint) => (definition.joints?.[joint] ?? 0) > tolerance)) return false;

            if (targets) {
                const worked = [...definition.muscles.primary, ...(query.includeSecondary ? (definition.muscles.secondary ?? []) : [])];

                if (!worked.some((muscle) => targets.has(muscle))) return false;
            }

            return true;
        });
    }

    /**
     * Chercher par le nom, sans tenir compte des accents ni des majuscules.
     * Les noms qui commencent par la recherche passent devant ceux qui la
     * contiennent, puis les autres noms (alias), puis les mots dans le désordre.
     */
    search(text: string, locale: Locale = DEFAULT_LOCALE): ExerciseDefinition[] {
        const wanted = normalize(text);

        if (wanted === '') {
            return [];
        }

        const words = wanted.split(' ');
        const scored: { definition: ExerciseDefinition; score: number }[] = [];

        for (const definition of this.byId.values()) {
            const entry = this.text(definition.id, locale);
            const name = normalize(entry.name);
            const aliases = (entry.aliases ?? []).map(normalize);
            let score = 0;

            if (name === wanted) score = 100;
            else if (name.startsWith(wanted)) score = 80;
            else if (aliases.includes(wanted)) score = 75;
            else if (name.includes(wanted)) score = 60;
            else if (aliases.some((alias) => alias.includes(wanted))) score = 50;
            else if (words.every((word) => name.includes(word) || aliases.some((alias) => alias.includes(word)))) score = 30;

            if (score > 0) {
                scored.push({ definition, score });
            }
        }

        return scored.sort((a, b) => b.score - a.score || a.definition.difficulty - b.definition.difficulty).map((entry) => entry.definition);
    }

    /**
     * La fiche dont le nom (ou un autre nom) est exactement celui-ci, accents
     * et majuscules mis à part. C'est ce qui relie le catalogue d'une appli
     * (« Rowing australien ») à celui du moteur.
     */
    findByName(name: string, locale: Locale = DEFAULT_LOCALE): ExerciseDefinition | undefined {
        let index = this.nameIndex.get(locale);

        if (!index) {
            index = new Map();

            for (const definition of this.byId.values()) {
                const entry = this.text(definition.id, locale);

                for (const alias of entry.aliases ?? []) {
                    index.set(normalize(alias), definition.id);
                }
            }

            for (const definition of this.byId.values()) {
                index.set(normalize(this.text(definition.id, locale).name), definition.id);
            }

            this.nameIndex.set(locale, index);
        }

        const id = index.get(normalize(name));

        return id ? this.byId.get(id) : undefined;
    }

    /** Les familles de progression, par ordre alphabétique. */
    families(): string[] {
        return [...this.byFamily.keys()].sort();
    }

    /** Une famille, du plus facile au plus dur. */
    family(family: string): ExerciseDefinition[] {
        return [...(this.byFamily.get(family) ?? [])];
    }

    /**
     * Les versions plus faciles d'un exercice : les liens écrits dans sa
     * fiche, puis, dans sa famille, celles de la marche juste en dessous.
     */
    easier(id: string): ExerciseDefinition[] {
        return this.neighbours(id, -1);
    }

    /** Les versions plus dures : les liens de la fiche, puis la marche juste au-dessus dans sa famille. */
    harder(id: string): ExerciseDefinition[] {
        return this.neighbours(id, 1);
    }

    private neighbours(id: string, direction: 1 | -1): ExerciseDefinition[] {
        const definition = this.get(id);
        const links = (direction > 0 ? definition.harder : definition.easier) ?? [];
        const linked = links.map((link) => this.byId.get(link)).filter((found): found is ExerciseDefinition => found !== undefined);
        const family = this.byFamily.get(definition.family) ?? [];
        const beyond = family.filter((other) => (other.difficulty - definition.difficulty) * direction > 0);
        const step = beyond.length ? Math.min(...beyond.map((other) => Math.abs(other.difficulty - definition.difficulty))) : 0;
        const next = beyond.filter((other) => Math.abs(other.difficulty - definition.difficulty) === step);
        const result: ExerciseDefinition[] = [];

        for (const candidate of [...linked, ...next]) {
            if (!result.includes(candidate)) {
                result.push(candidate);
            }
        }

        return result;
    }

    /**
     * Les remplaçants d'un exercice, du plus proche au plus lointain : même
     * sorte, même schéma de mouvement ou mêmes muscles principaux, difficulté
     * voisine. Avec `equipment`, seulement ce qui se fait avec.
     */
    alternatives(id: string, query: ExerciseQuery & { readonly limit?: number } = {}): Alternative[] {
        const original = this.get(id);
        const candidates = this.filter({ ...query, exclude: [...(query.exclude ?? []), id], kinds: query.kinds ?? [original.kind] });
        const scored: Alternative[] = [];

        for (const candidate of candidates) {
            const samePattern = candidate.pattern === original.pattern ? 1 : 0;
            const muscles = overlap(candidate.muscles.primary, original.muscles.primary);

            if (!samePattern && muscles === 0) {
                continue;
            }

            // Un remplaçant trois marches plus bas n'en est pas un : la
            // difficulté voisine pèse autant que le geste.
            const closeness = Math.max(0, 1 - Math.abs(candidate.difficulty - original.difficulty) / 3);
            const sameMeasure = candidate.measure === original.measure ? 1 : 0;
            const sameFamily = candidate.family === original.family ? 1 : 0;
            const similarity = 0.3 * samePattern + 0.25 * muscles + 0.35 * closeness + 0.05 * sameMeasure + 0.05 * sameFamily;

            scored.push({ id: candidate.id, similarity: Math.round(similarity * 1000) / 1000 });
        }

        scored.sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));

        return query.limit === undefined ? scored : scored.slice(0, query.limit);
    }
}

/** Fusionner des catalogues : une fiche ajoutée remplace celle du même identifiant. */
export function mergeCatalogs(
    base: { readonly definitions: readonly ExerciseDefinition[]; readonly texts: CatalogTexts },
    extra: { readonly definitions?: readonly ExerciseDefinition[]; readonly texts?: CatalogTexts },
): { definitions: ExerciseDefinition[]; texts: CatalogTexts } {
    const definitions = new Map(base.definitions.map((definition) => [definition.id, definition]));

    for (const definition of extra.definitions ?? []) {
        definitions.set(definition.id, definition);
    }

    const texts: Record<Locale, Record<string, ExerciseText>> = {};

    for (const source of [base.texts, extra.texts ?? {}]) {
        for (const [locale, entries] of Object.entries(source)) {
            texts[locale] = { ...(texts[locale] ?? {}), ...entries };
        }
    }

    return { definitions: [...definitions.values()], texts };
}
