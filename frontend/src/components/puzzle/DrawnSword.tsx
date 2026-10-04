import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzleCharacterOption } from './PuzzleMode';
import { xpThreshold } from '../../utils/xpUtils';

// ─── Word banks ───────────────────────────────────────────────────────────────

const WORDS_3 = [
    'ace','act','add','age','ago','aid','aim','air','ale','ant','arc','arm','art','ash','ask','axe',
    'bay','bed','big','bit','bow','box','boy','bud','bug','bun','bus','buy',
    'cab','can','cap','car','cat','cob','cod','cop','cow','cry','cup','cut',
    'dam','day','den','dew','dig','dim','dip','dog','dot','dry','dug','dye',
    'ear','eat','egg','elf','elm','end','era','eve','eye',
    'fan','far','fat','few','fig','fin','fit','fix','fly','fog','for','fox','fry','fun','fur',
    'gap','gel','gem','get','gig','gnu','god','got','gum','gun','gut','guy',
    'ham','hap','hat','hay','hen','hew','hit','hog','hop','hot','hug','hum','hut',
    'ice','ill','imp','ink','inn','ion','ivy',
    'jab','jam','jar','jaw','jet','jot','joy','jug','jut',
    'keg','key','kid','kin','kit',
    'lab','lag','lap','law','lay','led','leg','let','lid','lip','lit','log','lot','low',
    'mad','map','mat','mew','mix','mob','mop','mud','mug','mum',
    'nab','nag','nap','net','nit','nod','nor','not','now','nun','nut',
    'oak','oar','odd','ode','off','oil','old','opt','orb','ore','owl','own',
    'pad','pan','pat','paw','pay','pea','pen','pet','pie','pig','pin','pit','ply','pod','pop','pot','pun','pup','put',
    'rag','ram','ran','rap','rat','raw','ray','red','ref','rid','rig','rim','rip','rob','rod','rot','row','rub','rut',
    'sad','sap','sat','saw','say','set','sew','shy','sin','sip','sit','six','ski','sky','sly','sob','sod','son','sow','sox','soy','spa','spy','sub','sum','sun','sup',
    'tab','tan','tap','tar','tax','tea','ten','the','tie','tin','tip','toe','ton','top','toy','try','tub','tug','two',
    'urn','use',
    'van','vat','vex','via','vim','vow',
    'wag','war','was','wax','web','wed','wet','who','why','wig','win','wit','woe','wok','won','woo','wow',
    'yak','yam','yap','yaw','yes','yet','yew','you',
    'zap','zed','zen','zip','zit','zoo',
];

