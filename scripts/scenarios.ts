/**
 * Les séances des relectures de coachs, en texte : `npx vite-node scripts/scenarios.ts`
 * (ou `OUT=seances.md npx vite-node scripts/scenarios.ts` pour un fichier).
 * Les numéros des relectures (`docs/relectures`) sont ceux de cette liste.
 */
import { writeFileSync } from 'node:fs';
import { generateSession } from '../src/session/generate';
import { planWeek } from '../src/week/plan';
import { sessionToText } from '../src/output/text';
import type { GenerateInput, PastSession } from '../src/types';

const D = '2026-10-03T18:00';
const days = (n: number) => new Date(Date.UTC(2026, 9, 3 - n)).toISOString().slice(0, 10);
const progress: PastSession[] = [
    { date: days(9), effort: 'right', exercises: [{ exercise: 'push-up', sets: [{ reps: 10 }, { reps: 9 }, { reps: 8 }] }, { exercise: 'air-squat', sets: [{ reps: 15 }, { reps: 15 }, { reps: 14 }] }, { exercise: 'inverted-row-table', sets: [{ reps: 8 }, { reps: 8 }, { reps: 7 }] }, { exercise: 'plank', sets: [{ seconds: 40 }, { seconds: 35 }] }] },
    { date: days(6), effort: 'right', exercises: [{ exercise: 'push-up', sets: [{ reps: 11 }, { reps: 10 }, { reps: 9 }] }, { exercise: 'reverse-lunge', sets: [{ reps: 10 }, { reps: 10 }] }, { exercise: 'inverted-row-table', sets: [{ reps: 9 }, { reps: 8 }, { reps: 8 }] }, { exercise: 'glute-bridge', sets: [{ reps: 15 }, { reps: 15 }] }] },
    { date: days(3), effort: 'easy', exercises: [{ exercise: 'push-up', sets: [{ reps: 12 }, { reps: 12 }, { reps: 11 }] }, { exercise: 'air-squat', sets: [{ reps: 20 }, { reps: 20 }, { reps: 18 }] }, { exercise: 'inverted-row-table', sets: [{ reps: 10 }, { reps: 10 }, { reps: 9 }] }] },
];
const plateau: PastSession[] = [12, 9, 6, 3].map((n) => ({ date: days(n), exercises: [{ exercise: 'pull-up', sets: [{ reps: 6 }, { reps: 5 }, { reps: 4 }] }, { exercise: 'parallel-bar-dip', sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }] }] }));
const pulses = [52, 53, 51, 54, 52, 53].map((bpm, i) => ({ date: days(i + 1), bpm }));

