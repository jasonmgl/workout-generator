/**
 * La forme du jour : ce que disent le corps (pouls, sommeil, courbatures,
 * douleurs, cycle), le ressenti et la charge des jours passés, ramené à un
 * niveau (repos, récupération, léger, normal, à fond) et à des facteurs qui
 * règlent la séance.
 *
 * Les règles fortes passent d'abord : un repos déclaré, une maladie, un
 * pouls du matin à +10 % de sa base (règle de Pirie, reprise par DidIt) ou
 * sept jours d'affilée sans repos donnent un jour de repos. Ensuite vient la
 * note de forme, qui pèse chaque signal donné ; puis les ajustements fins
 * (ressenti de la dernière séance, cycle, charge qui monte trop vite).
 */
import { musclesOfAll, type JointId } from '../library/anatomy';
import type { Impact } from '../library/types';
import { daysBetween, dayOf } from '../dates';
import { trainingLoad } from '../history/load';
import { JOINT_NAMES, targetName } from '../i18n/fr/labels';
import { reason } from '../i18n/messages';
import type { JointLimitation, PastSession, Profile, ReadinessAssessment, ReadinessInput, ReadinessLevel, Reason } from '../types';

/** Un pouls à +10 % de sa base : pas d'entraînement ce jour-là. */
export const PULSE_ALERT_PERCENT = 10;
/** À partir de +5 %, on allège. */
export const PULSE_WATCH_PERCENT = 5;
/** Il faut au moins 4 matins pour faire une base, et on regarde les 21 derniers. */
export const PULSE_BASELINE_MINIMUM = 4;
export const PULSE_BASELINE_WINDOW = 21;
/** Sept jours d'affilée sans repos : le huitième, on récupère. */
export const MAX_DAYS_WITHOUT_REST = 7;
/** Au-delà de 7 jours sans séance, on reprend une marche en dessous. */
export const COMEBACK_DAYS = 7;

const LEVEL_SETTINGS: Readonly<Record<ReadinessLevel, { readonly volume: number; readonly intensity: number; readonly maxImpact: Impact }>> = {
    rest: { volume: 0.4, intensity: 0.7, maxImpact: 'none' },
    recovery: { volume: 0.5, intensity: 0.8, maxImpact: 'none' },
    easy: { volume: 0.75, intensity: 0.9, maxImpact: 'low' },
    normal: { volume: 1, intensity: 1, maxImpact: 'high' },
    push: { volume: 1.1, intensity: 1.05, maxImpact: 'high' },
};

const ORDER: readonly ReadinessLevel[] = ['rest', 'recovery', 'easy', 'normal', 'push'];
const IMPACT_ORDER: readonly Impact[] = ['none', 'low', 'high'];

const lowest = (a: ReadinessLevel, b: ReadinessLevel): ReadinessLevel => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);
const lowestImpact = (a: Impact, b: Impact): Impact => (IMPACT_ORDER.indexOf(a) <= IMPACT_ORDER.indexOf(b) ? a : b);

/** La médiane d'une liste non vide. */
const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** La note des heures de sommeil : 0 sous 5 h, 1 à partir de 8 h. */
const sleepHoursScore = (hours: number): number => Math.min(1, Math.max(0, (hours - 5) / 3));

export interface PulseStatus {
    readonly today?: number;
    readonly baseline?: number;
    /** L'écart du jour à la base, en pour cent arrondi. */
    readonly gap?: number;
    /** Un des deux matins précédents était en alerte. */
    readonly recentAlert: boolean;
}

