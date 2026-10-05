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
import type { ExerciseDefinition, Impact, MovementPattern } from '../library/types';
import { performancesOf, struggledOn, valueOf, LEVEL_DIFFICULTY } from '../history/progress';
import type { Context } from './context';
import { loadVerdict, onPlateau, targetRange } from './prescribe';
import { isFocusSlot, type Slot } from './templates';

const IMPACT_ORDER: Readonly<Record<Impact, number>> = { none: 0, low: 1, high: 2 };

/** Combien de mouvements différents entrent au tirage final, et de variantes d’un même mouvement. */
const DRAW_SIZE = 4;

/**
 * Le mouvement d’un exercice : sa famille, sans distinguer la version chargée de celle au poids du corps. Des fentes
 * statiques et des fentes statiques avec haltères sont le même mouvement : jamais les deux dans une séance.
 */
export const movementKey = (definition: ExerciseDefinition): string => definition.family.replace(/^loaded-/, '');

/** Les érecteurs du rachis travaillent-ils, en principal ou en aide (une charnière, des extensions lombaires) ? */
export const loadsErectors = (definition: ExerciseDefinition): boolean =>
    definition.muscles.primary.includes('erectors') || Boolean(definition.muscles.secondary?.includes('erectors'));

/** Un exercice d’activation ou de rééducation (donkey kicks, clamshells) : sa place est l’échauffement. */
export const warmupOnly = (definition: ExerciseDefinition): boolean => Boolean(definition.tags?.some((tag) => tag === 'activation' || tag === 'rehab'));

/** Un exercice chargé, avec une charge assez lourde pour l’objectif, ou dont on ne connaît pas les charges. */
const heavyEnough = (definition: ExerciseDefinition, context: Context): boolean => Boolean(definition.tags?.includes('loaded')) && loadVerdict(definition, context) !== 'light';

/** Un exercice chargé dont la charge la plus lourde qu’on a est dérisoire pour l’objectif (un développé à 4 kg). */
const tooLight = (definition: ExerciseDefinition, context: Context): boolean => Boolean(definition.tags?.includes('loaded')) && loadVerdict(definition, context) === 'light';

const TRUNK_PATTERNS: readonly MovementPattern[] = ['anti-extension', 'anti-rotation', 'anti-lateral-flexion', 'trunk-flexion', 'trunk-rotation', 'trunk-extension'];

/**
 * Un exercice dont la charge est limitée par le gainage : un tirage tenu en planche (renegade row) fait travailler les
 * obliques en principal, et ce sont eux qui lâchent, pas le dos.
 */
const trunkLimited = (definition: ExerciseDefinition): boolean =>
    !TRUNK_PATTERNS.includes(definition.pattern) && definition.muscles.primary.some((muscle) => MUSCLE_INFO[muscle].group === 'core');

