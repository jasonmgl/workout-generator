/**
 * Une séance en texte, telle qu'un coach l'écrirait sur un carnet : utile
 * pour la relire, l'envoyer, ou l'afficher sans interface. Chaque ligne dit
 * d'un coup d'œil quoi faire : « Squats bulgares — 3 séries de 9 répétitions
 * de chaque côté · repos 1 min 30 · réserve : 2 répétitions ».
 */
import { formatSeconds } from '../i18n/format';
import { message } from '../i18n/messages';
import type { Session, SessionBlock, SessionItem } from '../types';

/** Une durée arrondie à la demi-minute : on ne chronomètre pas une séance à la seconde. */
export function roughSeconds(seconds: number): string {
    return formatSeconds(seconds < 60 ? Math.round(seconds / 5) * 5 : Math.round(seconds / 30) * 30);
}

/** La cible d'un exercice : « 12 répétitions », « 30 s de chaque côté », « 12 répétitions en alternant (6 de chaque côté) ». */
export function describeTarget(item: SessionItem, locale = 'fr', alternating = false): string {
    const { target } = item;
    const side = target.perSide ? ` ${message('text-per-side', {}, locale)}` : '';

    if (item.perSet && item.perSet.length) {
        return `${item.perSet.join(' · ')} ${message('text-reps-short', { n: 2 }, locale)}${side}`;
    }

    if (target.measure === 'time') return `${formatSeconds(target.value)}${side}`;
    if (target.measure === 'distance') return `${target.value} m${side}`;
    if (alternating) return message('text-reps-alternating', { n: target.value, half: target.value / 2 }, locale);

    return `${message('text-reps', { n: target.value }, locale)}${side}`;
}

function describeItem(item: SessionItem, block: SessionBlock, locale: string, alternating: ReadonlySet<string>): string[] {
    const straight = block.format === 'straight' || block.format === 'ladder' || block.format === 'steady';
    const target = describeTarget(item, locale, alternating.has(item.exercise));
    const first = straight && !item.perSet && item.sets > 1 ? message('text-sets-of', { n: item.sets, target }, locale) : target;
    const parts = [first];

    if (straight && item.sets > 1 && item.restSeconds > 0) parts.push(message('text-rest', { rest: formatSeconds(item.restSeconds) }, locale));
    if (item.load) parts.push(message(item.note && item.progression?.step === 'start' ? 'text-load-guess' : 'text-load', { kg: item.load.kg }, locale));
    if (item.tempo && item.tempo !== 'normal') parts.push(message(`text-tempo-${item.tempo}`, {}, locale));
    if (item.rir !== undefined && block.role !== 'warmup' && block.role !== 'cooldown') parts.push(message('text-rir', { rir: item.rir }, locale));

    const lines = [`  · ${item.name} — ${parts.join(' · ')}`];

    if (item.warmupSets?.length) {
        lines.unshift(`  · ${message('text-approach', { sets: item.warmupSets.map((set) => `${set.kg} kg × ${set.reps}`).join(', '), name: item.name }, locale)}`);
    }

    return lines;
}

function describeBlock(block: SessionBlock, locale: string, alternating: ReadonlySet<string>): string[] {
    const header = [block.title];
    const inRounds = block.format === 'superset' || block.format === 'circuit' || (block.format === 'flow' && block.rounds > 1);

    if (inRounds) header.push(message('text-rounds', { n: block.rounds }, locale));
    if ((block.format === 'superset' || block.format === 'circuit') && (block.restBetweenItems ?? 0) > 0) {
        header.push(message('text-rest-items', { rest: formatSeconds(block.restBetweenItems!) }, locale));
    }

    if (block.format === 'tabata' || block.format === 'intervals') {
        header.push(message('text-intervals', { n: block.rounds, work: block.workSeconds ?? 0, rest: block.restSeconds ?? 0 }, locale));
    }

    if (block.rounds > 1 && block.restBetweenRounds > 0 && block.format !== 'straight' && block.format !== 'flow') {
        header.push(message('text-rest-rounds', { rest: formatSeconds(block.restBetweenRounds) }, locale));
    }

    return [`${header.join(' · ')} (${roughSeconds(block.estimatedSeconds)})`, ...block.items.flatMap((item) => describeItem(item, block, locale, alternating))];
}

/**
 * La séance en texte. `alternating` liste les exercices qui se font en alternant les côtés (la bibliothèque le
 * sait) : leur cible s'écrit « 12 répétitions en alternant (6 de chaque côté) ».
 */
export function sessionToText(session: Session, locale = 'fr', alternating: ReadonlySet<string> = new Set()): string {
    const lines = [session.title, session.summary, ''];
    const all = session.blocks.flatMap((block) => block.items);
    const notes = [
        ...session.warnings.map((warning) => `⚠ ${warning.text}`),
        ...session.notes.map((note) => `→ ${note.text}`),
        // Ce que veulent dire la réserve et les charges indicatives, une seule fois en tête.
        ...(all.some((item) => item.rir !== undefined) ? [`→ ${message('text-rir-explained', {}, locale)}`] : []),
        ...(all.some((item) => item.load && item.note && item.progression?.step === 'start') ? [`→ ${message('text-load-explained', {}, locale)}`] : []),
    ];

    if (notes.length) lines.push(...notes, '');

    for (const block of session.blocks) {
        lines.push(...describeBlock(block, locale, alternating), '');
    }

    return lines.join('\n').trimEnd();
}