/** Le pouls du matin contre sa base : la médiane des 21 derniers matins, sans celui du jour. */
export function pulseStatus(readiness: ReadinessInput, date: string): PulseStatus {
    const today = dayOf(date);
    const previous = [...(readiness.heartRateHistory ?? [])]
        .filter((reading) => daysBetween(reading.date, today) > 0 && reading.bpm > 0)
        .sort((a, b) => daysBetween(a.date, b.date))
        .slice(0, PULSE_BASELINE_WINDOW);
    const baseline =
        readiness.restingHeartRateBaseline ?? (previous.length >= PULSE_BASELINE_MINIMUM ? median(previous.map((reading) => reading.bpm)) : undefined);
    const gapOf = (bpm: number): number | undefined => (baseline ? Math.round(((bpm - baseline) / baseline) * 100) : undefined);
    const recentAlert = previous.slice(0, 2).some((reading) => (gapOf(reading.bpm) ?? 0) >= PULSE_ALERT_PERCENT);
    const bpm = readiness.restingHeartRate;
    const gap = bpm !== undefined ? gapOf(bpm) : undefined;

    return {
        ...(bpm !== undefined ? { today: bpm } : {}),
        ...(baseline !== undefined ? { baseline: Math.round(baseline) } : {}),
        ...(gap !== undefined ? { gap } : {}),
        recentAlert,
    };
}

/** Les articulations à ménager : les limitations durables et les douleurs du jour, la plus forte l'emportant. */
export function jointsToSpare(profile: Profile = {}, readiness: ReadinessInput = {}): JointLimitation[] {
    const worst = new Map<JointId, 1 | 2 | 3>();

    for (const entry of [...(profile.limitations ?? []), ...(readiness.pain ?? [])]) {
        worst.set(entry.joint, Math.max(worst.get(entry.joint) ?? 0, entry.severity) as 1 | 2 | 3);
    }

    return [...worst.entries()].map(([joint, severity]) => ({ joint, severity }));
}

export interface AssessInput {
    readonly date: string;
    readonly readiness?: ReadinessInput;
    readonly history?: readonly PastSession[];
    readonly restDays?: readonly string[];
    readonly profile?: Profile;
    readonly locale?: string;
}

