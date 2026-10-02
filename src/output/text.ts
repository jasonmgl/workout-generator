/**
 * Une séance en texte, telle qu'un coach l'écrirait sur un carnet : utile
 * pour la relire, l'envoyer, ou l'afficher sans interface.
 */
import { formatSeconds } from '../i18n/format';
import { message } from '../i18n/messages';
import type { Session, SessionBlock, SessionItem } from '../types';

/** La cible d'un exercice : « 12 répétitions », « 30 s de chaque côté », « 3 × 5 · 4 · 3 ». */
export function describeTarget(item: SessionItem, locale = 'fr'): string {
    const { target } = item;
    const side = target.perSide ? ` ${message('text-per-side', {}, locale)}` : '';

    if (item.perSet && item.perSet.length) {
        return `${item.perSet.join(' · ')} ${message('text-reps-short', { n: 2 }, locale)}${side}`;
    }

    if (target.measure === 'time') return `${formatSeconds(target.value)}${side}`;
    if (target.measure === 'distance') return `${target.value} m${side}`;

    return `${message('text-reps', { n: target.value }, locale)}${side}`;
}

function describeItem(item: SessionItem, block: SessionBlock, locale: string): string {
    const parts = [describeTarget(item, locale)];

    if (block.format === 'straight' || block.format === 'ladder') {
        if (!item.perSet && item.sets > 1) parts.unshift(`${item.sets} ×`);
        if (item.sets > 1 && item.restSeconds > 0) parts.push(message('text-rest', { rest: formatSeconds(item.restSeconds) }, locale));
    }

    if (item.load) parts.push(`${item.load.kg} kg`);
    if (item.tempo) parts.push(message(`text-tempo-${item.tempo}`, {}, locale));
    if (item.rir !== undefined && block.role !== 'warmup' && block.role !== 'cooldown') parts.push(message('text-rir', { rir: item.rir }, locale));

    return `  · ${item.name} — ${parts.join(', ')}`;
}

function describeBlock(block: SessionBlock, locale: string): string[] {
    const header = [`${block.title}`];

    if (block.format === 'superset' || block.format === 'circuit' || (block.format === 'flow' && block.rounds > 1)) {
        header.push(message('text-rounds', { n: block.rounds }, locale));
    }

    if ((block.format === 'superset' || block.format === 'circuit') && block.restBetweenRounds > 0) {
        header.push(message('text-rest-rounds', { rest: formatSeconds(block.restBetweenRounds) }, locale));
    }

    if (block.format === 'tabata' || block.format === 'intervals') {
        header.push(message('text-intervals', { n: block.rounds, work: block.workSeconds ?? 0, rest: block.restSeconds ?? 0 }, locale));
    }

    return [`${header.join(' · ')} (${formatSeconds(block.estimatedSeconds)})`, ...block.items.map((item) => describeItem(item, block, locale))];
}

export function sessionToText(session: Session, locale = 'fr'): string {
    const lines = [session.title, session.summary, ''];

    for (const warning of session.warnings) {
        lines.push(`⚠ ${warning.text}`);
    }

    if (session.warnings.length) lines.push('');

    for (const block of session.blocks) {
        lines.push(...describeBlock(block, locale), '');
    }

    return lines.join('\n').trimEnd();
}
