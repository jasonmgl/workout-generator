/**
 * Remplir un modèle de phrase : « {n} {n|série|séries} de {reps} » avec
 * `{ n: 3, reps: 12 }` donne « 3 séries de 12 ».
 *
 * `{nom}` met la valeur telle quelle. `{nom|un|plusieurs}` choisit selon le
 * nombre : en français, 0 et 1 prennent le singulier. Une valeur absente
 * laisse le modèle visible plutôt que d'écrire « undefined » : on voit le
 * trou, on ne le cache pas.
 */

export type Params = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)(?:\|([^|}]*)\|([^}]*))?\}/g;

/** Le singulier vaut pour 0 et 1 en français, pour 1 seul en anglais. */
export type PluralRule = (count: number) => 'one' | 'other';

export const FRENCH_PLURAL: PluralRule = (count) => (Math.abs(count) < 2 ? 'one' : 'other');

export function format(template: string, params: Params = {}, plural: PluralRule = FRENCH_PLURAL): string {
    return template.replace(PLACEHOLDER, (whole, name: string, one?: string, other?: string) => {
        const value = params[name];

        if (value === undefined) {
            return whole;
        }

        if (one === undefined || other === undefined) {
            return String(value);
        }

        return plural(Number(value)) === 'one' ? one : other;
    });
}

/** Une durée lisible : « 45 s », « 2 min », « 1 min 30 », « 1 h 05 », avec des espaces insécables. */
export function formatSeconds(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));

    if (total < 60) {
        return `${total}\u00A0s`;
    }

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;

    if (hours > 0) {
        return `${hours}\u00A0h\u00A0${String(minutes).padStart(2, '0')}`;
    }

    return rest === 0 ? `${minutes}\u00A0min` : `${minutes}\u00A0min\u00A0${String(rest).padStart(2, '0')}`;
}

/**
 * Un texte sans accents ni majuscules ni ponctuation, pour chercher :
 * « Pompes inclinées » et « pompes inclinees » se retrouvent.
 */
export function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[’'`]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