export function assessReadiness(input: AssessInput): ReadinessAssessment {
    const readiness = input.readiness ?? {};
    const locale = input.locale ?? 'fr';
    const reasons: Reason[] = [];
    const warnings: Reason[] = [];
    const say = (code: string, params = {}): void => {
        reasons.push(reason(code, params, locale));
    };
    const warn = (code: string, params = {}): void => {
        warnings.push(reason(code, params, locale));
    };

    const load = trainingLoad(input.history ?? [], input.date, input.restDays ?? []);
    const pulse = pulseStatus(readiness, input.date);
    const declaredRest = readiness.restDay || (input.restDays ?? []).some((day) => dayOf(day) === dayOf(input.date));
    let level: ReadinessLevel = 'normal';
    let volume = 1;
    let maxImpact: Impact = 'high';
    let longWarmup = false;

    // La note de forme : la moyenne pondérée des signaux donnés.
    const signals: [number, number][] = [];

    if (readiness.energy !== undefined) signals.push([(readiness.energy - 1) / 4, 0.3]);

    const sleep = [
        ...(readiness.sleepQuality !== undefined ? [(readiness.sleepQuality - 1) / 4] : []),
        ...(readiness.sleepHours !== undefined ? [sleepHoursScore(readiness.sleepHours)] : []),
    ];

    if (sleep.length) signals.push([sleep.reduce((sum, value) => sum + value, 0) / sleep.length, 0.25]);
    if (readiness.stress !== undefined) signals.push([(5 - readiness.stress) / 4, 0.15]);
    if (readiness.soreness !== undefined) signals.push([(5 - readiness.soreness) / 4, 0.2]);
    if (readiness.motivation !== undefined) signals.push([(readiness.motivation - 1) / 4, 0.1]);

    const known =
        signals.length > 0 ||
        pulse.today !== undefined ||
        readiness.ill !== undefined ||
        readiness.cycle !== undefined ||
        (readiness.sore?.length ?? 0) > 0 ||
        (readiness.pain?.length ?? 0) > 0;
    const weightSum = signals.reduce((sum, [, weight]) => sum + weight, 0);
    const score = weightSum > 0 ? signals.reduce((sum, [value, weight]) => sum + value * weight, 0) / weightSum : 0.65;

    if (weightSum > 0) {
        if (score < 0.25) {
            level = 'recovery';
            say('feeling-low');
        } else if (score < 0.45) {
            level = 'easy';
            say('feeling-tired');
        } else if (score >= 0.8 && (readiness.energy ?? 5) >= 4 && (readiness.soreness ?? 1) <= 2) {
            level = 'push';
            say('feeling-great');
        }
    }

    if (readiness.sleepHours !== undefined && readiness.sleepHours < 5) {
        level = lowest(level, 'easy');
        say('short-sleep', { hours: readiness.sleepHours });
    }

    // Le pouls du matin.
    if (pulse.gap !== undefined && pulse.baseline !== undefined && pulse.today !== undefined) {
        if (pulse.gap >= PULSE_ALERT_PERCENT) {
            level = 'rest';
            say('pulse-high', { gap: pulse.gap, bpm: pulse.today, baseline: pulse.baseline });
        } else if (pulse.recentAlert) {
            level = lowest(level, 'easy');
            say('pulse-recovering');
        } else if (pulse.gap >= PULSE_WATCH_PERCENT) {
            level = lowest(level, 'easy');
            say('pulse-raised', { gap: pulse.gap });
        }
    }

    // La charge des jours passés.
    if (load.daysWithoutRest >= MAX_DAYS_WITHOUT_REST) {
        level = 'rest';
        say('no-rest-streak', { days: load.daysWithoutRest });
    }

    if (load.ratio !== undefined && load.ratio >= 1.5) {
        level = lowest(level, 'easy');
        volume *= 0.85;
        warn('load-spike', { ratio: load.ratio });
    } else if (load.ratio !== undefined && load.ratio >= 1.3) {
        warn('load-rising', { ratio: load.ratio });
    }

    if (load.daysSinceLast !== undefined && load.daysSinceLast > COMEBACK_DAYS && load.known > 0) {
        volume *= 0.8;
        say('comeback', { days: load.daysSinceLast });
    }

    if (load.lastEffort === 'hard') {
        volume *= 0.85;
        say('last-hard');
    } else if (load.lastEffort === 'easy') {
        volume *= 1.05;
        say('last-easy');
    }

    // Le cycle, quand la personne choisit de le donner.
    const cycle = readiness.cycle;

    if (cycle?.phase === 'menstrual') {
        if ((cycle.symptoms ?? 0) >= 2) {
            level = lowest(level, 'easy');
            maxImpact = lowestImpact(maxImpact, 'low');
            say('cycle-period');
        } else {
            volume *= 0.9;
            say('cycle-period-light');
        }
    } else if (cycle?.phase === 'luteal') {
        volume *= 0.95;
        say('cycle-luteal');
    } else if (cycle?.phase === 'follicular') {
        say('cycle-follicular');
    } else if (cycle?.phase === 'ovulation') {
        longWarmup = true;
        say('cycle-ovulation');
    }

    // Les articulations et les courbatures.
    const joints = jointsToSpare(input.profile, readiness);

    if (joints.length) {
        say('joint-pain', { joints: joints.map((entry) => JOINT_NAMES[entry.joint].toLowerCase()).join(', ') });
    }

    if (joints.some((entry) => ['knees', 'ankles', 'hips', 'lower-back'].includes(entry.joint) && entry.severity >= 2)) {
        maxImpact = lowestImpact(maxImpact, 'low');
    }

    if (readiness.sore?.length) {
        const targets = [...new Set(readiness.sore.map((entry) => entry.target))];

        // Une cible inconnue lève une erreur ici plutôt que de passer inaperçue.
        musclesOfAll(targets);
        say('sore', { targets: targets.map((target) => targetName(target).toLowerCase()).join(', ') });
    }

    // Les règles qui ne se discutent pas, en dernier pour avoir le dernier mot.
    if (readiness.ill) {
        level = 'rest';
        say('ill');
    }

    if (declaredRest) {
        level = 'rest';
        say('declared-rest');
    }

    const settings = LEVEL_SETTINGS[level];

    return {
        score: Math.round(score * 1000) / 1000,
        level,
        volume: Math.round(Math.min(1.15, Math.max(0.4, settings.volume * volume)) * 100) / 100,
        intensity: settings.intensity,
        maxImpact: lowestImpact(settings.maxImpact, maxImpact),
        joints,
        longWarmup,
        known,
        reasons,
        warnings,
    };
}
