// Utility: generate questions by subtopic and level

export type Topic = "math" | "science" | "japanese" | "reading" | "ACT" | "korean" | "history" | "ISEE";
export type Subtopic = "addition" | "subtraction" | "multiplication" | "integers" | "squares_roots" | "trigonometry" | "trig_identities" | "geometry" | "equations" | "distribution" | "fraction_decimal_ops" | "biology" | "human_body" | "cells" | "dna" | "natural_selection" | "light" | "units" | "botany" | "ecosystems" | "kanji" | "sight_words" | "story_reader" | "math_section" | "science_section" | "reading_section" | "english_section" | "like_terms" | "hangul" | "us_history" | "quantitative_reasoning";
export type SubtopicLevel = 1 | 2 | 3;

export interface Question {
    display: string;
    answer: string | string[];
    type: "math" | "text";
}

// Backward-compat alias
export type MathQuestion = Question;

export const TOPIC_LABELS: Record<Topic, string> = {
    math: "Math",
    science: "Science",
    japanese: "Japanese",
    reading: "Reading",
    ACT: "ACT",
    korean: "Korean",
    history: "History",
    ISEE: "ISEE",
};

export const SUBTOPIC_LABELS: Record<Subtopic, string> = {
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
    integers: "Integers",
    squares_roots: "Squares/Roots",
    trigonometry: "Trigonometry",
    trig_identities: "Trig Identities",
    geometry: "Geometry",
    equations: 'Equations',
    distribution: 'Distribution',
    fraction_decimal_ops: 'Fraction & Decimal Ops',
    biology: "Biology",
    human_body: "Human Body",
    cells: "Cells",
    dna: "DNA",
    natural_selection: "Natural Selection",
    light: "Light",
    units: "Units",
    botany: "Botany",
    ecosystems: "Ecosystems",
    kanji: "Kanji",
    sight_words: "Sight Words",
    story_reader: "Story Reader",
    math_section: "Math Section",
    science_section: "Science Section",
    reading_section: "Reading Section",
    english_section: "English Section",
    like_terms: "Combine Like Terms",
    hangul: "Hangul",
    us_history: "United States",
    quantitative_reasoning: "Quantitative Reasoning",
};

export const TOPIC_SUBTOPICS: Record<Topic, Subtopic[]> = {
    math: ["addition", "subtraction", "multiplication", "integers", "squares_roots", "trigonometry", "equations", "distribution", "fraction_decimal_ops"],
    science: [],
    japanese: [],
    reading: ["story_reader"],
    ACT: [],
    korean: [],
    history: [],
    ISEE: ["quantitative_reasoning"],
};

export const SUBTOPIC_TO_TOPIC = Object.fromEntries(
    (Object.entries(TOPIC_SUBTOPICS) as [Topic, Subtopic[]][]
    ).flatMap(([t, ss]) => ss.map(s => [s, TOPIC_LABELS[t]]))
) as Record<Subtopic, string>;

export const SUBTOPIC_LEVEL_BONUS: Record<Subtopic, Record<SubtopicLevel, number>> = {
    addition: { 1: 0, 2: 20, 3: 50 },
    subtraction: { 1: 0, 2: 50, 3: 100 },
    multiplication: { 1: 0, 2: 50, 3: 100 },
    integers: { 1: 0, 2: 50, 3: 100 },
    squares_roots: { 1: 0, 2: 50, 3: 100 },
    trigonometry: { 1: 0, 2: 50, 3: 100 },
    trig_identities: { 1: 0, 2: 50, 3: 100 },
    geometry: { 1: 0, 2: 50, 3: 100 },
    equations: { 1: 0, 2: 50, 3: 100 },
    distribution: { 1: 0, 2: 50, 3: 100 },
    fraction_decimal_ops: { 1: 0, 2: 50, 3: 100 },
    biology: { 1: 0, 2: 50, 3: 100 },
    human_body: { 1: 0, 2: 50, 3: 100 },
    cells: { 1: 0, 2: 50, 3: 100 },
    dna: { 1: 0, 2: 50, 3: 100 },
    natural_selection: { 1: 0, 2: 50, 3: 100 },
    kanji: { 1: 0, 2: 50, 3: 100 },
    sight_words: { 1: 0, 2: 50, 3: 100 },
    story_reader: { 1: 0, 2: 50, 3: 100 },
    math_section: { 1: 0, 2: 50, 3: 100 },
    science_section: { 1: 0, 2: 50, 3: 100 },
    reading_section: { 1: 0, 2: 50, 3: 100 },
    english_section: { 1: 0, 2: 50, 3: 100 },
    like_terms: { 1: 0, 2: 50, 3: 100 },
    light: { 1: 0, 2: 50, 3: 100 },
    units: { 1: 0, 2: 50, 3: 100 },
    botany: { 1: 0, 2: 50, 3: 100 },
    ecosystems: { 1: 0, 2: 50, 3: 100 },
    hangul: { 1: 0, 2: 50, 3: 100 },
    us_history: { 1: 0, 2: 50, 3: 100 },
    quantitative_reasoning: { 1: 0, 2: 50, 3: 100 },
};