const WORDS_4 = [
    'able','ache','acre','also','arch','area','army','aunt','auto',
    'back','bail','bait','bake','bald','ball','band','bane','bark','barn','base','bath','bear','beat','beef','beer','bell','bend','best','bill','bird','bite','blue','blur','boat','bold','bolt','bond','bone','book','boom','born','boss','both','bowl','brag','bred','brew','brim','buck','bulb','bulk','bull','bump','burn','burp','bush',
    'cafe','cage','cake','calf','call','calm','came','camp','cane','card','care','cart','case','cash','cast','cave','cell','chad','chef','chin','chip','chop','cite','city','clam','clap','claw','clay','clip','club','clue','coal','coat','coil','cold','colt','come','cone','cook','cool','cope','cord','core','corn','cost','cozy','crab','crew','crop','crow','crud','cult','cure','curl',
    'damp','dare','dark','dart','data','date','dawn','dead','deaf','deal','dean','dear','deck','deep','deer','deft','dell','demo','deny','dew','dial','dice','dirt','dish','disk','dock','does','dole','dome','done','doom','door','dose','dove','down','drag','draw','drew','drip','drop','drum','dual','dull','dumb','dump','dung','dusk','dust','duty',
    'each','earl','earn','ease','east','easy','edge','else','emit','envy','epic','even','ever','evil','exam','exit',
    'face','fact','fail','fake','fall','fame','farm','fast','fate','fawn','fear','feat','feel','feet','fell','felt','fern','fife','file','fill','film','find','fine','fire','firm','fish','fist','five','flag','flat','flaw','flee','flew','flex','flip','flit','flow','foam','fold','folk','fond','food','fool','foot','ford','fore','fork','form','fort','foul','four','fowl','free','from','fuel','full','fume','fund','fuse','fuzz',
    'gale','gall','game','gang','gasp','gate','gaze','gear','glee','glen','glow','glue','gnaw','goal','goad','gold','golf','gone','gong','good','goof','gore','gosh','gown','grab','grad','gram','gray','grew','grid','grin','grip','grit','groom','grow','grub','gulf','gull','gulp','gust','guts',
    'hack','hail','hair','half','hall','halt','hand','hang','hard','hare','harm','harp','hash','hate','haul','have','hawk','haze','head','heal','heap','heat','heel','helm','help','hemp','here','hero','hewn','hide','high','hill','hilt','hint','hire','hive','hold','hole','holm','home','hone','hood','hook','hope','horn','host','hour','howl','hulk','hull','hunt','hurl','hymn',
    'idle','inch','into','iris',
    'jack','jade','jail','jake','jest','john','join','joke','jolt','jump','junk','just',
    'keel','keen','keep','kelp','kern','kick','kill','kind','king','knit','knob','know',
    'lack','laid','lake','lame','lamp','land','lane','lash','last','late','laud','lead','leaf','lean','leap','left','lend','less','levy','life','lift','like','limb','lime','limp','line','link','lion','list','live','load','loam','loan','lock','loft','lone','long','look','loom','loop','lore','lorn','lose','lost','love','luck','lull','lung','lure','lurk','lust',
    'made','mail','main','make','male','mall','malt','mane','many','mare','mark','mars','mash','mast','mate','math','maze','meal','mean','meet','melt','memo','mesh','mild','mile','milk','mill','mime','mind','mine','mint','mist','mode','mold','mole','molt','mope','morn','most','moth','move','muck','mule','muse','musk','must',
    'nail','name','nape','nary','neat','need','nest','news','next','nice','nick','nine','node','none','noon','norm','nose','note','noun','nude','null',
    'oath','oboe','once','only','open','oval','oven','over','owed','owed',
    'pace','page','paid','pail','pair','pale','palm','pane','park','part','past','path','pave','peak','pear','peel','peer','peg','pest','pick','pile','pine','pink','pipe','plan','play','plea','plot','plow','plum','plus','poem','poet','pole','poll','pond','pool','pore','port','pose','post','pour','pray','prey','prop','pull','pure','push',
    'race','rack','raft','rage','raid','rail','rain','rake','ramp','rank','rapt','raze','read','real','reap','reed','reef','reel','rent','rest','rice','rich','ride','ring','rise','risk','road','roam','roar','robe','rock','role','roll','roof','room','root','rope','rose','rout','rude','ruin','rule','rump','rune','ruse','rush',
    'safe','sage','sail','sake','sale','same','sand','sane','sang','sank','sash','save','seal','seam','sear','seed','seek','seem','seen','self','sell','sent','shed','ship','shot','shun','shut','sick','side','sigh','silk','sill','sing','sink','site','size','skew','skin','skip','slab','slam','slap','slew','slim','slip','slob','slot','slug','slum','slur','smog','snag','snap','snip','snow','soak','soap','soar','sock','soft','soil','sole','song','soon','soot','sore','soul','soup','sour','span','spar','spit','spot','spur','stab','star','stay','stem','step','stew','stir','stop','stub','stun','such','suit','sulk','sung','sunk','sure','surf','swap','swam','swan','swat','sway','swim',
    'tack','tail','tale','tall','tame','tank','tape','tare','task','taut','teal','team','tear','teem','term','test','text','than','that','thee','them','then','they','thin','this','thou','thus','tick','tide','till','tilt','time','toad','toil','told','toll','tomb','tone','tong','took','tool','tore','torn','toss','tour','town','trek','trim','trio','trip','true','tube','tuck','tuft','tuna','tune','turf','turn','tusk','twin','type',
    'ugly','undo','unit','unto','upon','urge','used',
    'vale','vary','vast','veil','vein','very','vest','view','vine','visa','void','volt','vote',
    'wade','wage','wake','wale','walk','wall','wane','want','ward','warm','warn','warp','wart','wave','weak','weal','wean','weed','week','weld','well','welt','went','were','west','when','whim','whip','wide','wife','wild','will','wilt','wind','wine','wing','wink','wire','wise','wish','with','woke','wolf','womb','wood','wool','word','wore','work','worm','worn','wrap','wren','writ',
    'yard','yarn','year','yell','your',
    'zeal','zero','zone','zoom',
];

