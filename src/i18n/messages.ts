/**
 * Les phrases du moteur, rangées par langue et par code. Une raison garde
 * toujours son code : une application peut réagir à `pulse-high` sans lire
 * le texte, ou écrire le sien.
 */
import { format, FRENCH_PLURAL, type Params, type PluralRule } from './format';
import { MESSAGES_FR } from './fr/messages';
import type { Reason } from '../types';

const catalogs = new Map<string, { readonly messages: Readonly<Record<string, string>>; readonly plural: PluralRule }>([
    ['fr', { messages: MESSAGES_FR, plural: FRENCH_PLURAL }],
]);

/**
 * Ajouter (ou compléter) une langue. Les codes absents retombent sur le
 * français, puis sur le code lui-même.
 */
export function registerMessages(locale: string, messages: Readonly<Record<string, string>>, plural?: PluralRule): void {
    const existing = catalogs.get(locale);

    catalogs.set(locale, { messages: { ...(existing?.messages ?? {}), ...messages }, plural: plural ?? existing?.plural ?? FRENCH_PLURAL });
}

/** La phrase d'un code, remplie. */
export function message(code: string, params: Params = {}, locale = 'fr'): string {
    const catalog = catalogs.get(locale) ?? catalogs.get('fr')!;
    const template = catalog.messages[code] ?? catalogs.get('fr')!.messages[code] ?? code;

    return format(template, params, catalog.plural);
}

/** Une raison : son code, ses valeurs et sa phrase. */
export function reason(code: string, params: Params = {}, locale = 'fr'): Reason {
    const text = message(code, params, locale);

    return Object.keys(params).length ? { code, params, text } : { code, text };
}

/** Les codes connus en français : la référence que les autres langues doivent couvrir. */
export function messageCodes(): string[] {
    return Object.keys(MESSAGES_FR);
}