const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

function pick<T>(arr: T[]): T {
    return arr[rand(0, arr.length - 1)];
}

function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
}

// --- Math generators ---

function genIntegers(level: SubtopicLevel): Question {
    if (level === 1) {
        // Multiply and divide integers, magnitudes 1–14
        const a = rand(1, 14);
        const b = rand(1, 14);
        const va = (Math.random() < 0.5 ? 1 : -1) * a;
        const vb = (Math.random() < 0.5 ? 1 : -1) * b;
        const fmtN = (n: number) => n < 0 ? `(${n})` : String(n);
        if (Math.random() < 0.5) {
            // multiplication
            return { display: `${fmtN(va)} × ${fmtN(vb)}`, answer: String(va * vb), type: 'math' };
        } else {
            // division — build from the product so it's always a clean integer
            const product = va * vb;
            const [divisor, quotient] = Math.random() < 0.5 ? [va, vb] : [vb, va];
            return { display: `${fmtN(product)} ÷ ${fmtN(divisor)}`, answer: String(quotient), type: 'math' };
        }
    }
    if (level === 2) {
        // Forms: -a + b  |  b - a  |  -b - a  |  a + (-b)  |  -a + (-b)  (magnitudes 1–20)
        const a = rand(1, 20);
        const b = rand(1, 20);
        const form = pick(['-a+b', 'b-a', '-b-a', 'a+(-b)', '-a+(-b)'] as const);
        if (form === '-a+b') return { display: `-${a} + ${b}`, answer: String(-a + b), type: 'math' };
        if (form === 'b-a') return { display: `${b} - ${a}`, answer: String(b - a), type: 'math' };
        if (form === 'a+(-b)') return { display: `${a} + (-${b})`, answer: String(a - b), type: 'math' };
        if (form === '-a+(-b)') return { display: `-${a} + (-${b})`, answer: String(-a - b), type: 'math' };
        /* -b - a */             return { display: `-${b} - ${a}`, answer: String(-b - a), type: 'math' };
    }
    // level 3: -a - (-b)  |  a - (-b)  (double-negative forms)
    const a = rand(1, 20);
    const b = rand(1, 20);
    if (Math.random() < 0.5) {
        return { display: `-${a} - (-${b})`, answer: String(-a + b), type: 'math' };
    }
    return { display: `${a} - (-${b})`, answer: String(a + b), type: 'math' };
}

function genAddition(level: SubtopicLevel): Question {
    if (level === 1) {
        const a = rand(1, 10), b = rand(1, 10);
        return { display: `${a} + ${b}`, answer: String(a + b), type: "math" };
    }
    if (level === 2) {
        const a = rand(1, 20), b = rand(1, 20);
        return { display: `${a} + ${b}`, answer: String(a + b), type: "math" };
    }
    // level 3: three-number addition
    const a = rand(1, 100), b = rand(1, 100)
    return { display: `${a} + ${b}`, answer: String(a + b), type: "math" };
}