const WORDS_5 = [
    'abbey','abide','abler','abode','about','above','abuse','abyss','actor','acute','adept','admit','adult','after','again','agile','aging','agony','ahead','aided','aisle','alarm','album','alert','algae','alien','align','alike','allay','alley','allot','allow','aloft','alone','aloud','alter','among','ample','amuse','angel','angle','angry','anime','ankle','annex','antic','anvil','apart','apple','apply','apron','arena','arise','armor','aroma','arose','array','aside','asked','atlas','atone','attic','audio','aught','avail','avid','avoid','awake','awash','award','awoke',
    'bacon','badge','bagel','baggy','baker','basic','basis','batch','beach','beady','beast','began','begin','being','below','bench','berry','birth','bison','bitch','black','blade','blame','bland','blank','blast','blaze','bleak','bleat','bleed','blend','bless','blink','block','blood','bloom','blown','blunt','board','boast','bonus','boost','booth','booze','bound','boxer','braid','brain','brake','brand','brave','bread','break','breed','brick','bride','brief','bring','brisk','broil','broke','brook','broom','broth','brunt','brush','build','built','bulge','bully','burly','burst',
    'cabin','cadet','candy','cargo','carry','catch','cause','cease','chain','chair','chalk','champ','chaos','charm','chase','cheap','cheat','check','cheek','cheer','chess','chest','chili','chill','chimp','cigar','civic','civil','clamp','clank','clash','clasp','class','clean','clear','clerk','click','cliff','climb','cling','clock','clone','close','clout','clown','crack','craft','cramp','crane','crash','crazy','cream','creed','creek','crime','crisp','croak','crook','cross','crowd','crown','cruel','crumb','cruse','crust','curly','curse','curve','cyber',
    'daisy','dance','dandy','debar','debut','decoy','delta','depot','derby','deter','digit','dimly','disco','ditch','diver','dizzy','dodge','doing','dolly','doubt','dough','dowdy','dowel','downy','draft','drain','drama','drape','dream','dried','drift','drink','drive','drool','drove','drown','dryer','dying',
    'eager','early','earth','eight','elder','elite','ember','emoji','empty','enemy','enjoy','enter','entry','equal','error','essay','ethos','evade','evoke','exact','exert','exile','exist','expel','extra',
    'fable','faced','facet','faint','fairy','faith','false','fancy','fatal','feast','feeble','fence','ferry','fetch','fewer','field','fiend','fiery','fifth','fifty','fight','final','first','fixed','fizzy','flame','flair','flake','flank','flare','flask','flaw','flesh','fleet','flesh','float','flock','floor','floss','flout','flown','fluff','flute','focus','foray','force','forge','forth','forum','found','frame','frank','freak','fresh','fried','front','frost','froth','frown','froze','fully',
    'gauge','ghost','giddy','girly','given','gland','glass','glean','glide','gloss','glove','going','golem','gorge','gouge','grace','grade','grain','grand','grant','grape','grasp','grass','grate','grave','great','greed','green','greet','grief','gripe','groan','groin','groom','gross','group','grove','growl','gruel','gruff','guess','guile','guise','gusto',
    'habit','happy','haunt','haven','havoc','heart','heavy','hedge','heist','hence','heron','hilly','hippo','hipster','hoist','holly','homer','honor','horse','hotel','hound','house','human','humid','hunky','hurdle',
    'icier','icicle','ideal','image','imply','index','indie','infer','inner','input','inter','intro','issue',
    'ivory',
    'jaunt','jazzy','jelly','jerky','jewel','jiffy','joint','joust','judge','juice','juicy','jumbo','jumpy',
    'kayak','kebab','kneel','knife','knock','knoll','known',
    'label','lance','large','laser','latch','later','laugh','layer','leach','lemon','level','light','limit','liner','liver','llama','lobby','local','lofty','login','loose','lorry','lousy','lower','lowly','loyal','lucid','lucky','lumpy','lunar','lunch','lusty',
    'magic','major','maker','manor','maple','march','marsh','match','meant','medal','media','mercy','metal','mirth','miser','mitty','moist','moldy','money','month','moody','moral','mount','mourn','mover','muddy','murky','music','mushy','musty','mystic',
    'nadir','nifty','night','ninja','noble','noisy','north','notch','novel','nymph',
    'ocean','octet','offer','often','order','other','ought','outdo','outer','outrun','ozone',
    'paint','pansy','paper','party','pasta','pasty','patch','patio','patsy','pause','peach','pearl','pedal','penny','perch','peril','phone','photo','piano','piece','pilot','pinch','pixel','pixie','pizza','place','plain','plane','plank','plant','plaque','plaza','plead','plied','pluck','plumb','plunk','plush','poach','point','poker','polar','porch','posit','pouch','power','press','price','pride','prime','print','prior','prism','probe','prone','proof','prose','prowl','proxy','prude','pudgy','pulse','punch','puppy','purse',
    'queen','query','quest','queue','quick','quirk','quota','quote',
    'racer','radar','raise','rally','ramen','range','rapid','raspy','ratio','reach','ready','realm','rebel','refer','reign','relax','remit','renew','repay','reply','reset','rider','risky','rival','rivet','roast','robin','rocky','rogue','round','route','rowdy','royal','rugby','ruler','rusty',
    'sadly','saint','salad','sally','salsa','salvo','sandy','savor','savvy','scale','scamp','scene','scone','scope','score','scout','scram','screw','scrub','seize','sense','serve','setup','seven','shade','shady','shaft','shake','shaky','shall','shame','share','shark','sharp','shear','sheep','sheer','sheet','shelf','shell','shift','shine','shiny','shirt','shock','shore','short','shove','showy','shrug','shunt','siege','sieve','sight','silly','since','sixth','sixty','sizeable','skill','skimp','slang','slave','sleek','sleep','sleet','slept','slice','slide','slime','slope','slosh','sloth','smack','small','smart','smash','smear','smell','smile','smirk','smoke','smoky','snare','sneak','sniff','snore','snort','solar','solid','solve','sonic','sorry','south','space','speak','speck','speed','spell','spend','spice','spicy','spike','spine','spiral','spite','spook','spore','spray','squad','squat','squib','stack','stage','stain','stale','stalk','stall','stamp','stand','stark','start','state','stave','steal','steel','steep','steer','stern','stiff','still','sting','stoke','stomp','stone','stood','stoop','store','storm','story','stout','stove','strap','straw','stray','strip','strobe','strut','stuck','study','stump','stung','stunk','stunt','style','sugar','suite','sulky','sunny','super','surge','surly','swamp','swarm','swear','sweat','sweet','swept','swift','swipe','swirl','sword','swore',
    'table','taboo','talon','tangy','tapir','tasty','taunt','tense','tepid','there','thick','thing','think','thorn','three','threw','throw','tiger','tight','tilde','timer','tipsy','title','today','token','tonic','tooth','topaz','total','totem','touch','tough','towel','tower','toxic','trace','track','trade','trail','train','trait','tramp','traps','trash','triad','trial','tribe','trick','trice','trite','troll','trout','truck','truly','trump','trunk','tryst','tulip','tuner','tycoon','typify',
    'ulcer','ultra','under','unify','union','until','upper','upset','urban','usher',
    'vague','valor','valve','vapor','vault','vaunt','vigor','viral','virus','vital','vivid','vocal','voice','vouch','voyage',
    'wager','waltz','waste','watch','water','weary','weave','wedge','weird','whack','whale','wheat','wheel','where','which','while','whine','white','whole','wider','witch','witty','woman','women','world','worry','worse','worst','worst','worth','would','wound','wring','wrong',
    'yacht','yearn','yield','young','youth',
    'zappy','zebra','zesty',
];