/** Les places principales où la force et le volume se construisent sur une charge : pousser, tirer, les jambes. */
const LOADED_FIRST: readonly MovementPattern[] = ['horizontal-push', 'vertical-push', 'horizontal-pull', 'vertical-pull', 'squat', 'lunge', 'hinge'];

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
    // presque pas (un avancé fait encore des squats à la barre), pourvu que la charge soit assez lourde (un goblet
    // squat à 6 kg reste un squat facile pour un avancé). Une marche au-dessus, il se règle avec la charge la plus
    // légère quand elle permet de commencer doucement : un goblet squat avec un haltère de 6 kg vaut des squats pour
    // un débutant. Les haltères que la personne a déclarés servent.
    const rawGap = definition.difficulty - target;
    const adjustable = Boolean(definition.tags?.includes('loaded')) && loadVerdict(definition, context) === 'adjustable';
    const gap = rawGap < 0 && heavyEnough(definition, context) ? rawGap / 3 : rawGap > 0 && adjustable ? Math.max(0, rawGap - 1) : rawGap;
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

    // Variété : pas le même exercice que la dernière fois, sauf sur un gros mouvement qu'on fait progresser. Sur une
    // place principale, l'exercice refait deux jours plus tard garde sa place quand il est en cours de progression (au
    // moins deux séances ces six dernières semaines) : c'est sur lui qu'on progresse. Jamais celui de la veille : deux
    // jours de suite, la même séance ne revient pas exercice pour exercice.
    const seen = context.exerciseRecency.get(definition.id);
    const family = context.familyRecency.get(definition.family);

    if (seen && seen.days <= 2 && (slot.role !== 'main' || seen.days < 2 || seen.count < 2)) value *= 0.5;
    if (slot.role === 'main' && family && family.days <= 14) value *= 1.25;
    if (seen && seen.count >= 10) value *= 0.7;

    // Sur une place principale, l’exercice exact fait ces deux dernières semaines passe devant ses variantes sœurs :
    // on progresse sur ce qu’on refait, et au plateau on le garde pour en changer le rythme (prescribe), pas l’exercice.
    // Au haut de sa fourchette, un exercice qui ne se charge pas a fini son escalier : place à la variante plus dure,
    // sauf au plateau, où l’on ne passe pas à plus dur (ci-dessous) : on le garde, plus lent.
    if (slot.role === 'main' && seen && seen.days <= 14) {
        const own = performancesOf(context.input.history ?? [], definition, context.date);
        const plateau = onPlateau(own);
        const topped = !definition.tags?.includes('loaded') && own[0] !== undefined && Math.min(...own[0].sets.map((set) => valueOf(set, definition.measure))) >= targetRange(definition, context.settings)[1];

        if (!topped || plateau) value *= plateau ? 3 : 2;
    }

    // Une famille au plateau ne passe pas à plus dur : on débloque d’abord le plateau.
    if (definition.difficulty > (context.capacity.families[definition.family] ?? 10) && familyOnPlateau(definition, context)) value *= 0.2;

    if (context.favorites.has(definition.id)) value *= 1.4;

    // Une place principale appelle un vrai mouvement : plusieurs articulations. Aucune place ne prend volontiers un
    // exercice d’activation (donkey kicks, marche sur les talons), qu’on garde pour l’échauffement : il ne sort que
    // s’il n’y a rien d’autre (une articulation ménagée, par exemple).
    if (slot.role === 'main' && definition.compound) value *= 1.3;
    if (warmupOnly(definition)) value *= 0.3;

    // L’objectif : une variante qui ne monte pas jusqu’aux répétitions de l’endurance, ou qui ne descend pas jusqu’à
    // celles de la force, sert mal ; une descente freinée et lente n’a rien à faire dans un circuit d’endurance.
    if (definition.measure === 'reps' && definition.kind === 'strength') {
        const [low, high] = context.settings.reps;

        if (definition.range[1] < low) value *= 0.5;
        if (definition.range[0] > high) value *= 0.6;
    }

    if ((context.goal === 'endurance' || context.goal === 'fat-loss') && definition.tags?.includes('eccentric')) value *= 0.4;

    // Avec des charges à disposition, assez lourdes, la force et le volume progressent mieux sur un exercice chargé ;
    // pas sur un exercice dont le gainage limite la charge (un renegade row comme tirage principal).
    const strong = context.goal === 'strength' || context.goal === 'hypertrophy';

    if (strong && heavyEnough(definition, context)) value *= 1.2;
    // Pour la force et le volume, une charge dérisoire ne fait pas un vrai exercice chargé : la variante au poids du
    // corps passe devant. Pour la forme ou l'endurance, un exercice chargé léger reste un exercice facile.
    if (strong && tooLight(definition, context)) value *= 0.5;
    if (strong && slot.role === 'main' && trunkLimited(definition)) value *= 0.5;

    // Deux exercices du même mouvement dans une séance (même famille, chargée ou non) : seulement s'il n'y a rien d'autre.
    if (chosen.some((other) => movementKey(other) === movementKey(definition))) value *= 0.15;
    if (chosen.some((other) => other.pattern === definition.pattern)) value *= 0.4;
    // Deux charnières qui chargent les érecteurs (un soulevé de terre sumo, puis un roumain) : le bas du dos paie deux
    // fois. Un leg curl ou un pont fait mieux la deuxième place ; chez un débutant, dont les érecteurs fatiguent vite et
    // tiennent la technique de tous les autres exercices, autant que deux fois le même mouvement.
    if (loadsErectors(definition) && chosen.some((other) => other.pattern === definition.pattern && loadsErectors(other))) value *= context.level === 'beginner' ? 0.15 : 0.4;

    return value;
}