function genSubtraction(level: SubtopicLevel): Question {
    if (level === 1) {
        const a = rand(5, 10), b = rand(1, a);
        return { display: `${a} − ${b}`, answer: String(a - b), type: "math" };
    }
    if (level === 2) {
        const a = rand(5, 100), b = rand(1, a);
        return { display: `${a} − ${b}`, answer: String(a - b), type: "math" };
    }
    // level 3: multi-step subtraction
    const a = rand(100, 500);
    const b = rand(1, Math.floor(a / 3));
    return { display: `${a} − ${b}`, answer: String(a - b), type: "math" };
}

function genMultiplication(level: SubtopicLevel): Question {
    if (level === 1) {
        // Single digit × single digit up to 12×12
        const a = rand(1, 12), b = rand(1, 12);
        return { display: `${a} × ${b}`, answer: String(a * b), type: "math" };
    }
    if (level === 2) {
        // Single digit × double digit, with ~40% chance one factor is negative
        const a = rand(2, 9), b = rand(10, 99);
        const negA = Math.random() < 0.4;
        const negB = !negA && Math.random() < 0.4;
        const va = negA ? -a : a;
        const vb = negB ? -b : b;
        const fmtN = (n: number) => n < 0 ? `(${n})` : String(n);
        // randomise order so it isn't always small × big
        const [x, y] = Math.random() < 0.5 ? [fmtN(va), fmtN(vb)] : [fmtN(vb), fmtN(va)];
        return { display: `${x} × ${y}`, answer: String(va * vb), type: "math" };
    }
    // level 3: double digit × double digit, or double × triple digit
    if (Math.random() < 0.5) {
        const a = rand(11, 99), b = rand(11, 99);
        return { display: `${a} × ${b}`, answer: String(a * b), type: "math" };
    }
    const a = rand(11, 99), b = rand(100, 999);
    const [x, y] = Math.random() < 0.5 ? [a, b] : [b, a];
    return { display: `${x} × ${y}`, answer: String(a * b), type: "math" };
}

function genDistribution(level: SubtopicLevel): Question {
    if (level === 1) {
        const a = rand(2, 6);
        const b = rand(1, 6);
        const c = rand(1, 8);
        const answer = `${a * b}x + ${a * c}`;
        return { display: `${a}(${b}x + ${c})`, answer, type: "math" };
    }
    if (level === 2) {
        const a = rand(2, 6);
        const b = rand(2, 8);
        const c = rand(1, 7);
        const negativeTerm = Math.random() < 0.5;
        const expr = negativeTerm ? `${a}(${b}x - ${c})` : `${a}(${c} - ${b}x)`;
        const expanded = negativeTerm ? `${a * b}x - ${a * c}` : `${a * c} - ${a * b}x`;
        return { display: expr, answer: expanded, type: "math" };
    }
    const a = rand(2, 5);
    const b = rand(2, 6);
    const c = rand(1, 5);
    const d = rand(1, 5);
    const form = pick(["double_binomial", "mixed_signs"] as const);
    if (form === "double_binomial") {
        const expr = `(${a}x + ${b})(${c}x + ${d})`;
        const answer = `${a * c}x^2 + ${(a * d) + (b * c)}x + ${b * d}`;
        return { display: expr, answer, type: "math" };
    }
    const expr = `${a}( ${b}x - ${c})(${d}x + 2)`;
    const answer = `${a * b * d}x^2 + ${a * (2 * b - c * d)}x - ${a * 2 * c}`;
    return { display: expr, answer, type: "math" };
}

function simplifyFraction(num: number, denom: number): [number, number] {
    const sign = denom < 0 ? -1 : 1;
    num *= sign; denom *= sign;
    const d = gcd(Math.abs(num), Math.abs(denom)) || 1;
    return [num / d, denom / d];
}

// Returns a terminating decimal string, or null if the fraction repeats (denom has factors other than 2/5)
function terminatingDecimalString(num: number, denom: number): string | null {
    let d = Math.abs(denom);
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d !== 1) return null;
    return String(Math.round((num / denom) * 10000) / 10000);
}

