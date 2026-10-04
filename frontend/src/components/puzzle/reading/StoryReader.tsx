import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryQ {
    q: string;
    a: string | string[];
}

interface StoryEntry {
    id: string;
    level: 1 | 2 | 3;
    title: string;
    text: string;
    questions: StoryQ[];
}

// ─── Story Bank ───────────────────────────────────────────────────────────────

const STORIES: StoryEntry[] = [
    // ── Level 1 ──────────────────────────────────────────────────────────────
    {
        id: 'max-the-dog',
        level: 1,
        title: 'Max the Dog',
        text: 'Max is a small brown dog. He lives with a girl named Lucy. Every morning, Max wags his tail when Lucy wakes up. One day, Lucy forgot to feed Max his breakfast. Max sat by his bowl and looked at Lucy with big eyes. Lucy laughed and filled the bowl with food. Max ate quickly and then licked Lucy\'s hand. Lucy smiled and gave him a hug. Max was a very happy dog.',
        questions: [
            { q: 'What color is Max?', a: 'brown' },
            { q: 'Who does Max live with?', a: ['lucy', 'a girl named lucy'] },
            { q: 'What did Lucy forget to do?', a: ['feed max','she forgot to feed Max','she forgot to feed him', 'feed max breakfast', 'give max food', 'feed him'] },
            { q: 'What did Max do right after he ate?', a: ['licked lucy\'s hand', 'licked her hand', 'licked lucys hand', 'licked lucy'] },
        ],
    },
    {
        id: 'rainy-day',
        level: 1,
        title: 'The Rainy Day',
        text: 'Sam looked out the window. It was raining hard. He wanted to play outside, but the rain would not stop. His mom said, "Why not read a book?" Sam found an old book on the shelf. It was about pirates and treasure. Sam read for an hour. When he finished, the rain had stopped. Sam went outside and found a puddle. He jumped in it and laughed. It turned out to be a great day after all.',
        questions: [
            { q: 'Why couldn\'t Sam go outside at first?', a: ['it was raining', 'raining', 'rain', 'because of the rain'] },
            { q: 'What did Sam\'s mom suggest he do?', a: ['read a book', 'reading a book','she suggested he read a book','she told him to read a book','go read','to read'] },
            { q: 'What was the book about?', a: ['pirates and treasure','treasure and pirates', 'pirates', 'treasure','the book was about pirates','the book was about treasure','it was about pirates and treasure', 'the book was about treasure and pirates', 'it was about treasure and pirates'] },
            { q: 'What did Sam do when he finally went outside?', a: ['jumped in a puddle', 'jumped in it', 'jumped in the puddle', 'he jumped in a puddle', 'he jumped in water', 'he jumped in the puddle'] },
        ],
    },
    {
        id: 'helpful-squirrel',
        level: 1,
        title: 'The Helpful Squirrel',
        text: 'A squirrel named Pip lived in an oak tree. Every fall, Pip collected nuts and hid them in the ground. One day, a small rabbit named Benny came to Pip\'s tree. Benny said, "I have no food for winter." Pip thought for a moment. Then he dug up some of his hidden nuts and gave them to Benny. Benny thanked Pip and hopped away happily. That winter, both animals stayed warm and full. Pip learned that sharing makes everyone feel good.',
        questions: [
            { q: 'What kind of tree did Pip live in?', a: ['oak tree', 'oak','he live in an oak tree','Pip lived in an oak tree'] },
            { q: 'What did Pip collect every fall?', a: ['nuts', 'acorns','he collected nuts','he collected acorns','Pip collected nuts','Pip collected acorns'] },
            { q: 'Who came to visit Pip?', a: ['benny', 'a rabbit named benny', 'a rabbit','Benny visited Pip','Benny came to visit Pip'] },
            { q: 'What lesson did Pip learn?', a: ['sharing makes everyone feel good', 'sharing', 'sharing is good', 'sharing is caring', 'how to share', 'sharing is nice', 'he should share', 'to share'] },
        ],
    },
    {
        id: 'sunflower-seed',
        level: 1,
        title: 'The Sunflower Seed',
        text: 'Mia found a small seed in her yard. She planted it in a pot of soft soil. Every day she gave it a little water and set it in the sun. Nothing happened for a week. Then a tiny green stem poked out of the soil. Mia smiled and kept watering. By summer, a tall sunflower with a big yellow face grew by the window. Mia cut it and put it in a jar on the table. Her mom said it was the most beautiful flower she had ever seen.',
        questions: [
            { q: 'Where did Mia find the seed?', a: ['in her yard', 'her yard', 'the yard'] },
            { q: 'What did Mia put the seed in?', a: ['a pot', 'a pot of soil', 'soft soil','soil','dirt','a pot of dirt'] },
            { q: 'How long before anything happened?', a: ['a week', 'one week', '7 days','1 week'] },
            { q: 'Where did Mia put the flower after she cut it?', a: ['in a jar', 'a jar on the table', 'a jar','she put it in a jar','she put it on the table','she put it in a jar on the table'] },
        ],
    },

    // ── Level 2 ──────────────────────────────────────────────────────────────
    {
        id: 'old-lighthouse',
        level: 2,
        title: 'The Old Lighthouse',
        text: 'On a rocky coast, there stood an old lighthouse. Its keeper, a woman named Clara, had tended the light for thirty years. Every evening, she climbed the spiral stairs and lit the great lamp. Ships at sea depended on her steady light to avoid the dangerous rocks below. One stormy night, the lamp\'s mechanism broke. Clara worked through the night to repair it, her hands trembling in the cold. By dawn, the lamp blazed again. That morning, a ship\'s captain rowed to shore and thanked her. Without her light, his vessel would have been lost. Clara simply smiled and said, "That is what I am here for."',
        questions: [
            { q: 'What was the lighthouse keeper\'s name?', a: 'clara' },
            { q: 'How long had Clara tended the light?', a: ['thirty years', '30 years', '30'] },
            { q: 'What happened to the lamp one stormy night?', a: ['it broke', 'the mechanism broke', 'it stopped working', 'broke', 'it went out'] },
            { q: 'Why did the captain come to shore?', a: ['to thank clara', 'to thank her', 'he wanted to thank her'] },
        ],
    },
    {
        id: 'mountain-trail',
        level: 2,
        title: 'The Mountain Trail',
        text: 'Every summer, twelve-year-old Maya hiked the mountain trail with her father. This year, halfway up the trail, Maya\'s knee began to ache. She wanted to keep going, but her father noticed her limping. "We can turn back," he said gently. Maya shook her head. She slowed her pace, took smaller steps, and focused on the view ahead. An hour later, they reached the summit. Below them, the town looked like a toy village. Maya\'s knee still hurt, but she grinned. She had learned that slowing down does not always mean giving up.',
        questions: [
            { q: 'How old is Maya?', a: ['twelve', '12', 'twelve years old'] },
            { q: 'What problem did Maya have on the trail?', a: ['her knee ached', 'knee pain', 'sore knee', 'knee', 'aching knee'] },
            { q: 'What did her father offer to do?', a: ['turn back', 'go back', 'turn around'] },
            { q: 'What did Maya learn at the end?', a: ['slowing down does not mean giving up', 'slowing down is not giving up', 'you can still succeed even if you slow down'] },
        ],
    },
    {
        id: 'market-garden',
        level: 2,
        title: 'The Market Garden',
        text: 'Every Saturday, Mr. Chen sold vegetables at the farmers\' market. He grew carrots, tomatoes, and leafy herbs in his small backyard garden. One spring, a late frost killed most of his seedlings. He replanted, but the new crops grew slowly. By market day, he had only a few bunches of herbs left to sell. A neighbor offered to let him sell some of her extra tomatoes alongside his herbs. Together, they sold out by noon. The experience taught Mr. Chen the value of community. He and his neighbor became partners, combining their gardens every season after that.',
        questions: [
            { q: 'What did Mr. Chen sell at the market?', a: ['vegetables', 'vegetables and herbs', 'herbs and tomatoes'] },
            { q: 'What destroyed most of his seedlings?', a: ['a late frost', 'frost', 'the frost'] },
            { q: 'What did his neighbor offer to share?', a: ['tomatoes', 'extra tomatoes', 'her tomatoes'] },
            { q: 'What did Mr. Chen and his neighbor become?', a: ['partners', 'business partners', 'garden partners'] },
        ],
    },
    {
        id: 'rescue-dog',
        level: 2,
        title: 'The Rescue Dog',
        text: 'On a cold Tuesday morning, a firefighter named Dani was called to a collapsed building on the edge of town. The structure had crumbled after a small earthquake, trapping several people inside. Dani\'s partner was a trained search-and-rescue dog named Scout. Scout moved quickly through the rubble, sniffing for survivors. Within twenty minutes, Scout had located two people beneath the debris. Emergency crews carefully cleared the rubble and pulled both people to safety. The rescued woman hugged Scout tightly and wept with relief. Dani patted Scout\'s head and said, "Good boy." It had been a hard morning, but a good one.',
        questions: [
            { q: 'What was the firefighter\'s name?', a: ['dani'] },
            { q: 'What caused the building to collapse?', a: ['a small earthquake', 'earthquake', 'an earthquake'] },
            { q: 'What was the search-and-rescue dog\'s name?', a: ['scout'] },
            { q: 'How many people did Scout locate?', a: ['two', '2', 'two people'] },
        ],
    },

    // ── Level 3 ──────────────────────────────────────────────────────────────
    {
        id: 'cartographers-map',
        level: 3,
        title: "The Cartographer's Map",
        text: 'In the attic of her grandmother\'s house, Elena discovered a rolled-up map tucked behind a trunk. The map showed a coast she did not recognize, with strange symbols marking the inland hills. Her grandmother, now in her nineties, had never mentioned it. After weeks of research, Elena matched the coastline to a remote island in the South Pacific. The symbols, she eventually decoded, marked the locations of freshwater springs — crucial knowledge for survival on the arid island. Elena published her findings in a small journal. Historians later confirmed that the map had been drawn by her great-great-grandmother, a botanist who had surveyed the island in 1901. Elena framed the map and hung it above her desk, a reminder that discovery is not always found in distant places, but sometimes in forgotten corners of home.',
        questions: [
            { q: 'Where did Elena find the map?', a: ['attic', 'her grandmother\'s attic', 'in the attic', 'grandmother\'s house'] },
            { q: 'What did the symbols on the map mark?', a: ['freshwater springs', 'fresh water springs', 'water springs', 'springs'] },
            { q: 'What was Elena\'s great-great-grandmother\'s profession?', a: ['botanist', 'a botanist'] },
            { q: 'In what year was the island surveyed?', a: ['1901'] },
        ],
    },
    {
        id: 'last-performance',
        level: 3,
        title: 'The Last Performance',
        text: 'The concert hall was nearly empty — perhaps two dozen people in a hall that seated a thousand. The pianist, an old man named Viktor, had not performed publicly in fifteen years. His hands, once celebrated for their speed and precision, now moved more slowly across the keys. Yet when he played, the few listeners leaned forward. Each note was deliberate, shaped with a care that only age and reflection can teach. Afterward, a young girl of about eight approached him. "Why do you play so slowly?" she asked without malice. Viktor smiled. "Because I have finally learned to listen to the music," he said. The girl nodded as though she understood, and perhaps she did.',
        questions: [
            { q: 'How long had Viktor not performed publicly?', a: ['fifteen years', '15 years', '15'] },
            { q: 'About how many people were in the audience?', a: ['two dozen', '24', 'about two dozen', 'twenty four', 'around 24'] },
            { q: 'Why did Viktor say he played slowly?', a: ['he learned to listen to the music', 'he had learned to listen', 'learned to listen to the music', 'to listen to the music'] },
            { q: 'Who approached Viktor after the concert?', a: ['a young girl', 'a girl', 'a girl of about eight', 'a little girl'] },
        ],
    },
    {
        id: 'glass-greenhouse',
        level: 3,
        title: 'The Glass Greenhouse',
        text: 'At the edge of the city stood a glass greenhouse that had been abandoned for decades. Elias, a young urban planner, proposed converting it into a community garden. The city council was skeptical — the building was old, the glass cracked, the soil inside depleted. But Elias had studied similar projects in other cities and knew what was possible. Over two years, volunteers repaired the glass panels, tested the soil, and planted hundreds of seedlings. Critics called it a waste of time. Then spring arrived. The greenhouse erupted in green — tomatoes, sunflowers, basil, and herbs spilled over raised beds. Children from the nearby school came to learn about plants. The elderly couple who had watched the neighborhood change for fifty years called it a miracle. Elias called it planning.',
        questions: [
            { q: 'What did Elias propose doing with the greenhouse?', a: ['converting it into a community garden', 'make it a community garden', 'community garden', 'a community garden'] },
            { q: 'How long had the greenhouse been abandoned?', a: ['decades', 'for decades'] },
            { q: 'How long did the restoration take?', a: ['two years', '2 years'] },
            { q: 'What did Elias call the result at the end?', a: ['planning', 'just planning'] },
        ],
    },
    {
        id: 'river-bridge',
        level: 3,
        title: 'The River Bridge',
        text: 'For generations, the two villages of Harrow and Fen had been separated by a wide river. Crossing required a wooden ferry that ran only twice a day and was cancelled entirely when the current ran high. Children on one side could not easily attend the school on the other; families missed weddings and funerals. When a young civil engineer named Priya was assigned to the region, she assumed the bridge project would be straightforward. It was not. The riverbed was unexpectedly soft, requiring deeper foundations than any local bridge had used before. Priya redesigned the plans three times. Four years after groundbreaking, the bridge opened. The first person to walk across it was an eighty-year-old woman from Harrow who had never in her life set foot in Fen. She stopped at the midpoint, looked out at the river, and said nothing at all. Some distances, Priya thought, are longer than the river.',
        questions: [
            { q: 'What separated the two villages?', a: ['a wide river', 'a river', 'the river'] },
            { q: 'What problem did Priya discover with the riverbed?', a: ['it was unexpectedly soft', 'the riverbed was soft', 'soft riverbed', 'it was soft'] },
            { q: 'How many times did Priya redesign the plans?', a: ['three', '3', 'three times'] },
            { q: 'How many years did the bridge take to build after groundbreaking?', a: ['four years', '4 years', '4'] },
        ],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Phase = 'levelSelect' | 'reading' | 'questions' | 'results';

const WPM_MIN = 60;
const WPM_MAX = 280;
const WPM_DEFAULT = 120;

function normalizeAns(s: string): string {
    return s.toLowerCase().trim().replace(/['']/g, "'").replace(/[.,!?;:]+$/g, '').trim();
}

function checkAnswer(input: string, answer: string | string[]): boolean {
    const norm = normalizeAns(input);
    if (!norm) return false;
    const targets = Array.isArray(answer) ? answer : [answer];
    return targets.some(t => normalizeAns(t) === norm);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CharInfo {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    xp: number;
    level: number;
}

interface StoryQuestionEntry {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    correct: boolean;
}

interface Props {
    onClose: () => void;
    characters?: CharInfo[];
    /** Fired automatically when the student reaches the results screen — use this to save stats */
    onResultsReady?: (correct: number, total: number, storyLevel: 1 | 2 | 3, entries: StoryQuestionEntry[]) => void;
    /** Fired only when the student clicks "Claim XP" */
    onClaimXP?: (correct: number, total: number, storyLevel: 1 | 2 | 3) => void;
}

export default function StoryReader({ onClose, characters, onResultsReady, onClaimXP }: Props) {
    const [phase, setPhase] = useState<Phase>('levelSelect');
    const [story, setStory] = useState<StoryEntry | null>(null);

    // Reading state
    const [wordIdx, setWordIdx] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [wpm, setWpm] = useState(WPM_DEFAULT);
    const [readingDone, setReadingDone] = useState(false);

    // Questions state
    const [qIdx, setQIdx] = useState(0);
    const [input, setInput] = useState('');
    const [results, setResults] = useState<boolean[]>([]);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [allCorrectAnswers, setAllCorrectAnswers] = useState<string[]>([]);
    const [answered, setAnswered] = useState(false);
    const [correctAns, setCorrectAns] = useState('');

    // Session
    const [completed, setCompleted] = useState(0);
    const [xpClaimed, setXpClaimed] = useState(false);

    const [audioEnabled, setAudioEnabled] = useState(true);

    const intervalRef = useRef<number | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const wordIdxRef = useRef(-1);
    const activeWordRef = useRef<HTMLSpanElement | null>(null);

    // Cancel speech on unmount
    useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

    const words = useMemo(() => (story ? story.text.split(/\s+/).filter(Boolean) : []), [story]);

    const clearTicker = useCallback(() => {
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // ── Pick a story ──────────────────────────────────────────────────────────
    const pickStory = useCallback((lvl: 1 | 2 | 3) => {
        const pool = STORIES.filter(s => s.level === lvl);
        const entry = pool[Math.floor(Math.random() * pool.length)];
        setStory(entry);
        setWordIdx(-1);
        wordIdxRef.current = -1;
        setIsPlaying(false);
        setReadingDone(false);
        setXpClaimed(false);
        setQIdx(0);
        setInput('');
        setResults([]);
        setUserAnswers([]);
        setAllCorrectAnswers([]);
        setAnswered(false);
        setCorrectAns('');
        setPhase('reading');
    }, []);

    // ── Ticker ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isPlaying || !story || words.length === 0) return;
        const delay = Math.round(60_000 / wpm);
        intervalRef.current = window.setInterval(() => {
            const next = wordIdxRef.current + 1;
            if (next >= words.length) {
                clearTicker();
                setIsPlaying(false);
                setReadingDone(true);
                wordIdxRef.current = words.length - 1;
                setWordIdx(words.length - 1);
                return;
            }
            wordIdxRef.current = next;
            setWordIdx(next);
        }, delay);
        return clearTicker;
    }, [isPlaying, wpm, words, story, clearTicker]);

    // ── Scroll active word into view ──────────────────────────────────────────
    useEffect(() => {
        activeWordRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [wordIdx]);

    // ── Play / pause ──────────────────────────────────────────────────────────
    const togglePlay = () => {
        setIsPlaying(prev => {
            const next = !prev;
            if (audioEnabled && story) {
                if (next) {
                    // If no utterance yet (fresh start), create one and speak from beginning
                    if (!utteranceRef.current || window.speechSynthesis.paused === false && !window.speechSynthesis.speaking) {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(story.text);
                        u.rate = Math.max(0.5, Math.min(2.5, wpm / 150));
                        utteranceRef.current = u;
                        window.speechSynthesis.speak(u);
                    } else {
                        window.speechSynthesis.resume();
                    }
                } else {
                    window.speechSynthesis.pause();
                }
            }
            return next;
        });
    };

    // ── Restart reading ───────────────────────────────────────────────────────
    const restartReading = () => {
        clearTicker();
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
        setIsPlaying(false);
        setWordIdx(-1);
        wordIdxRef.current = -1;
        setReadingDone(false);
    };

    // ── Start / resume questions ──────────────────────────────────────────────
    // If questions are already in progress, just navigate back without resetting.
    const startQuestions = () => {
        clearTicker();
        setIsPlaying(false);
        if (results.length === 0 && qIdx === 0 && !answered) {
            // Fresh start
            setInput('');
            setResults([]);
            setUserAnswers([]);
            setAllCorrectAnswers([]);
            setAnswered(false);
            setCorrectAns('');
            setQIdx(0);
        }
        // Otherwise resume from wherever the student left off
        setPhase('questions');
    };

    // ── Submit answer ─────────────────────────────────────────────────────────
    const submitAnswer = () => {
        if (!story) return;
        const correct = checkAnswer(input, story.questions[qIdx].a);
        const targets = story.questions[qIdx].a;
        const correctAnswer = Array.isArray(targets) ? targets[0] : targets;
        setCorrectAns(correctAnswer);
        setResults(prev => [...prev, correct]);
        setUserAnswers(prev => [...prev, input]);
        setAllCorrectAnswers(prev => [...prev, correctAnswer]);
        setAnswered(true);
    };

    const nextQuestion = () => {
        if (!story) return;
        setInput('');
        setAnswered(false);
        setCorrectAns('');
        if (qIdx + 1 >= story.questions.length) {
            setCompleted(c => c + 1);
            // Auto-save stats as soon as results are ready (independent of XP claim)
            const score = results.filter(Boolean).length;
            const total = story.questions.length;
            const entries: StoryQuestionEntry[] = story.questions.map((sq, i) => ({
                question: sq.q,
                correctAnswer: allCorrectAnswers[i] ?? (Array.isArray(sq.a) ? sq.a[0] : sq.a),
                userAnswer: userAnswers[i] ?? '',
                correct: results[i] ?? false,
            }));
            onResultsReady?.(score, total, story.level as 1 | 2 | 3, entries);
            setPhase('results');
        } else {
            setQIdx(q => q + 1);
        }
    };

    // ── Stop speech when leaving reading phase ───────────────────────────────
    useEffect(() => {
        if (phase !== 'reading') {
            window.speechSynthesis.cancel();
            utteranceRef.current = null;
        }
    }, [phase]);

    // ─── Phase: levelSelect ───────────────────────────────────────────────────
    if (phase === 'levelSelect') {
        const LEVEL_DESC = [
            'Short sentences · Familiar words',
            'Longer paragraphs · Wider vocabulary',
            'Complex narratives · Inferential questions',
        ];
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
                >✕</button>
                <div className="text-5xl mb-4">📖</div>
                <h1 className="text-3xl font-bold text-white mb-2">Story Reader</h1>
                <p className="text-gray-400 text-sm mb-2">Read a story, then answer comprehension questions</p>
                {completed > 0 && (
                    <p className="text-emerald-400 text-xs mb-6">
                        ✓ {completed} {completed === 1 ? 'story' : 'stories'} completed this session
                    </p>
                )}
                {characters && characters.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center mt-2 mb-4">
                        {characters.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 text-xs border border-gray-700">
                                <span className="font-semibold text-white">{c.name}</span>
                                <span className="text-red-400">❤️ {c.hp}/{c.maxHp}</span>
                                <span className="text-sky-300">Lv.{c.level}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex flex-col gap-4 w-72 mt-6">
                    {([1, 2, 3] as const).map((lvl, i) => (
                        <button
                            key={lvl}
                            onClick={() => pickStory(lvl)}
                            className="py-5 px-6 rounded-2xl border-2 border-emerald-700 bg-gray-900 hover:bg-emerald-900/30 hover:border-emerald-400 transition-all text-left group"
                        >
                            <div className="text-lg font-bold text-white group-hover:text-emerald-300">
                                Level {lvl}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">{LEVEL_DESC[i]}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ─── Phase: reading ───────────────────────────────────────────────────────
    if (phase === 'reading' && story) {
        const progress = wordIdx < 0 ? 0 : Math.round(((wordIdx + 1) / words.length) * 100);

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col p-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                    <button
                        onClick={() => { clearTicker(); setPhase('levelSelect'); }}
                        className="text-gray-400 hover:text-white text-sm"
                    >← Back</button>
                    <h2 className="text-base font-bold text-white truncate px-2">{story.title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-800 rounded-full mb-4 shrink-0">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Character strip */}
                {characters && characters.length > 0 && (
                    <div className="flex gap-2 flex-wrap shrink-0 mb-2">
                        {characters.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 text-xs border border-gray-700">
                                <span className="font-semibold text-white">{c.name}</span>
                                <span className="text-red-400">❤️ {c.hp}/{c.maxHp}</span>
                                <span className="text-sky-300">Lv.{c.level}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Story text */}
                <div className="flex-1 overflow-y-auto bg-gray-900 rounded-2xl p-5 mb-4 leading-9 text-lg text-gray-300 select-none">
                    {words.map((word, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && ' '}
                            <span
                                ref={i === wordIdx ? (el => { activeWordRef.current = el; }) : undefined}
                                className={
                                    i === wordIdx
                                        ? 'bg-yellow-400 text-gray-900 rounded px-0.5 font-semibold'
                                        : i < wordIdx
                                            ? 'text-white'
                                            : 'text-gray-500'
                                }
                            >
                                {word}
                            </span>
                        </React.Fragment>
                    ))}
                </div>

                {/* Controls */}
                <div className="shrink-0 flex flex-col gap-3">
                    {/* Speed slider + audio toggle */}
                    <div className="flex items-center gap-3 px-1">
                        <span className="text-lg">🐢</span>
                        <input
                            type="range"
                            min={WPM_MIN}
                            max={WPM_MAX}
                            value={wpm}
                            onChange={e => {
                                const next = Number(e.target.value);
                                setWpm(next);
                                // Update in-flight utterance rate
                                if (utteranceRef.current) {
                                    utteranceRef.current.rate = Math.max(0.5, Math.min(2.5, next / 150));
                                }
                            }}
                            className="flex-1 accent-emerald-500 h-1.5"
                        />
                        <span className="text-lg">🐇</span>
                        <span className="text-gray-400 text-xs w-12 text-right tabular-nums">{wpm} wpm</span>
                        <button
                            onClick={() => {
                                const next = !audioEnabled;
                                setAudioEnabled(next);
                                if (!next) window.speechSynthesis.cancel();
                            }}
                            title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
                            className="text-lg leading-none"
                        >
                            {audioEnabled ? '🔊' : '🔇'}
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        {!readingDone && (
                            <button
                                onClick={togglePlay}
                                className={`flex-1 py-3 rounded-xl font-bold text-white transition-all text-sm ${isPlaying
                                    ? 'bg-yellow-600 hover:bg-yellow-500'
                                    : 'bg-emerald-600 hover:bg-emerald-500'
                                    }`}
                            >
                                {isPlaying ? '⏸ Pause' : wordIdx < 0 ? '▶ Play' : '▶ Resume'}
                            </button>
                        )}
                        {wordIdx >= 0 && !readingDone && (
                            <button
                                onClick={restartReading}
                                className="px-4 py-3 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all text-sm"
                                title="Restart"
                            >
                                ↺
                            </button>
                        )}
                        {readingDone && (
                            <button
                                onClick={restartReading}
                                className="px-4 py-3 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all text-sm"
                                title="Replay story"
                            >
                                ↺ Replay
                            </button>
                        )}
                        <button
                            onClick={startQuestions}
                            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all text-sm ${readingDone
                                ? 'bg-blue-600 hover:bg-blue-500 animate-pulse'
                                : 'bg-blue-800 hover:bg-blue-700'
                                }`}
                        >
                            {results.length > 0 || (qIdx > 0) || answered
                                ? '📝 Resume Questions'
                                : readingDone ? '📝 Answer Questions' : 'Questions →'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Phase: questions ─────────────────────────────────────────────────────
    if (phase === 'questions' && story) {
        const q = story.questions[qIdx];
        const lastResult = results[results.length - 1];

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>

                {/* Character strip */}
                {characters && characters.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center mb-4">
                        {characters.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 text-xs border border-gray-700">
                                <span className="font-semibold text-white">{c.name}</span>
                                <span className="text-red-400">❤️ {c.hp}/{c.maxHp}</span>
                                <span className="text-sky-300">Lv.{c.level}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Progress dots */}
                <div className="flex gap-2 mb-6">
                    {story.questions.map((_, i) => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-full transition-colors ${i < results.length
                                ? results[i] ? 'bg-emerald-400' : 'bg-red-400'
                                : i === qIdx
                                    ? 'bg-blue-400'
                                    : 'bg-gray-700'
                                }`}
                        />
                    ))}
                </div>

                <p className="text-gray-500 text-xs mb-2">
                    Question {qIdx + 1} of {story.questions.length}
                </p>
                <h2 className="text-xl font-bold text-white text-center mb-8 max-w-sm leading-snug">
                    {q.q}
                </h2>

                {!answered ? (
                    <>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && input.trim() && submitAnswer()}
                            placeholder="Type your answer…"
                            autoFocus
                            className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-center mb-4"
                        />
                        <button
                            onClick={submitAnswer}
                            disabled={!input.trim()}
                            className="px-10 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold transition-all"
                        >
                            Submit
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className={`text-6xl ${lastResult ? 'text-emerald-400' : 'text-red-400'}`}>
                            {lastResult ? '✓' : '✗'}
                        </div>
                        <p className={`font-semibold text-lg ${lastResult ? 'text-emerald-300' : 'text-red-300'}`}>
                            {lastResult ? 'Correct!' : 'Not quite'}
                        </p>
                        {!lastResult && (
                            <p className="text-gray-400 text-sm">
                                Answer: <span className="text-white font-medium capitalize">{correctAns}</span>
                            </p>
                        )}
                        <button
                            onClick={nextQuestion}
                            className="mt-3 px-10 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                        >
                            {qIdx + 1 < story.questions.length ? 'Next →' : 'See Results'}
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setPhase('reading')}
                    className="mt-8 text-gray-600 hover:text-gray-400 text-sm"
                >
                    ← Back to story
                </button>
            </div>
        );
    }

    // ─── Phase: results ───────────────────────────────────────────────────────
    if (phase === 'results' && story) {
        const score = results.filter(Boolean).length;
        const total = story.questions.length;
        const pct = Math.round((score / total) * 100);
        const emoji = pct === 100 ? '🌟' : pct >= 75 ? '📚' : '📖';

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <div className="text-5xl mb-4">{emoji}</div>
                <h2 className="text-3xl font-bold text-white mb-1">Story Complete!</h2>
                <p className="text-gray-500 text-sm mb-6 italic">"{story.title}"</p>

                {/* Per-question result icons */}
                <div className="flex gap-3 mb-6">
                    {results.map((correct, i) => (
                        <div
                            key={i}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${correct
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                : 'bg-red-500/20 text-red-300 border-red-500'
                                }`}
                        >
                            {correct ? '✓' : '✗'}
                        </div>
                    ))}
                </div>

                <p className="text-4xl font-bold text-white mb-1">{score}/{total}</p>
                <p className="text-gray-400 text-sm mb-8">{pct}% correct</p>

                {characters && characters.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center mb-4">
                        {characters.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 text-xs border border-gray-700">
                                <span className="font-semibold text-white">{c.name}</span>
                                <span className="text-red-400">❤️ {c.hp}/{c.maxHp}</span>
                                <span className="text-sky-300">Lv.{c.level}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-3 w-64">
                    {onClaimXP && (
                        <button
                            onClick={() => {
                                if (!xpClaimed) {
                                    onClaimXP(results.filter(Boolean).length, story.questions.length, story.level as 1 | 2 | 3);
                                    setXpClaimed(true);
                                }
                            }}
                            disabled={xpClaimed}
                            className={`py-3 rounded-xl font-bold transition-all ${xpClaimed
                                ? 'bg-gray-700 text-emerald-400 cursor-default'
                                : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                }`}
                        >
                            {xpClaimed ? '✓ XP Claimed!' : '⭐ Claim XP'}
                        </button>
                    )}
                    <button
                        onClick={() => pickStory(story.level as 1 | 2 | 3)}
                        className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
                    >
                        Read Another (Level {story.level})
                    </button>
                    <button
                        onClick={() => { setPhase('levelSelect'); setStory(null); }}
                        className="py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition-all"
                    >
                        Change Level
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