/** Du meilleur au moins bon ; à égalité, par identifiant, pour que la même graine redonne la même séance. */
const byScore = (a: { definition: ExerciseDefinition; score: number }, b: { definition: ExerciseDefinition; score: number }): number =>
    b.score - a.score || a.definition.id.localeCompare(b.definition.id);

/** Les candidats faisables d'une place, notés, du meilleur au moins bon. */
export function rank(slot: Slot, context: Context, chosen: readonly ExerciseDefinition[]): { definition: ExerciseDefinition; score: number }[] {
    const taken = new Set(chosen.map((definition) => definition.id));

    const candidates = context.library
        .filter({ kinds: slot.kinds, patterns: slot.patterns })
        .filter((definition) => !taken.has(definition.id) && feasible(definition, context))
        .filter((definition) => !slot.groups || definition.muscles.primary.some((muscle) => slot.groups!.includes(MUSCLE_INFO[muscle].group)))
        .map((definition) => ({ definition, score: score(definition, slot, context, chosen) }))
        .sort(byScore);

    // Les muscles qu’une place doit faire travailler, quand le catalogue le permet : une place « mollets » prend des
    // mollets, pas le jambier antérieur ; une poussée horizontale, les pectoraux plutôt que les seuls triceps. À
    // défaut d’un exercice où ils sont en principal, un exercice où ils aident (un good morning pour les lombaires).
    const works = (muscles: readonly MuscleId[] | undefined): boolean => Boolean(muscles?.some((muscle) => slot.muscles!.includes(muscle)));
    const primary = slot.muscles ? candidates.filter((entry) => works(entry.definition.muscles.primary)) : [];
    const secondary = slot.muscles && !primary.length ? candidates.filter((entry) => works(entry.definition.muscles.secondary)) : [];
    const pool = primary.length ? primary : secondary.length ? secondary : candidates;

    // En force et en prise de muscle, un gros mouvement progresse sur des charges qu’on note : sur une place principale
    // pour pousser, tirer ou les jambes, quand un polyarticulaire chargé assez lourd est faisable dans un schéma, les
    // autres exercices de ce schéma passent derrière (un développé couché plutôt que des pompes sur un bras à quatre
    // répétitions, ou que des écartés). Pas une traction derrière un rowing : chaque schéma se juge à part. Et jamais
    // ce qu’on fait progresser : une famille faite ces deux dernières semaines garde sa place.
    const strong = (definition: ExerciseDefinition): boolean => definition.compound && heavyEnough(definition, context);
    const loadedPatterns =
        (context.goal === 'strength' || context.goal === 'hypertrophy') && slot.role === 'main' && slot.patterns.some((pattern) => LOADED_FIRST.includes(pattern))
            ? new Set(pool.filter((entry) => strong(entry.definition)).map((entry) => entry.definition.pattern))
            : new Set<MovementPattern>();
    const behind = (definition: ExerciseDefinition): boolean =>
        loadedPatterns.has(definition.pattern) && !strong(definition) && (context.familyRecency.get(definition.family)?.days ?? Infinity) > 14;

    // On progresse sur ce qu’on refait : sur une place principale, le mouvement qu’on fait progresser (sa famille faite
    // au moins deux fois ces six dernières semaines, la dernière il y a moins de deux semaines) passe devant les autres
    // mouvements de la place, chargés compris. Des pompes qu’on monte séance après séance ne cèdent pas une fois sur
    // deux la place à un développé ; elles passent à une variante plus dure, ou à leur version chargée.
    const progressing = (definition: ExerciseDefinition): boolean => {
        const recency = context.familyRecency.get(definition.family);

        return recency !== undefined && recency.count >= 2 && recency.days <= 14;
    };
    const progressed = new Set(slot.role === 'main' ? pool.filter((entry) => progressing(entry.definition)).map((entry) => movementKey(entry.definition)) : []);
    const weight = (definition: ExerciseDefinition): number => (behind(definition) ? 0.3 : 1) * (progressed.size && !progressed.has(movementKey(definition)) ? 0.5 : 1);

    return loadedPatterns.size || progressed.size ? pool.map((entry) => ({ ...entry, score: entry.score * weight(entry.definition) })).sort(byScore) : pool;
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
    const reachable = ranked.filter((entry) => entry.definition.difficulty - targetDifficulty(entry.definition, context) <= CEILING);
    // Qui demande « fessiers » attend du travail pour les fessiers : une place du focus ne prend un exercice
    // d’activation, ou une descente freinée jamais faite (deux séries au plus la première fois), que s’il n’y a rien
    // d’autre de faisable. Une place de tirage non plus, quand un autre tirage est à portée : des tractions négatives à
    // deux séries ne répondent pas à un développé qui en a quatre. Ni une place principale quand l’objectif demande
    // plus de deux séries. Elle reste l’entrée dans la famille quand rien d’autre n’est à portée, et celle d’un débutant
    // (deux séries, c’est déjà son compte).
    const firstDescent = (definition: ExerciseDefinition): boolean =>
        Boolean(definition.tags?.includes('eccentric')) && performancesOf(context.input.history ?? [], definition, context.date).length === 0;
    const pulling = slot.patterns.some((pattern) => pattern === 'horizontal-pull' || pattern === 'vertical-pull');
    const thin = slot.role === 'main' && context.settings.sets[context.level][0] > 2;
    const working = isFocusSlot(slot)
        ? reachable.filter((entry) => !warmupOnly(entry.definition) && !firstDescent(entry.definition))
        : pulling || thin
          ? reachable.filter((entry) => !firstDescent(entry.definition))
          : [];
    const within = working.length ? working : reachable;

    if (within.length === 0) {
        if (strict || ranked.length === 0) return undefined;

        return [...ranked].sort((a, b) => a.definition.difficulty - b.definition.difficulty || b.score - a.score)[0]!.definition;
    }

    // Le tirage se fait en deux temps : d’abord le mouvement, puis la variante, parmi celles qui valent presque la
    // meilleure. Un mouvement pèse ses deux meilleures variantes, jamais plus : quatre pompes contre un développé ne
    // laissent plus sortir le développé qu’une fois sur quatre, mais une famille d’une seule fiche (le renegade row)
    // ne pèse pas autant que deux bons rowings, ni un exercice isolé autant que la famille qu’on fait progresser.
    // Toujours deux tirages : le hasard garde le même ordre.
    const movements: (typeof within)[] = [];

    for (const entry of within) {
        const group = movements.find((members) => movementKey(members[0]!.definition) === movementKey(entry.definition));

        if (group) group.push(entry);
        else if (movements.length < DRAW_SIZE) movements.push([entry]);
    }

    const best = movements[0]![0]!.score;
    const close = (members: typeof within): typeof within => members.filter((entry) => entry.score >= members[0]!.score * 0.75);
    const movement = context.random.weighted(
        movements.filter((members) => members[0]!.score >= best * 0.35),
        (members) =>
            close(members)
                .slice(0, 2)
                .reduce((sum, entry) => sum + entry.score * entry.score, 0),
    );

    return context.random.weighted(close(movement).slice(0, DRAW_SIZE), (entry) => entry.score * entry.score).definition;
}