const WORDS_6 = [
    'absent','absorb','accent','access','accord','accuse','across','acting','action','active','actual','addled','aerial','afford','afraid','agenda','agreed','albeit','always','ampere','anneal','answer','antler','arcane','ardent','artful','asleep','assert','astute','attain','autumn','avenge','awoken',
    'badger','banter','barely','barrel','batter','battle','beacon','beaker','beaten','beauty','beckon','before','behold','behind','belief','bewail','beyond','blight','borrow','bounce','brazen','breach','breeze','bridge','bright','brings','bronco','bruise','brutal','bundle','burrow',
    'canopy','castle','cellar','chance','change','chapel','charge','chaser','choice','chorus','chrome','circle','clamor','clench','cloudy','coffin','collar','combat','comedy','commit','common','compel','comply','corner','costly','cougar','course','covert','create','crisis','critic','crouch','cudgel','cunning',
    'dagger','damage','danger','dangle','daring','darken','deadly','deaden','decide','decree','defend','defiant','delete','delude','demand','depart','detach','devote','devout','differ','digger','direct','discern','dispel','distal','divide','divine','donkey','dragon','drawn','driven',
    'earthy','effect','effort','eldest','embark','empire','enable','engage','enough','errant','escape','evolve','exceed','excess','exempt','exiled','expand','expend','expose','extend','extend',
    'fabled','falter','famine','famous','fathom','fallen','fierce','figure','filter','finely','finger','finish','fissure','flawed','fleece','flight','flinch','flying','follow','foment','forbid','forest','formal','foster','french','fright','frozen','future',
    'garden','gather','gentle','gifted','glance','glider','global','gloom','golden','govern','ground','growth','grudge','guitar',
    'hamlet','happen','harden','harken','harden','hasten','hateful','haunch','hearth','heated','herald','hidden','highly','hinder','hissed','holler','honest','hunger','hunter','hustle','hymnal',
    'ignite','impact','impede','import','impure','income','infect','injure','insult','insure','intent','island','italics',
    'jangle','jester','jester','jingle','jostle','jungle',
    'keeper','kindly','knaves','knight','lagoon','launch','lawful','leader','legend','lessen','lethal','liable','likely','listen','lively','longer','luster',
    'mangle','manner','marble','marker','marvel','master','matrix','mayhem','meadow','menace','middle','mingle','mirror','mission','modish','mostly','murder','muster','mutual','mystic',
    'narrow','nature','nearly','needed','needle','nettle','nimble','noble','normal','notice','nourish',
    'oblige','obsess','obtain','offend','onward','ordeal','outlaw','outfit','outrun','outset','outward',
    'pardon','parrot','patrol','patron','payoff','pebble','people','period','permit','petty','pillar','pirate','plague','planet','player','pledge','plenty','plunge','pocket','polite','portal','prefer','priest','prince','prison','profit','proper','proven','punish','purple',
    'raging','random','ransom','ravage','reckless','recall','recede','reckon','reduce','reflux','rescue','repent','revolt','reveal','review','riches','riddle','ruined','rumble',
    'sacred','sadness','safely','sailor','sample','savage','scorch','screen','scroll','sealed','search','secret','sedate','seldom','serene','settle','severe','shower','signal','silent','silver','simple','single','sinful','sister','sketch','slight','slouch','smooth','soothe','sorrow','spirit','spoken','spread','spring','squall','squish','starve','statue','steady','stolen','strength','streak','strict','string','strong','struck','sudden','suffer','summit','sunken','supply','surely','survey','swerve','symbol',
    'tangle','tarnish','tavern','terror','threat','thrice','throne','throng','thrust','tidbit','timely','torment','torrent','topper','travel','treble','tremor','trestle','tribal','trophy','truant','turmoil','twitch',
    'unbind','uneasy','unfold','unlock','unruly','unwrap','upbeat','uphold','uproot','urgent',
    'valiant','vanish','vaulted','velvet','vendor','vermin','vertex','villian','violent','vision','vivify',
    'wander','warder','warden','warlock','warmth','wasted','weapon','weight','wicket','wither','wizard','wonder','wraith','wrangle','wrench','writhe',
    'yearly','yonder',
    'zealous','zipper',
];

