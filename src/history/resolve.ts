/**
 * L'historique tel que l'application le donne, ramené aux fiches du
 * catalogue. Une application ne connaît pas toujours nos identifiants :
 * DidIt envoie le nom de ses exercices (« Pompes », « Pompes inclinées »).
 * On le retrouve par le nom ou un alias, sans accents ni majuscules ; un
 * exercice inconnu reste tel quel, et sera ignoré.
 *
 * Une application qui ne garde qu'un nombre par exercice le range souvent
 * dans `reps`, même pour une planche tenue 45 s : sur une fiche en durée,
 * une série sans secondes lit ses répétitions comme des secondes.
 */
import type { Library, Locale } from '../library/library';
import type { PastSession, PerformedExercise } from '../types';

function resolveExercise(performed: PerformedExercise, library: Library, locale: Locale): PerformedExercise {
    const definition = library.find(performed.exercise) ?? library.findByName(performed.exercise, locale);

    if (!definition) {
        return performed;
    }

    const timed = definition.measure === 'time' && performed.sets.some((set) => set.seconds === undefined && set.reps !== undefined);

    if (definition.id === performed.exercise && !timed) {
        return performed;
    }

    return {
        exercise: definition.id,
        sets: timed ? performed.sets.map(({ reps, ...set }) => (set.seconds === undefined && reps !== undefined ? { ...set, seconds: reps } : { ...set, ...(reps !== undefined ? { reps } : {}) })) : performed.sets,
    };
}

/** Les séances passées, chaque exercice désigné par l'identifiant de sa fiche quand on la retrouve. */
export function resolveHistory(history: readonly PastSession[], library: Library, locale: Locale = 'fr'): PastSession[] {
    return history.map((session) => {
        if (!session.exercises?.length) {
            return session;
        }

        const exercises = session.exercises.map((performed) => resolveExercise(performed, library, locale));

        return exercises.every((performed, index) => performed === session.exercises![index]) ? session : { ...session, exercises };
    });
}
