/**
 * Le matériel. Une fiche d'exercice dit ce qu'il lui faut, une personne dit
 * ce qu'elle a, et le moteur ne propose que ce qui se fait avec.
 *
 * Le corps seul n'est pas du matériel : un exercice sans besoin se fait
 * partout. Un mur et un sol, en revanche, en sont : dans un parc, on n'a pas
 * toujours de mur. `ASSUMED_EQUIPMENT` dit ce qu'on suppose quand on ne sait
 * rien (le sol et un mur), comme DidIt qui suppose « le sol » par défaut.
 */

export const EQUIPMENT = [
    // La maison
    'floor',
    'wall',
    'mat',
    'chair',
    'two-chairs',
    'table',
    'step',
    'door',
    'towel',
    'broomstick',
    'backpack',
    // Les barres et les anneaux
    'pullup-bar',
    'low-bar',
    'dip-bars',
    'parallettes',
    'rings',
    'suspension-trainer',
    // Les élastiques
    'resistance-band',
    'mini-band',
    // Les charges
    'dumbbells',
    'kettlebell',
    'barbell',
    'rack',
    'bench',
    'weight-vest',
    'medicine-ball',
    'sandbag',
    // Les petits accessoires
    'jump-rope',
    'ab-wheel',
    'swiss-ball',
    'foam-roller',
    'sliders',
    'box',
    'punching-bag',
    // Le cardio
    'bike',
    'rower',
    'treadmill',
    'outdoor',
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number];

export const ASSUMED_EQUIPMENT: readonly EquipmentId[] = ['floor', 'wall'];

/** Le matériel qui se charge : on peut dire quels poids on a. */
export const LOADABLE_EQUIPMENT: readonly EquipmentId[] = ['dumbbells', 'kettlebell', 'barbell', 'backpack', 'weight-vest', 'medicine-ball', 'sandbag'];

/**
 * Ce qu'il faut pour un exercice : une liste de groupes, tous nécessaires,
 * et dans chaque groupe une seule pièce suffit. `[['bench', 'chair', 'step']]`
 * se lit « un banc, une chaise ou une marche » ; `[['barbell'], ['rack']]`
 * se lit « une barre et un rack ». Une liste vide : rien du tout.
 */
export type EquipmentNeed = readonly (readonly EquipmentId[])[];

/** Une pièce que l'on possède, avec ses poids en kilos quand elle se charge. */
export interface OwnedEquipment {
    readonly id: EquipmentId;
    /** Les charges disponibles, en kilos : `[4, 8, 12]` pour trois paires d'haltères. */
    readonly loads?: readonly number[];
}

export type EquipmentInput = EquipmentId | OwnedEquipment;

/** Le matériel disponible, sous une forme facile à interroger. */
export interface Inventory {
    readonly has: (id: EquipmentId) => boolean;
    /** Les charges d'une pièce, triées, sans doublon ; vide si on ne les connaît pas. */
    readonly loadsOf: (id: EquipmentId) => readonly number[];
    readonly ids: readonly EquipmentId[];
}

export const isEquipment = (value: string): value is EquipmentId => (EQUIPMENT as readonly string[]).includes(value);

/**
 * Ce qui découle d'une pièce : deux chaises sont aussi une chaise, un banc
 * fait une marche, des barres à dips servent de parallettes… On ne l'écrit
 * qu'une fois ici, plutôt que dans chaque fiche.
 */
const IMPLIES: Readonly<Partial<Record<EquipmentId, readonly EquipmentId[]>>> = {
    'two-chairs': ['chair'],
    bench: ['step'],
    box: ['step'],
    'dip-bars': ['parallettes'],
};

/**
 * Le matériel disponible à partir de ce que la personne déclare. Les pièces
 * inconnues lèvent une erreur ; `assumed` s'ajoute (par défaut le sol et un
 * mur — passer `[]` pour ne rien supposer).
 */
export function inventory(owned: readonly EquipmentInput[] = [], assumed: readonly EquipmentId[] = ASSUMED_EQUIPMENT): Inventory {
    const loads = new Map<EquipmentId, number[]>();
    const declared: EquipmentId[] = [];

    for (const item of [...assumed, ...owned]) {
        const id = typeof item === 'string' ? item : item.id;

        if (!isEquipment(id)) {
            throw new Error(`Matériel inconnu : « ${id} »`);
        }

        declared.push(id);

        if (typeof item !== 'string' && item.loads) {
            loads.set(id, [...new Set([...(loads.get(id) ?? []), ...item.loads.filter((load) => load > 0)])].sort((a, b) => a - b));
        }
    }

    const ids = new Set<EquipmentId>();

    const add = (id: EquipmentId): void => {
        if (ids.has(id)) {
            return;
        }

        ids.add(id);

        for (const implied of IMPLIES[id] ?? []) {
            add(implied);
        }
    };

    declared.forEach(add);

    const sorted = EQUIPMENT.filter((id) => ids.has(id));

    return {
        has: (id) => ids.has(id),
        loadsOf: (id) => loads.get(id) ?? [],
        ids: sorted,
    };
}

/** Un besoin est-il couvert par l'inventaire ? Chaque groupe doit avoir au moins une pièce. */
export function satisfies(need: EquipmentNeed | undefined, available: Inventory): boolean {
    return (need ?? []).every((group) => group.length === 0 || group.some((id) => available.has(id)));
}

/** Les pièces qui serviront vraiment : la première disponible de chaque groupe. */
export function equipmentUsed(need: EquipmentNeed | undefined, available: Inventory): EquipmentId[] {
    return (need ?? []).flatMap((group) => {
        const found = group.find((id) => available.has(id));

        return found ? [found] : [];
    });
}
