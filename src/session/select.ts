/**
 * Choisir l'exercice d'une place. On garde d'abord ce qui est faisable :
 * le bon schéma, le matériel qu'on a, les sauts permis, les articulations
 * ménagées, rien de ce qu'on évite. Puis on note chaque candidat :
 *
 * - la difficulté juste : la variante qu'on sait faire, un cran au-dessus si
 *   la dernière fois était facile, un cran en dessous un jour de petite forme
 *   (une variante trop dure pèse très lourd contre elle : c'est là qu'on se
 *   blesse) ;
 * - des muscles frais et en retard sur la semaine, et ceux qu'on veut viser ;
 * - un peu de variété, mais de la continuité sur les gros mouvements : on
 *   progresse sur ce qu'on refait ;
 * - les exercices qu'on aime.
 *
 * Le tirage se fait parmi les meilleurs, au hasard de la graine : deux
 * séances de suite ne sont pas identiques, la même graine redonne la même.
 */
import { MUSCLE_INFO, type MuscleId } from '../library/anatomy';
import { satisfies } from '../library/equipment';
import type { ExerciseDefinition, Impact } from '../library/types';
import { performancesOf, struggledOn, valueOf, LEVEL_DIFFICULTY } from '../history/progress';
import type { Context } from './context';
import { onPlateau, targetRange } from './prescribe';
import type { Slot } from './templates';

const IMPACT_ORDER: Readonly<Record<Impact, number>> = { none: 0, low: 1, high: 2 };

/** Combien de candidats entrent au tirage final. */
const DRAW_SIZE = 4;

/** Ce qui rend un exercice impossible aujourd'hui. */
export function feasible(definition: ExerciseDefinition, context: Context): boolean {
    if (context.exclude.has(definition.id)) return false;
    if (!satisfies(definition.equipment, context.inventory)) return false;
    if (IMPACT_ORDER[definition.impact] > IMPACT_ORDER[context.maxImpact]) return false;
    if (context.avoidPostures.has(definition.posture)) return false;

    for (const [joint, tolerance] of context.jointTolerance) {
        if ((definition.joints?.[joint] ?? 0) > tolerance) return false;
    }

    return !definition.muscles.primary.some((muscle) => context.avoidMuscles.has(muscle));
}

/**
 * La difficulté visée dans une famille : la plus dure réussie, plus un si la
 * dernière fois était au plafond, moins un si elle a coincé ; corrigée par
 * l'objectif et par la forme du jour.
 */
export function targetDifficulty(definition: ExerciseDefinition, context: Context): number {
    const known = context.capacity.families[definition.family];
    const pattern = context.capacity.patterns[definition.pattern];
    let base = known ?? (pattern !== undefined ? pattern - 0.5 : LEVEL_DIFFICULTY[context.level]);

    if (known !== undefined) {
        const variant = context.library.family(definition.family).find((member) => member.difficulty === known && performancesOf(context.input.history ?? [], member, context.date).length > 0);
        const last = variant ? performancesOf(context.input.history ?? [], variant, context.date)[0] : undefined;

        if (variant && last) {
            const [, high] = targetRange(variant, context.settings);
            const values = last.sets.map((set) => valueOf(set, variant.measure));
            const before = performancesOf(context.input.history ?? [], variant, context.date)[1];
            // « A coincé », c’est sous la fourchette de la variante elle-même (six tractions sont une vraie série de
            // tractions, même si l’objectif en voudrait huit), nettement moins bien que d’habitude, ou deux séances de
            // suite à l’échec : un échec isolé fait tenir la cible (prescribe), pas changer de variante.
            const struggled =
                last.best < variant.range[0] || (before !== undefined && (last.total < before.total * 0.85 || (struggledOn(last) && struggledOn(before))));

            if (Math.min(...values) >= high) base += 1;
            else if (struggled) base -= 1;
        }
    }

    if (definition.kind === 'strength' || definition.kind === 'skill') {
        base += context.settings.difficultyShift * 0.5;
    }

    if (context.readiness.intensity < 0.85) base -= 2;
    else if (context.readiness.intensity < 1) base -= 1;

    return Math.min(10, Math.max(1, base));
}

/** La variante la plus dure réussie d’une famille est-elle au plateau ? */
function familyOnPlateau(definition: ExerciseDefinition, context: Context): boolean {
    const known = context.capacity.families[definition.family];

    return context.library
        .family(definition.family)
        .some((member) => member.difficulty === known && onPlateau(performancesOf(context.input.history ?? [], member, context.date)));
}

/** La note d'un muscle : frais, en retard sur la semaine, visé. */
function muscleAppeal(muscle: MuscleId, context: Context): number {
    const recovery = context.body.muscles[muscle].recovery;
    const need = context.needs[MUSCLE_INFO[muscle].group];
    const focus = context.focusMuscles.has(muscle) ? 2 : 1;

    return recovery * recovery * (0.5 + need) * focus;
}