function fractionAnswer(num: number, denom: number): string[] {
    const [n, d] = simplifyFraction(num, denom);
    const answers = new Set<string>();
    if (d === 1) {
        answers.add(String(n));
        return Array.from(answers);
    }
    answers.add(`${n}/${d}`);
    if (Math.abs(n) > d) {
        const whole = Math.trunc(n / d);
        const rem = Math.abs(n % d);
        if (rem !== 0) answers.add(`${whole} ${rem}/${d}`);
    }
    const dec = terminatingDecimalString(n, d);
    if (dec) answers.add(dec);
    return Array.from(answers);
}

function genFractionDecimalOps(level: SubtopicLevel): Question {
    if (level === 1) {
        // same-denominator fraction addition/subtraction
        const denom = pick([2, 3, 4, 5, 6, 8, 10, 12]);
        let num1 = rand(1, denom - 1);
        let num2 = rand(1, denom - 1);
        const isAdd = Math.random() < 0.6;
        if (!isAdd && num1 < num2) [num1, num2] = [num2, num1];
        const display = `${num1}/${denom} ${isAdd ? "+" : "−"} ${num2}/${denom}`;
        const resultNum = isAdd ? num1 + num2 : num1 - num2;
        return { display, answer: fractionAnswer(resultNum, denom), type: "math" };
    }
    if (level === 2) {
        if (Math.random() < 0.5) {
            // different-denominator fraction addition/subtraction
            const denom1 = pick([2, 3, 4, 5, 6]);
            const denom2 = pick([2, 3, 4, 5, 6, 7, 8]);
            const num1 = rand(1, denom1 - 1);
            const num2 = rand(1, denom2 - 1);
            const isAdd = Math.random() < 0.6;
            const display = `${num1}/${denom1} ${isAdd ? "+" : "−"} ${num2}/${denom2}`;
            const commonDenom = denom1 * denom2;
            let resultNum = isAdd
                ? num1 * denom2 + num2 * denom1
                : num1 * denom2 - num2 * denom1;
            if (resultNum < 0) resultNum = -resultNum;
            return { display, answer: fractionAnswer(resultNum, commonDenom), type: "math" };
        }
        // decimal addition/subtraction, 2 decimal places
        const a = rand(100, 999) / 100;
        let b = rand(100, 999) / 100;
        const isAdd = Math.random() < 0.6;
        let x = a, y = b;
        if (!isAdd && x < y) [x, y] = [y, x];
        const display = `${x.toFixed(2)} ${isAdd ? "+" : "−"} ${y.toFixed(2)}`;
        const result = Math.round((isAdd ? x + y : x - y) * 100) / 100;
        return { display, answer: String(result), type: "math" };
    }
    // level 3: multiply/divide fractions, or convert between fraction and decimal
    const mode = pick(["multiply", "divide", "convert"] as const);
    if (mode === "multiply") {
        const d1 = pick([2, 3, 4, 5, 6, 7, 8]);
        const d2 = pick([2, 3, 4, 5, 6, 7, 8]);
        const n1 = rand(1, d1 - 1);
        const n2 = rand(1, d2 - 1);
        return { display: `${n1}/${d1} × ${n2}/${d2}`, answer: fractionAnswer(n1 * n2, d1 * d2), type: "math" };
    }
    if (mode === "divide") {
        const d1 = pick([2, 3, 4, 5, 6, 7, 8]);
        const d2 = pick([2, 3, 4, 5, 6, 7, 8]);
        const n1 = rand(1, d1 - 1);
        const n2 = rand(1, d2 - 1);
        return { display: `${n1}/${d1} ÷ ${n2}/${d2}`, answer: fractionAnswer(n1 * d2, d1 * n2), type: "math" };
    }
    const denom = pick([2, 4, 5, 8, 10, 20, 25, 50]);
    const num = rand(1, denom - 1);
    const dec = terminatingDecimalString(num, denom)!;
    if (Math.random() < 0.5) {
        return { display: `Convert ${num}/${denom} to a decimal.`, answer: dec, type: "math" };
    }
    return { display: `Convert ${dec} to a fraction (simplest form).`, answer: fractionAnswer(num, denom), type: "math" };
}

