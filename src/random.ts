/**
 * Un hasard qui se rejoue : même graine, même séance.
 *
 * Une séance tirée avec `Math.random` changerait à chaque rechargement de la
 * page : impossible à tester, à retrouver, ou à partager avec un ami. Ici la
 * graine est une entrée comme une autre, et la séance numéro 42 du 3 octobre
 * est toujours la même.
 *
 * L'algorithme est mulberry32, le même que celui de didit-engine : quatre
 * lignes, une période de 2³², bien assez pour choisir des exercices.
 */
export class Random {
    private state: number;

    constructor(seed: number) {
        this.state = Math.floor(seed) >>> 0;
    }

    /** Un nombre entre 0 (compris) et 1 (exclu). */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;

        let mixed = this.state;

        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    }

    /** Un nombre entre `low` (compris) et `high` (exclu). */
    between(low: number, high: number): number {
        return low + (high - low) * this.next();
    }

    /** Un entier entre `low` et `high`, tous deux compris. */
    integer(low: number, high: number): number {
        return Math.floor(this.between(low, high + 1));
    }

    /** Un élément d'une liste non vide. */
    pick<T>(items: readonly T[]): T {
        return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]!;
    }

    /**
     * Un élément tiré selon son poids : un poids double, deux fois plus de
     * chances. Les poids nuls ou négatifs ne sortent jamais, sauf si tous le
     * sont (on prend alors le premier).
     */
    weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
        const weights = items.map((item) => Math.max(0, weightOf(item)));
        const total = weights.reduce((sum, weight) => sum + weight, 0);

        if (total <= 0) {
            return items[0]!;
        }

        let remaining = this.next() * total;

        for (let index = 0; index < items.length; index++) {
            remaining -= weights[index]!;

            if (remaining < 0) {
                return items[index]!;
            }
        }

        return items[items.length - 1]!;
    }

    /** Une copie mélangée (Fisher-Yates), la liste d'origine reste intacte. */
    shuffle<T>(items: readonly T[]): T[] {
        const copy = [...items];

        for (let index = copy.length - 1; index > 0; index--) {
            const other = Math.floor(this.next() * (index + 1));

            [copy[index], copy[other]] = [copy[other]!, copy[index]!];
        }

        return copy;
    }
}

/**
 * Une graine tirée d'un texte (la date, un identifiant d'utilisateur…) :
 * FNV-1a sur 32 bits. Deux textes différents donnent presque toujours deux
 * graines différentes, le même texte toujours la même.
 */
export function seedFrom(...parts: readonly (string | number)[]): number {
    let hash = 0x811c9dc5;

    for (const character of parts.join('|')) {
        hash ^= character.codePointAt(0)!;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash >>> 0;
}