export const SCENARIOS: [string, GenerateInput][] = [
    ['Débutant, sans matériel, forme, 20 min', { date: D, request: { minutes: 20 } }],
    ['Débutant, sans matériel, forme, 45 min', { date: D, request: { minutes: 45 } }],
    ['Intermédiaire, deux chaises + table, prise de muscle, 45 min', { date: D, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: ['two-chairs', 'table'], request: { minutes: 45 } }],
    ['Avancé, barre de traction + anneaux + parallettes, force, 60 min', { date: D, profile: { goal: 'strength', level: 'advanced' }, equipment: ['pullup-bar', 'rings', 'parallettes'], request: { minutes: 60 } }],
    ['Intermédiaire, haltères 4-20 kg + banc, prise de muscle, 30 min, focus bras', { date: D, profile: { goal: 'hypertrophy', level: 'intermediate', bodyweightKg: 75 }, equipment: [{ id: 'dumbbells', loads: [4, 6, 8, 10, 12, 14, 16, 20] }, 'bench'], request: { minutes: 30, focus: ['arms'] } }],
    ['Avancé, salle complète, force, 60 min, 80 kg', { date: D, profile: { goal: 'strength', level: 'advanced', bodyweightKg: 80 }, equipment: [{ id: 'barbell', loads: [20, 30, 40, 50, 60, 70, 80, 90, 100] }, 'rack', 'bench', { id: 'dumbbells', loads: [5, 10, 15, 20, 25] }, 'pullup-bar', 'dip-bars'], request: { minutes: 60 } }],
    ['Perte de gras, appartement (sans saut), sans matériel, 30 min', { date: D, profile: { goal: 'fat-loss' }, request: { minutes: 30, quiet: true } }],
    ['Endurance, extérieur + corde à sauter, intermédiaire, 45 min', { date: D, profile: { goal: 'endurance', level: 'intermediate' }, equipment: ['outdoor', 'jump-rope'], request: { minutes: 45 } }],
    ['Jambes chargées par une course de 90 min hier, maison, 30 min', { date: D, equipment: ['two-chairs', 'table', 'towel', 'door'], history: [{ date: `${days(1)}T09:00`, activities: [{ type: 'run', minutes: 90, intensity: 'hard' }] }], request: { minutes: 30 } }],
    ['Poignets douloureux (2), sans matériel, 30 min', { date: D, readiness: { pain: [{ joint: 'wrists', severity: 2 }] }, request: { minutes: 30 } }],
    ['Genou douloureux (2), haltères, 40 min', { date: D, readiness: { pain: [{ joint: 'knees', severity: 2 }] }, equipment: [{ id: 'dumbbells', loads: [4, 8, 12] }], request: { minutes: 40 } }],
    ['Petite forme : énergie 2, nuit de 5 h, stressé, 30 min', { date: D, readiness: { energy: 2, sleepHours: 5, stress: 4 }, request: { minutes: 30 } }],
    ['Règles avec symptômes forts, 30 min', { date: D, readiness: { cycle: { phase: 'menstrual', symptoms: 3 } }, request: { minutes: 30 } }],
    ['Trois séances passées en progression (pompes, squats, rowing table), 30 min', { date: D, equipment: ['table'], history: progress, request: { minutes: 30 } }],
    ['Plateau sur tractions et dips (4 séances identiques), 45 min', { date: D, profile: { level: 'intermediate' }, equipment: ['pullup-bar', 'dip-bars'], history: plateau, request: { minutes: 45 } }],
    ['Gainage et abdos demandés, 20 min', { date: D, request: { type: 'core', minutes: 20 } }],
    ['Cardio fractionné demandé, sans matériel, 25 min', { date: D, request: { type: 'hiit', minutes: 25 } }],
    ['Cardio demandé, vélo d’appartement, 40 min', { date: D, equipment: ['bike'], request: { type: 'cardio', minutes: 40 } }],
    ['Figures, avancé, barre + parallettes, 45 min', { date: D, profile: { level: 'advanced' }, equipment: ['pullup-bar', 'parallettes'], request: { type: 'skill', minutes: 45 } }],
    ['Mobilité demandée, 20 min', { date: D, request: { type: 'mobility', minutes: 20 } }],
    ['Pouls du matin à +13 %, 45 min demandées', { date: D, readiness: { restingHeartRate: 60, heartRateHistory: pulses }, request: { minutes: 45 } }],
    ['Express 10 min, sans matériel', { date: D, request: { minutes: 10 } }],
    ['Perte de gras, débutant, haltères 2-8 kg, 60 min', { date: D, profile: { goal: 'fat-loss', level: 'beginner' }, equipment: [{ id: 'dumbbells', loads: [2, 4, 6, 8] }], request: { minutes: 60 } }],
    ['Fessiers visés, mini-bande + haltères, 40 min', { date: D, equipment: ['mini-band', { id: 'dumbbells', loads: [6, 10, 14] }], request: { minutes: 40, focus: ['glutes'] } }],
    ['Épaule blessée : sans le haut du corps, élastique, 30 min', { date: D, equipment: ['resistance-band'], request: { minutes: 30, avoid: ['upper'] } }],
    ['Endurance, débutant, sans matériel, 60 min', { date: D, profile: { goal: 'endurance', level: 'beginner' }, request: { minutes: 60 } }],
    ['Kettlebell 16 kg seul, forme, intermédiaire, 30 min', { date: D, profile: { level: 'intermediate' }, equipment: [{ id: 'kettlebell', loads: [16] }], request: { minutes: 30 } }],
    ['Sangles de suspension + élastique + porte, intermédiaire, prise de muscle, 40 min', { date: D, profile: { goal: 'hypertrophy', level: 'intermediate' }, equipment: ['suspension-trainer', 'resistance-band', 'door'], request: { minutes: 40 } }],
];

const WEEKS: [string, Parameters<typeof planWeek>[0]][] = [
    ['Forme, 3 séances, tous les jours libres', { start: '2026-10-05', sessionsPerWeek: 3 }],
    ['Prise de muscle, avancé, 4 séances, sortie vélo de 2 h 30 le jeudi', { start: '2026-10-05', sessionsPerWeek: 4, profile: { goal: 'hypertrophy', level: 'advanced' }, activities: [{ date: '2026-10-08', type: 'bike', minutes: 150, intensity: 'hard' }] }],
    ['Perte de gras, 5 séances, libre lundi mardi jeudi samedi dimanche', { start: '2026-10-05', sessionsPerWeek: 5, profile: { goal: 'fat-loss' }, days: [1, 2, 4, 6, 7] }],
];

const out: string[] = ['# Séances générées pour relecture', ''];

SCENARIOS.forEach(([label, input], index) => {
    const session = generateSession(input);

    out.push(
        `## ${index + 1}. ${label}`,
        '',
        '```',
        sessionToText(session),
        '```',
        '',
        `Type ${session.type} · objectif ${session.goal} · niveau ${session.level} · intensité ${session.intensity} · ${session.estimatedMinutes} min estimées pour ${session.minutes} demandées · séries dures prévues par groupe : ${JSON.stringify(session.volume)}`,
        '',
    );
});

for (const [label, input] of WEEKS) {
    const week = planWeek(input);

    out.push(
        `## Semaine : ${label}`,
        '',
        week.reasons.map((entry) => `- ${entry.text}`).join('\n'),
        '',
        ...week.days.map(
            (day) =>
                `- ${day.date} (jour ${day.weekday}) : ${day.title}${day.minutes ? ` · ${day.minutes} min` : ''}${day.activities.length ? ` · activité ${day.activities.map((activity) => `${activity.type} ${activity.minutes} min`).join(', ')}` : ''}`,
        ),
        '',
    );
}

if (process.env.OUT) {
    writeFileSync(process.env.OUT, out.join('\n'));
} else {
    console.log(out.join('\n'));
}