// --- Science question banks ---
// NOTE: hardcoded bank data below is commented out — this content is being migrated
// to user-created custom training series (see TrainingSeriesBuilder / customTrainingService).
// Left in place for manual reference while that migration happens.
type QBank = Array<[string, string | string[]]>;

export type QuestionHistory = Record<string, {
    correct: number;
    incorrect: number;
}>;

const CORRECT_WEIGHT_PENALTY = 0.85;
const INCORRECT_WEIGHT_BONUS = 12;
const MIN_WEIGHT = 0.05;
const TEXT_BANKS: Record<string, [QBank, QBank, QBank]> = {};

function genFromBank(bank: QBank): Question {
    const [display, answer] = pick(bank);
    return { display, answer, type: "text" };
}

function getWeightedBankQuestion(bank: QBank, history?: QuestionHistory): [string, string | string[]] {
    if (!history) {
        return pick(bank);
    }

    const weighted = bank.map(([display, answer]) => {
        const stats = history[display];
        const correct = stats?.correct ?? 0;
        const incorrect = stats?.incorrect ?? 0;
        const weight = Math.max(
            MIN_WEIGHT,
            1 - (correct * CORRECT_WEIGHT_PENALTY) + (incorrect * INCORRECT_WEIGHT_BONUS)
        );
        return { display, answer, weight };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) {
        return pick(bank);
    }

    let cursor = Math.random() * totalWeight;
    for (const entry of weighted) {
        cursor -= entry.weight;
        if (cursor <= 0) {
            return [entry.display, entry.answer];
        }
    }

    const last = weighted[weighted.length - 1];
    return [last.display, last.answer];
}

// Radical symbol for display
const SQRT = "√";

function genSquaresRoots(level: SubtopicLevel): Question {
    if (level === 1) {
        // n² for n = 1..15  (type the result)
        const n = rand(1, 15);
        return { display: `${n}²`, answer: String(n * n), type: "math" };
    }
    if (level === 2) {
        // √ of perfect squares up to √225
        const bases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const n = pick(bases);
        return { display: `${SQRT}${n * n}`, answer: String(n), type: "math" };
    }
    // level 3: mix of larger squares (n² for n = 10..25),
    //          higher powers (n^3, n^4 for small n),
    //          and √ of those larger perfect squares
    const kind = pick(["sq", "pow3", "pow4", "sqrt_large"] as const);
    if (kind === "sq") {
        const n = rand(10, 25);
        return { display: `${n}²`, answer: String(n * n), type: "math" };
    }
    if (kind === "pow3") {
        const n = rand(2, 8);
        return { display: `${n}³`, answer: String(n ** 3), type: "math" };
    }
    if (kind === "pow4") {
        const n = rand(2, 5);
        return { display: `${n}⁴`, answer: String(n ** 4), type: "math" };
    }
    // sqrt_large: √ of a perfect square for n = 10..25
    const n = rand(10, 25);
    return { display: `${SQRT}${n * n}`, answer: String(n), type: "math" };
}

// --- Trigonometry ---

const TRIG_L1: Array<[string, string | string[]]> = [
    ["What ratio does sin equal?", ["opposite/hypotenuse", "opp/hyp", "o/h"]],
    ["What ratio does cos equal?", ["adjacent/hypotenuse", "adj/hyp", "a/h"]],
    ["What ratio does tan equal?", ["opposite/adjacent", "opp/adj", "o/a"]],
    ["What ratio does csc equal?", ["hypotenuse/opposite", "hyp/opp", "h/o"]],
    ["What ratio does sec equal?", ["hypotenuse/adjacent", "hyp/adj", "h/a"]],
    ["What ratio does cot equal?", ["adjacent/opposite", "adj/opp", "a/o"]],
    ['Which trig function is the ratio of opposite to hypotenuse?', ["sin", "sine"]],
    ['Which trig function is the ratio of adjacent to hypotenuse?', ["cos", "cosine"]],
    ['Which trig function is the ratio of opposite to adjacent?', ["tan", "tangent"]],
    ['Which trig function is the ratio of hypotenuse to opposite?', ["csc", "cosecant"]],
    ['Which trig function is the ratio of hypotenuse to adjacent?', ["sec", "secant"]],
    ['Which trig function is the ratio of adjacent to opposite?', ["cot", "cotangent"]],
    ['Which trig function is the reciprocal of sin?', ["csc", "cosecant"]],
    ['Which trig function is the reciprocal of cos?', ["sec", "secant"]],
    ['Which trig function is the reciprocal of tan?', ["cot", "cotangent"]],
    ["csc is the reciprocal of which trig function?", ["sin", "sine"]],
    ["sec is the reciprocal of which trig function?", ["cos", "cosine"]],
    ["cot is the reciprocal of which trig function?", ["tan", "tangent"]],
    ["In a 30-60-90 triangle, the side across from 30° equals?", "x"],
    ["In a 30-60-90 triangle, the side across from 60° equals?", ["x√3", "xroot3", "x·√3", "xsqrt3"]],
    ["In a 30-60-90 triangle, the hypotenuse (across from 90°) equals?", "2x"],
    ["In a 45-45-90 triangle, each leg (across from 45°) equals?", "x"],
    ["In a 45-45-90 triangle, the hypotenuse (across from 90°) equals?", ["x√2", "xroot2", "x·√2", "xsqrt2"]],
    ["What are the two shorter sides of a right triangle called?", "legs"],
    ["What is the longest side of a right triangle called?", "hypotenuse"],
    ["Which side of a right triangle is opposite the right angle?", "hypotenuse"],
];

const TRIG_L2: Array<[string, string | string[]]> = [
    ["sin(0°)", ["0"]],
    ["sin(30°)", ["1/2", "0.5"]],
    ["sin(45°)", ["√2/2", "root2/2", "sqrt(2)/2", "sqrt2/2"]],
    ["sin(60°)", ["√3/2", "root3/2", "sqrt(3)/2", "sqrt3/2"]],
    ["sin(90°)", ["1"]],
    ["cos(0°)", ["1"]],
    ["cos(30°)", ["√3/2", "root3/2", "sqrt(3)/2", "sqrt3/2"]],
    ["cos(45°)", ["√2/2", "root2/2", "sqrt(2)/2", "sqrt2/2"]],
    ["cos(60°)", ["1/2", "0.5"]],
    ["cos(90°)", ["0"]],
    ["tan(0°)", ["0"]],
    ["tan(30°)", ["√3/3", "root3/3", "sqrt(3)/3", "sqrt3/3", "1/√3", "1/root3"]],
    ["tan(45°)", ["1"]],
    ["tan(60°)", ["√3", "root3", "sqrt(3)", "sqrt3"]],
    ["tan(90°)", ["undefined", "undef"]],
    ["sin(pi/6)", ["1/2", "0.5"]],
    ["sin(pi/4)", ["√2/2", "root2/2", "sqrt(2)/2", "sqrt2/2"]],
    ["sin(pi/3)", ["√3/2", "root3/2", "sqrt(3)/2", "sqrt3/2"]],
    ["sin(pi/2)", ["1"]],
    ["cos(pi/6)", ["√3/2", "root3/2", "sqrt(3)/2", "sqrt3/2"]],
    ["cos(pi/4)", ["√2/2", "root2/2", "sqrt(2)/2", "sqrt2/2"]],
    ["cos(pi/3)", ["1/2", "0.5"]],
    ["cos(pi/2)", ["0"]],
    ["tan(pi/6)", ["√3/3", "root3/3", "sqrt(3)/3", "sqrt3/3", "1/√3", "1/root3"]],
    ["tan(pi/4)", ["1"]],
    ["tan(pi/3)", ["√3", "root3", "sqrt(3)", "sqrt3"]],
    ["tan(pi/2)", ["undefined", "undef"]],
];

const TRIG_L3: Array<[string, string | string[]]> = [
    ["csc(30°)", ["2"]],
    ["csc(45°)", ["√2", "root2", "sqrt(2)", "sqrt2"]],
    ["csc(60°)", ["2√3/3", "2root3/3", "2/√3", "2/root3"]],
    ["csc(90°)", ["1"]],
    ["sec(0°)", ["1"]],
    ["sec(30°)", ["2√3/3", "2root3/3", "2/√3", "2/root3"]],
    ["sec(45°)", ["√2", "root2", "sqrt(2)", "sqrt2"]],
    ["sec(60°)", ["2"]],
    ["cot(30°)", ["√3", "root3", "sqrt(3)", "sqrt3"]],
    ["cot(45°)", ["1"]],
    ["cot(60°)", ["√3/3", "root3/3", "sqrt(3)/3", "sqrt3/3", "1/√3", "1/root3"]],
    ["cot(90°)", ["0"]],
    ["csc(pi/6)", ["2"]],
    ["csc(pi/4)", ["√2", "root2", "sqrt(2)", "sqrt2"]],
    ["csc(pi/3)", ["2√3/3", "2root3/3", "2/√3", "2/root3"]],
    ["csc(pi/2)", ["1"]],
    ["sec(0)", ["1"]],
    ["sec(pi/6)", ["2√3/3", "2root3/3", "2/√3", "2/root3"]],
    ["sec(pi/4)", ["√2", "root2", "sqrt(2)", "sqrt2"]],
    ["sec(pi/3)", ["2"]],
    ["cot(pi/6)", ["√3", "root3", "sqrt(3)", "sqrt3"]],
    ["cot(pi/4)", ["1"]],
    ["cot(pi/3)", ["√3/3", "root3/3", "sqrt(3)/3", "sqrt3/3", "1/√3", "1/root3"]],
    ["cot(pi/2)", ["0"]],
];

function genTrigonometry(level: SubtopicLevel): Question {
    if (level === 1) {
        const [display, answer] = pick(TRIG_L1);
        return { display, answer, type: "text" };
    }
    if (level === 2) {
        const [display, answer] = pick(TRIG_L2);
        return { display, answer, type: "math" };
    }
    const [display, answer] = pick(TRIG_L3);
    return { display, answer, type: "math" };
}

// --- ISEE: Quantitative Reasoning ---

// [context, groupA label, groupB label, shared category noun]
const QR_PAIR_SCENARIOS: Array<[string, string, string, string]> = [
    ["A school", "sixth-grade students", "seventh-grade students", "students"],
    ["A school", "seventh-grade students", "eighth-grade students", "students"],
    ["A pet store", "dogs", "cats", "animals"],
    ["A bakery", "chocolate cupcakes", "vanilla cupcakes", "cupcakes"],
    ["A movie theater", "comedy movies", "drama movies", "movies"],
    ["A jar", "red marbles", "blue marbles", "marbles"],
    ["A library", "fiction books", "nonfiction books", "books"],
    ["A parking lot", "cars", "trucks", "vehicles"],
];

// [context, groupA, groupB, groupC label, shared category noun]
const QR_TRIO_SCENARIOS: Array<[string, string, string, string, string]> = [
    ["A school", "sixth-grade students", "seventh-grade students", "eighth-grade students", "students"],
    ["A zoo", "lions", "tigers", "bears", "animals"],
    ["A bakery", "chocolate cupcakes", "vanilla cupcakes", "strawberry cupcakes", "cupcakes"],
    ["A parking lot", "cars", "trucks", "vans", "vehicles"],
];

const QR_STORE_ITEMS = ["phones", "books", "shirts", "chairs", "laptops", "backpacks"];

function genQuantitativeReasoningL1(): Question {
    const [context, a, b] = pick(QR_PAIR_SCENARIOS);
    const ratio = pick([2, 3, 4, 5]);
    const x = rand(3, 25); // count of group B
    const diff = x * (ratio - 1); // how many more group A than group B
    const display = `${context} has **${ratio} times as many ${a} as ${b}**. There are **${diff} more ${a} than ${b}**.\n\nHow many ${b} are there?`;
    return { display, answer: String(x), type: "text" };
}

function genQuantitativeReasoningL2(): Question {
    const [context, a, b, noun] = pick(QR_PAIR_SCENARIOS);
    if (Math.random() < 0.5) {
        // Ratio of two parts given the total.
        const p = rand(2, 6);
        let q = rand(2, 6);
        while (q === p) q = rand(2, 6);
        const k = rand(2, 10);
        const total = (p + q) * k;
        const bCount = q * k;
        const display = `${context} has a ratio of ${a} to ${b} of **${p}:${q}**. If there are **${total} ${noun} in total**, how many ${b} are there?`;
        return { display, answer: String(bCount), type: "text" };
    }
    // Percent of a total, find the remainder group.
    const percent = pick([10, 20, 25, 50]);
    const denom = 100 / gcd(100, percent);
    const k = rand(2, 9);
    const total = k * denom;
    const aCount = (total * percent) / 100;
    const bCount = total - aCount;
    const display = `${context} has **${total} ${noun}**. **${percent}%** of them are ${a}. How many ${b} are there?`;
    return { display, answer: String(bCount), type: "text" };
}

function genQuantitativeReasoningL3(): Question {
    if (Math.random() < 0.5) {
        // Three-part ratio given the total.
        const [context, a, b, c, noun] = pick(QR_TRIO_SCENARIOS);
        const p = rand(2, 5);
        const q = rand(2, 5);
        const r = rand(2, 5);
        const k = rand(2, 8);
        const total = (p + q + r) * k;
        const options: Array<[string, number]> = [[a, p * k], [b, q * k], [c, r * k]];
        const [label, count] = pick(options);
        const display = `${context} has a ratio of ${a}:${b}:${c} of **${p}:${q}:${r}**. If there are **${total} ${noun} in total**, how many ${label} are there?`;
        return { display, answer: String(count), type: "text" };
    }
    // Two-step percent change: a decrease, then an increase applied to the remainder.
    const noun = pick(QR_STORE_ITEMS);
    const percentDown = pick([20, 40, 60]);
    const percentUp = pick([20, 40, 60]);
    const k = rand(2, 5);
    const start = k * 100;
    const afterDecrease = (start * (100 - percentDown)) / 100;
    const final = (afterDecrease * (100 + percentUp)) / 100;
    const display = `A store has **${start} ${noun}**. After a **${percentDown}% decrease**, the store receives a shipment that increases the amount by **${percentUp}%**.\n\nHow many ${noun} are there now?`;
    return { display, answer: String(final), type: "text" };
}

function genQuantitativeReasoning(level: SubtopicLevel): Question {
    if (level === 1) return genQuantitativeReasoningL1();
    if (level === 2) return genQuantitativeReasoningL2();
    return genQuantitativeReasoningL3();
}

export function generateQuestion(subtopic: Subtopic, level: SubtopicLevel, history?: QuestionHistory): Question {
    switch (subtopic) {
        case "addition": return genAddition(level);
        case "subtraction": return genSubtraction(level);
        case "multiplication": return genMultiplication(level);
        case "integers": return genIntegers(level);
        case "distribution": return genDistribution(level);
        case "fraction_decimal_ops": return genFractionDecimalOps(level);
        case "squares_roots": return genSquaresRoots(level);
        case "trigonometry": return genTrigonometry(level);
        case "quantitative_reasoning": return genQuantitativeReasoning(level);
        default: {
            const bank = TEXT_BANKS[subtopic];
            if (!bank) {
                return { display: "This subtopic's questions haven't been migrated to the custom builder yet.", answer: [""], type: "text" };
            }
            const [display, answer] = getWeightedBankQuestion(bank[level - 1], history);
            return { display, answer, type: "text" };
        }
    }
}

// Picks a weighted-random question from a user-created custom training series' question list
export function pickWeightedCustomQuestion(
    items: Array<{ display: string; answers: string[] }>,
    history?: QuestionHistory
): Question {
    const bank: QBank = items.map(i => [i.display, i.answers]);
    const [display, answer] = getWeightedBankQuestion(bank, history);
    return { display, answer, type: "text" };
}