const WORDS_7 = [
    'absolve','abutment','acclaim','account','accrete','achieve','address','adopted','advance','adverse','affair','afflict','against','ailment','alright','altruism','ancient','another','anxiety','appoint','approve','archway','arrange','arrival','assault','attempt','attract','auditor','austere','avocado','awesome',
    'baptize','bargain','barnacle','bashful','beguile','believe','bestow','between','blasted','blatant','blessed','bluster','boldest','boredom','bravely','bravery','breadth','brigand','brindled','broaden','builder','bullion',
    'cabinet','cadence','capable','capture','careful','carnage','certain','chamber','channel','chapter','charity','charmed','cherish','chipper','clarity','classic','climate','closely','cluster','collect','complex','conduct','conform','courage','courtly','covered','crumble','cunning','curious',
    'dainty','dazzle','dazedly','declare','dedicate','devoted','disciple','dismiss','display','disrupt','distant','divided','divorce','dooming','dormant','drawing','dreaded','dutiful',
    'earnest','eclipse','eddying','empower','enchant','endless','enforce','engrave','enhance','enliven','ensnare','entrust','epitome','eternal','examine','exhaust','exhibit','expunge','extreme',
    'failure','fervent','fiction','finally','finding','focused','forward','founded','freedom','furnish','furtive','further',
    'gallant','garland','gateway','germane','glamour','glitter','gleaming','glorious','gnostic','granite','grievous','gripped','guarded',
    'hallowed','harmony','healing','helpful','heretic','heroism','highest','hopeful','hostage','hurried',
    'imagine','immense','impasse','inbound','include','ingrain','instant','instead','intrepid','involve','isolate',
    'jealous','journey','justice',
    'knowing','knightly',
    'lantern','lasting','lattice','lawless','leading','learned','liberty','lifelong','livable','lookout','loyalty',
    'magical','marshal','mastery','measure','mediate','mention','merchant','mission','mystery',
    'natural','neither','nothing','nowhere','nurtured',
    'obscure','offhand','ongoing','openness','outcry','outpost','outside','outward','overall',
    'painful','paragon','patient','patriot','perform','perhaps','peril','phantom','pilgrim','pillage','plunder','popular','powerful','provide','purpose','pursuer',
    'quality','quickly','quiesce','quilted',
    'radical','ransome','rapture','realize','reasons','rebuilt','recount','redoubt','refresh','relieve','resolve','restore','retract','returned','revenge','reverse','revival','rightful','rivalry','roughly',
    'satisfy','scouted','seafarer','serious','setting','shackle','shelter','shimmer','sincere','skillful','slumber','soldier','solemn','sorcery','speaker','spatial','squalor','stealth','stoical','strange','stratum','success','sunrise','support','suppress','surpass','suspect','swiftly','symbol',
    'tactics','telling','tempest','thought','thunder','tonight','totally','tough','towards','tracked','trained','traitor','travels','triumph','trouble','trusted','tumbled','twisted',
    'unbound','unclear','uncover','undergo','unlucky','unmoved','upright','usurper','utilize',
    'valient','veteran','victory','village','villian','virtuous','visible','visions','vivid',
    'wanting','warrior','watchful','wayward','western','whether','whisper','wistful','witched','wonders','wounded','writhen',
    'younger','zealotry',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type DSLevel = 'simple' | 'complex' | 'challenging';
type L2WordLen = 4 | 5;
type L3WordLen = 6 | 7;
type DSPhase = 'charPick' | 'levelSelect' | 'l2LenSelect' | 'l3LenSelect' | 'playing' | 'complete';

type LetterState = 'cyan' | 'yellow' | 'magenta' | 'empty' | 'filled';

interface GuessRow {
    letters: string[];
    states: LetterState[];
    submitted: boolean;
}

export interface DrawnSwordProps {
    onClose: () => void;
    allCharacters?: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, xp: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickWord(len: number, seed: number): string {
    const bank =
        len === 3 ? WORDS_3 :
        len === 4 ? WORDS_4 :
        len === 5 ? WORDS_5 :
        len === 6 ? WORDS_6 :
        WORDS_7;
    const filtered = bank.filter(w => w.length === len);
    return filtered[(seed * 7919 + 1) % filtered.length].toUpperCase();
}

function evaluateGuess(guess: string, target: string): LetterState[] {
    const len = target.length;
    const result: LetterState[] = Array(len).fill('magenta');
    const targetArr = target.split('');
    const guessArr = guess.toUpperCase().split('');

    // First pass: mark correct positions cyan
    const remaining: (string | null)[] = [...targetArr];
    for (let i = 0; i < len; i++) {
        if (guessArr[i] === targetArr[i]) {
            result[i] = 'cyan';
            remaining[i] = null;
        }
    }
    // Second pass: mark wrong-position yellows
    for (let i = 0; i < len; i++) {
        if (result[i] === 'cyan') continue;
        const idx = remaining.indexOf(guessArr[i]);
        if (idx !== -1) {
            result[i] = 'yellow';
            remaining[idx] = null;
        }
    }
    return result;
}

function makeEmptyRow(len: number): GuessRow {
    return { letters: Array(len).fill(''), states: Array(len).fill('empty'), submitted: false };
}

function keyboardStateMap(rows: GuessRow[]): Record<string, LetterState> {
    const map: Record<string, LetterState> = {};
    const priority: Record<LetterState, number> = { cyan: 3, yellow: 2, magenta: 1, filled: 0, empty: 0 };
    for (const row of rows) {
        if (!row.submitted) continue;
        row.letters.forEach((l, i) => {
            const s = row.states[i];
            if (!map[l] || priority[s] > priority[map[l]]) map[l] = s;
        });
    }
    return map;
}

const TILE_COLOR: Record<LetterState, string> = {
    cyan:    'bg-cyan-500 border-cyan-400 text-white',
    yellow:  'bg-yellow-400 border-yellow-300 text-gray-900',
    magenta: 'bg-fuchsia-600 border-fuchsia-500 text-white',
    filled:  'bg-gray-700 border-gray-500 text-white',
    empty:   'bg-gray-900 border-gray-700 text-white',
};

const KEY_COLOR: Record<LetterState, string> = {
    cyan:    'bg-cyan-500 text-white',
    yellow:  'bg-yellow-400 text-gray-900',
    magenta: 'bg-fuchsia-600 text-white',
    filled:  'bg-gray-700 text-white',
    empty:   'bg-gray-700 text-white',
};

const KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

// ─── Component ────────────────────────────────────────────────────────────────

const DrawnSword: React.FC<DrawnSwordProps> = ({ onClose, allCharacters = [], onAwardXP }) => {
    const [phase, setPhase] = useState<DSPhase>('charPick');
    const [selectedChar, setSelectedChar] = useState<PuzzleCharacterOption | null>(null);
    const [charSearch, setCharSearch] = useState('');
    const [level, setLevel] = useState<DSLevel>('simple');
    const [wordLen, setWordLen] = useState(3);
    const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000) % 99991);

    const [target, setTarget] = useState('');
    const [rows, setRows] = useState<GuessRow[]>([]);
    const [currentRow, setCurrentRow] = useState(0);
    const [won, setWon] = useState(false);
    const [lost, setLost] = useState(false);
    const [shake, setShake] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);

    const MAX_GUESSES = 6;

    const startGame = useCallback((len: number, lvl: DSLevel, newSeed: number) => {
        const word = pickWord(len, newSeed);
        setTarget(word);
        setRows(Array.from({ length: MAX_GUESSES }, () => makeEmptyRow(len)));
        setCurrentRow(0);
        setWon(false);
        setLost(false);
        setXpEarned(0);
        setWordLen(len);
        setLevel(lvl);
        setPhase('playing');
    }, []);

    // Award XP on win: (MAX_GUESSES - currentRow) * wordLen * 5
    const awardXP = useCallback((guessNum: number, len: number) => {
        const remaining = MAX_GUESSES - guessNum; // guesses left after this one
        const xp = remaining * len * 5;
        setXpEarned(xp);
        if (selectedChar && selectedChar.id !== '__guest__') {
            onAwardXP?.(selectedChar.id, xp);
        }
    }, [selectedChar, onAwardXP]);

    const submitGuess = useCallback(() => {
        if (currentRow >= MAX_GUESSES) return;
        const row = rows[currentRow];
        const guess = row.letters.join('');
        if (guess.length < wordLen) {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            return;
        }

        const states = evaluateGuess(guess, target);
        const isWin = states.every(s => s === 'cyan');

        setRows(prev => {
            const next = prev.map((r, i) =>
                i === currentRow ? { ...r, states, submitted: true } : r
            );
            return next;
        });
        setCurrentRow(prev => prev + 1);

        if (isWin) {
            setWon(true);
            awardXP(currentRow, wordLen);
        } else if (currentRow + 1 >= MAX_GUESSES) {
            setLost(true);
        }
    }, [currentRow, rows, target, wordLen, awardXP]);

    const handleKey = useCallback((key: string) => {
        if (won || lost) return;
        if (key === 'ENTER') { submitGuess(); return; }
        if (key === '⌫' || key === 'BACKSPACE') {
            setRows(prev => {
                const next = prev.map(r => ({ ...r, letters: [...r.letters] }));
                const row = next[currentRow];
                const lastFilled = row.letters.reduce((acc, l, i) => l ? i : acc, -1);
                if (lastFilled >= 0) row.letters[lastFilled] = '';
                return next;
            });
            return;
        }
        if (/^[A-Z]$/.test(key)) {
            setRows(prev => {
                const next = prev.map(r => ({ ...r, letters: [...r.letters] }));
                const row = next[currentRow];
                const firstEmpty = row.letters.indexOf('');
                if (firstEmpty !== -1) {
                    row.letters[firstEmpty] = key;
                    row.states[firstEmpty] = 'filled';
                }
                return next;
            });
        }
    }, [won, lost, currentRow, submitGuess]);

    // Physical keyboard
    useEffect(() => {
        if (phase !== 'playing') return;
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toUpperCase();
            if (k === 'ENTER' || k === 'BACKSPACE' || /^[A-Z]$/.test(k)) {
                e.preventDefault();
                handleKey(k === 'BACKSPACE' ? '⌫' : k);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [phase, handleKey]);

    const kbMap = keyboardStateMap(rows);

    // ── Phase: charPick ─────────────────────────────────────────────────
    if (phase === 'charPick') {
        const filtered = allCharacters.filter(c => c.name.toLowerCase().includes(charSearch.toLowerCase()));
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <div className="text-5xl mb-3">⚔️</div>
                <div className="text-white font-extrabold text-xl tracking-widest mb-1">DRAWN SWORD</div>
                <p className="text-gray-400 text-sm mb-5">Choose a character to play as</p>
                <div className="relative w-80 mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search…"
                        value={charSearch}
                        onChange={e => setCharSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                </div>
                <div className="overflow-y-auto max-h-64 w-80 space-y-1.5 pr-1">
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            onClick={() => { setSelectedChar(c); setPhase('levelSelect'); }}
                            className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-900 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-300 transition-all text-sm font-medium"
                        >
                            {c.name}
                        </button>
                    ))}
                    {filtered.length === 0 && <p className="text-gray-600 text-sm italic text-center py-4">No characters found</p>}
                </div>
                <button onClick={() => { setSelectedChar(null); setPhase('levelSelect'); }} className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline">
                    Play without a character
                </button>
            </div>
        );
    }

    // ── Phase: levelSelect ──────────────────────────────────────────────
    if (phase === 'levelSelect') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('charPick')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-3">⚔️</div>
                <div className="text-white font-extrabold text-xl tracking-widest mb-1">DRAWN SWORD</div>
                {selectedChar && <p className="text-cyan-400 text-xs mb-4">{selectedChar.name}</p>}
                <p className="text-gray-400 text-sm mb-6">Choose difficulty</p>
                <div className="flex flex-col gap-3 w-72">
                    {([
                        { lvl: 'simple'      as DSLevel, label: 'Simple',      desc: '3-letter words',          word: '3' },
                        { lvl: 'complex'     as DSLevel, label: 'Complex',     desc: '4-letter or 5-letter words', word: '4–5' },
                        { lvl: 'challenging' as DSLevel, label: 'Challenging', desc: '6-letter or 7-letter words', word: '6–7' },
                    ] as const).map(({ lvl, label, desc, word }) => (
                        <button
                            key={lvl}
                            onClick={() => {
                                if (lvl === 'simple')      startGame(3, lvl, seed);
                                else if (lvl === 'complex') setPhase('l2LenSelect');
                                else                        setPhase('l3LenSelect');
                                setLevel(lvl);
                            }}
                            className="py-5 px-6 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-left group"
                        >
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-base font-bold text-white group-hover:text-cyan-300">{label}</span>
                                <span className="text-sm text-gray-500">{word} letters</span>
                            </div>
                            <div className="text-sm text-gray-500">{desc}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Phase: l2LenSelect ──────────────────────────────────────────────
    if (phase === 'l2LenSelect') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('levelSelect')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-3">⚔️</div>
                <p className="text-gray-400 text-sm mb-6">Complex — choose word length</p>
                <div className="flex gap-4">
                    {([4, 5] as L2WordLen[]).map(len => (
                        <button key={len} onClick={() => startGame(len, 'complex', seed)}
                            className="py-8 px-10 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-center group">
                            <div className="text-3xl font-extrabold text-white group-hover:text-cyan-300">{len}</div>
                            <div className="text-xs text-gray-500 mt-1">letters</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Phase: l3LenSelect ──────────────────────────────────────────────
    if (phase === 'l3LenSelect') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('levelSelect')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-3">⚔️</div>
                <p className="text-gray-400 text-sm mb-6">Challenging — choose word length</p>
                <div className="flex gap-4">
                    {([6, 7] as L3WordLen[]).map(len => (
                        <button key={len} onClick={() => startGame(len, 'challenging', seed)}
                            className="py-8 px-10 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-center group">
                            <div className="text-3xl font-extrabold text-white group-hover:text-cyan-300">{len}</div>
                            <div className="text-xs text-gray-500 mt-1">letters</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Phase: playing ──────────────────────────────────────────────────
    if (phase === 'playing') {
        const tileSize = wordLen >= 7 ? 'w-9 h-9 text-sm' : wordLen >= 6 ? 'w-10 h-10 text-sm' : wordLen >= 5 ? 'w-11 h-11 text-base' : 'w-12 h-12 text-lg';

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-start pt-4 pb-2 overflow-y-auto">
                {/* Header */}
                <div className="w-full max-w-sm px-4 flex items-center justify-between mb-3">
                    <button onClick={() => setPhase('levelSelect')} className="text-gray-400 hover:text-white text-sm">← Back</button>
                    <div className="text-center">
                        <div className="text-white font-extrabold text-base tracking-widest">DRAWN SWORD</div>
                        <div className="text-gray-500 text-[10px] capitalize">{level} · {wordLen} letters</div>
                        {selectedChar && selectedChar.id !== '__guest__' && (
                            <div className="text-cyan-400 text-[10px] font-semibold">{selectedChar.name}</div>
                        )}
                    </div>
                    <button onClick={() => { setSeed(s => (s + 1) % 99991); startGame(wordLen, level, (seed + 1) % 99991); }} className="text-xs text-cyan-400 hover:text-cyan-200 border border-cyan-700 rounded px-2 py-1">New</button>
                </div>

                {/* Guess grid */}
                <div className="flex flex-col gap-1.5 mb-4">
                    {rows.map((row, ri) => (
                        <div
                            key={ri}
                            className={`flex gap-1.5 ${ri === currentRow && shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                        >
                            {row.letters.map((letter, ci) => {
                                const state = row.submitted ? row.states[ci] : letter ? 'filled' : 'empty';
                                return (
                                    <div
                                        key={ci}
                                        className={`${tileSize} flex items-center justify-center rounded-lg border-2 font-extrabold transition-all duration-300 ${TILE_COLOR[state]}`}
                                    >
                                        {letter}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Win/loss banner */}
                {won && (
                    <div className="mb-3 px-6 py-3 bg-cyan-900/60 border border-cyan-500 rounded-xl text-center">
                        <div className="text-cyan-300 font-bold text-base mb-1">⚔️ Word drawn!</div>
                        {xpEarned > 0 && (
                            <div className="bg-white border border-amber-400 rounded-lg px-4 py-2 mt-2 w-44 mx-auto">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-amber-600">+{xpEarned} XP</span>
                                    {selectedChar && selectedChar.id !== '__guest__' && <span className="text-xs text-gray-400">{selectedChar.name}</span>}
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                                    <div className="h-2 bg-amber-400 rounded" style={{ width: `${Math.min(100, Math.round(((selectedChar?.xp ?? 0) + xpEarned) % Math.max(1, xpThreshold(selectedChar?.level ?? 1)) / Math.max(1, xpThreshold(selectedChar?.level ?? 1)) * 100))}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {lost && (
                    <div className="mb-3 px-6 py-2 bg-fuchsia-900/50 border border-fuchsia-600 rounded-xl text-center">
                        <div className="text-fuchsia-300 font-bold text-sm">The word was <span className="text-white font-extrabold">{target}</span></div>
                    </div>
                )}

                {/* On-screen keyboard */}
                <div className="flex flex-col gap-1.5 px-2 w-full max-w-sm">
                    {KEYBOARD_ROWS.map((row, ri) => (
                        <div key={ri} className="flex justify-center gap-1">
                            {row.map(key => {
                                const st: LetterState = kbMap[key] ?? 'empty';
                                const isWide = key === 'ENTER' || key === '⌫';
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleKey(key)}
                                        className={`${isWide ? 'px-2 min-w-[3rem]' : 'w-8'} h-10 rounded-lg text-xs font-bold transition-colors ${KEY_COLOR[st]}`}
                                    >
                                        {key}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* New word / done buttons after end */}
                {(won || lost) && (
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => { const ns = (seed + 1) % 99991; setSeed(ns); startGame(wordLen, level, ns); }}
                            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-colors text-sm"
                        >
                            New Word
                        </button>
                        <button onClick={onClose} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors text-sm">
                            Done
                        </button>
                    </div>
                )}

                {/* shake keyframe */}
                <style>{`
                    @keyframes shake {
                        0%,100% { transform: translateX(0); }
                        20% { transform: translateX(-6px); }
                        40% { transform: translateX(6px); }
                        60% { transform: translateX(-4px); }
                        80% { transform: translateX(4px); }
                    }
                `}</style>
            </div>
        );
    }

    return null;
};

export default DrawnSword;