/** La note d'un candidat pour une place : plus elle est haute, plus il a de chances de sortir. */
export function score(definition: ExerciseDefinition, slot: Slot, context: Context, chosen: readonly ExerciseDefinition[]): number {
    const target = targetDifficulty(definition, context);
    // Un exercice chargé progresse par la charge : être techniquement plus simple que le niveau ne le dessert
    // presque pas (un avancé fait encore des squats à la barre), être plus technique, si.
    const rawGap = definition.difficulty - target;
    const gap = definition.tags?.includes('loaded') && rawGap < 0 ? rawGap / 3 : rawGap;
    let value = Math.exp(-(gap * gap) / (2 * 1.2 * 1.2));

    if (gap > 1.5) {
        value *= 0.2;
    }

    const primary = definition.muscles.primary;
    const appeal = primary.reduce((sum, muscle) => sum + muscleAppeal(muscle, context), 0) / primary.length;

    value *= 0.25 + appeal;

    for (const muscle of definition.muscles.secondary ?? []) {
        if (context.avoidMuscles.has(muscle)) value *= 0.5;
        if (context.body.muscles[muscle].recovery < 0.4) value *= 0.85;
    }

    // Variété : pas le même exercice que la dernière fois, sauf sur un gros mouvement qu'on fait progresser.
    const seen = context.exerciseRecency.get(definition.id);
    const family = context.familyRecency.get(definition.family);

    if (seen && seen.days <= 2) value *= 0.5;
    if (slot.role === 'main' && family && family.days <= 14) value *= 1.25;
    if (seen && seen.count >= 10) value *= 0.7;

    // Sur une place principale, l’exercice exact fait ces deux dernières semaines passe devant ses variantes sœurs :
    // on progresse sur ce qu’on refait, et au plateau on le garde pour en changer le rythme (prescribe), pas l’exercice.
    if (slot.role === 'main' && seen && seen.days <= 14) {
        value *= onPlateau(performancesOf(context.input.history ?? [], definition, context.date)) ? 3 : 2;
    }

    // Une famille au plateau ne passe pas à plus dur : on débloque d’abord le plateau.
    if (definition.difficulty > (context.capacity.families[definition.family] ?? 10) && familyOnPlateau(definition, context)) value *= 0.2;

    if (context.favorites.has(definition.id)) value *= 1.4;

    // Une place principale appelle un vrai mouvement : plusieurs articulations, pas un exercice d’activation (donkey
    // kicks, marche sur les talons), qu’on garde pour l’échauffement.
    if (slot.role === 'main') {
        if (definition.compound) value *= 1.3;
        if (definition.tags?.some((tag) => tag === 'activation' || tag === 'rehab')) value *= 0.3;
    }

    // L’objectif : une variante qui ne monte pas jusqu’aux répétitions de l’endurance, ou qui ne descend pas jusqu’à
    // celles de la force, sert mal ; une descente freinée et lente n’a rien à faire dans un circuit d’endurance.
    if (definition.measure === 'reps' && definition.kind === 'strength') {
        const [low, high] = context.settings.reps;

        if (definition.range[1] < low) value *= 0.5;
        if (definition.range[0] > high) value *= 0.6;
    }

    if ((context.goal === 'endurance' || context.goal === 'fat-loss') && definition.tags?.includes('eccentric')) value *= 0.4;

    // Avec des charges à disposition, la force et le volume progressent mieux sur un exercice chargé.
    if ((context.goal === 'strength' || context.goal === 'hypertrophy') && definition.tags?.includes('loaded')) value *= 1.2;

    // Deux exercices de la même famille dans une séance : seulement s'il n'y a rien d'autre.
    if (chosen.some((other) => other.family === definition.family)) value *= 0.15;
    if (chosen.some((other) => other.pattern === definition.pattern)) value *= 0.4;

    return value;
}

/** Les candidats faisables d'une place, notés, du meilleur au moins bon. */
export function rank(slot: Slot, context: Context, chosen: readonly ExerciseDefinition[]): { definition: ExerciseDefinition; score: number }[] {
    const taken = new Set(chosen.map((definition) => definition.id));

    const candidates = context.library
        .filter({ kinds: slot.kinds, patterns: slot.patterns })
        .filter((definition) => !taken.has(definition.id) && feasible(definition, context))
        .filter((definition) => !slot.groups || definition.muscles.primary.some((muscle) => slot.groups!.includes(MUSCLE_INFO[muscle].group)))
        .map((definition) => ({ definition, score: score(definition, slot, context, chosen) }))
        .sort((a, b) => b.score - a.score || a.definition.id.localeCompare(b.definition.id));

    // Les muscles qu’une place doit faire travailler, quand le catalogue le permet : une place « mollets » prend des
    // mollets, pas le jambier antérieur ; une poussée horizontale, les pectoraux plutôt que les seuls triceps.
    if (slot.muscles) {
        const matching = candidates.filter((entry) => entry.definition.muscles.primary.some((muscle) => slot.muscles!.includes(muscle)));

        if (matching.length) return matching;
    }

    return candidates;
}

/** Au-delà d’une marche et demie au-dessus de la difficulté visée, un exercice est trop dur pour être proposé. */
export const CEILING = 1.5;

/**
 * L’exercice d’une place, tiré parmi les meilleurs. Rien de plus d’une marche et demie au-dessus de ce que la
 * personne sait faire : une place en plus (`strict`) reste alors vide, une place de base prend la variante faisable
 * la plus facile. Aucun si rien n’est faisable.
 */
export function pick(slot: Slot, context: Context, chosen: readonly ExerciseDefinition[], strict = false): ExerciseDefinition | undefined {
    const ranked = rank(slot, context, chosen);
    const within = ranked.filter((entry) => entry.definition.difficulty - targetDifficulty(entry.definition, context) <= CEILING);

    if (within.length === 0) {
        if (strict || ranked.length === 0) return undefined;

        return [...ranked].sort((a, b) => a.definition.difficulty - b.definition.difficulty || b.score - a.score)[0]!.definition;
    }

    const finalists = within.slice(0, DRAW_SIZE);
    const best = finalists[0]!.score;

    return context.random.weighted(
        finalists.filter((entry) => entry.score >= best * 0.35),
        (entry) => entry.score * entry.score,
    ).definition;
}
