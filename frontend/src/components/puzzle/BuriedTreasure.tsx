/**
 * BuriedTreasure — Suika-style gem merge game.
 *
 * Drop gems; two matching gems merge into the next tier.
 * Progression: Quartz → Amber → Rose Quartz → Ruby → Sapphire →
 *              Emerald → Diamond → Rainbow Diamond → Shiny Pearl → Gold Nugget
 *
 * Every gem has cute close-together black dot eyes that blink occasionally.
 * Physics: same simple Euler integration as KanjiDrop.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PuzzleCharacterOption } from './PuzzleMode';

// ─── Gem definitions ──────────────────────────────────────────────────────────
interface GemDef {
    id: string;
    label: string;
    tier: number;
    radius: number;
    color: string;
    strokeColor: string;
    glowColor: string;
}

const BASE_R = 16;
const R_STEP = 7;
const gr = (t: number) => BASE_R + t * R_STEP;

const GEMS: GemDef[] = [
    { id: 'quartz',          label: 'Quartz',         tier: 0, radius: gr(0), color: '#d6d0c8', strokeColor: '#a09890', glowColor: '#e8e4d4' },
    { id: 'salt',            label: 'Amber',           tier: 1, radius: gr(1), color: '#ffaa00', strokeColor: '#cc7700', glowColor: '#ffdd44' },
    { id: 'rose_quartz',     label: 'Rose Quartz',     tier: 2, radius: gr(2), color: '#f4a0b5', strokeColor: '#c87090', glowColor: '#ffc0d0' },
    { id: 'ruby',            label: 'Ruby',            tier: 3, radius: gr(3), color: '#ff4466', strokeColor: '#dd1144', glowColor: '#ff3050' },
    { id: 'sapphire',        label: 'Sapphire',        tier: 4, radius: gr(4), color: '#3388ff', strokeColor: '#1155cc', glowColor: '#3080ff' },
    { id: 'emerald',         label: 'Emerald',         tier: 5, radius: gr(5), color: '#22cc66', strokeColor: '#119944', glowColor: '#30c060' },
    { id: 'diamond',         label: 'Diamond',         tier: 6, radius: gr(6), color: '#d8f0ff', strokeColor: '#88c0e8', glowColor: '#eef8ff' },
    { id: 'rainbow_diamond', label: 'Rainbow Diamond', tier: 7, radius: gr(7), color: '#ff88cc', strokeColor: '#cc44aa', glowColor: '#ffaaee' },
    { id: 'shiny_pearl',     label: 'Shiny Pearl',     tier: 8, radius: gr(8), color: '#f8f4e8', strokeColor: '#c8c0a0', glowColor: '#fffff8' },
    { id: 'gold_nugget',     label: 'Gold Nugget',     tier: 9, radius: gr(9), color: '#ffd700', strokeColor: '#c8a000', glowColor: '#ffe84a' },
];

const GEM_BY_ID = new Map<string, GemDef>(GEMS.map(g => [g.id, g]));
const GEM_BY_TIER = new Map<number, GemDef>(GEMS.map(g => [g.tier, g]));

// ─── Merge table ──────────────────────────────────────────────────────────────
// Same gem + same gem → next tier; XP scales with the result tier.
const MERGES: [string, string, string, number][] = GEMS.slice(0, -1).map(g => {
    const next = GEM_BY_TIER.get(g.tier + 1)!;
    return [g.id, g.id, next.id, (g.tier + 1) * 60] as [string, string, string, number];
});

const MERGE_MAP = new Map<string, { result: string; xp: number }>();
for (const [a, b, result, xp] of MERGES) {
    MERGE_MAP.set(`${a}+${b}`, { result, xp });
}

function lookupMerge(a: string, b: string) {
    return MERGE_MAP.get(`${a}+${b}`) ?? MERGE_MAP.get(`${b}+${a}`);
}

// ─── Difficulty ───────────────────────────────────────────────────────────────
// Controls the weighted pool of gems that can drop.
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
    { id: 'easy',   label: 'Easy',       desc: 'Mostly small gems' },
    { id: 'medium', label: 'Medium',     desc: 'A few bigger gems mixed in' },
    { id: 'hard',   label: 'Difficult',  desc: 'Wide range of small & large gems' },
];

// Weighted toward smallest for easy, wider spread for harder difficulties.
const DROPPABLE_POOLS: Record<Difficulty, string[]> = {
    easy: [
        'quartz', 'quartz', 'quartz', 'quartz', 'quartz', 'quartz',
        'salt', 'salt', 'salt',
        'rose_quartz',
    ],
    medium: [
        'quartz', 'quartz', 'quartz', 'quartz',
        'salt', 'salt', 'salt',
        'rose_quartz', 'rose_quartz',
        'ruby',
    ],
    hard: [
        'quartz', 'quartz',
        'salt', 'salt',
        'rose_quartz', 'rose_quartz',
        'ruby', 'ruby',
        'sapphire',
        'emerald',
    ],
};

// ─── Physics constants ────────────────────────────────────────────────────────
const GRAVITY     = 0.25;
const DAMPING     = 0.25;
const FRICTION    = 0.5;
const SETTLE_VEL  = 0.2;
const MIN_MERGE_AGE = 8;
const MAX_VY      = 14;
const CANVAS_W    = 340;
const CANVAS_H    = 540;
const FLOOR       = CANVAS_H - 4;

// ─── Ball type ────────────────────────────────────────────────────────────────
interface Ball {
    id: number;
    gemId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    settled: boolean;
    age: number;
    blinkOffset: number; // per-ball random offset so gems don't all blink together
}

let _nextId = 1;
function newId() { return _nextId++; }
function randomDropGem(difficulty: Difficulty) {
    const pool = DROPPABLE_POOLS[difficulty];
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Gem canvas drawing ───────────────────────────────────────────────────────

function drawEyes(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    blinking: boolean,
) {
    const eyeR    = Math.max(2, Math.min(6, r * 0.13));
    const spacing = Math.max(3.5, r * 0.22);
    const eyeY    = y + r * 0.08;

    if (!blinking) {
        // Open eyes — filled black circles with a small white shine dot
        ctx.fillStyle = '#0f0e08';
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        const shine = eyeR * 0.38;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x - spacing + shine, eyeY - shine, shine, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + spacing + shine, eyeY - shine, shine, 0, Math.PI * 2); ctx.fill();
    } else {
        // Closed eyes — small ∩ arcs (counterclockwise top half = ^^ look)
        ctx.strokeStyle = '#0f0e08';
        ctx.lineWidth = Math.max(1.5, eyeR * 0.85);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, eyeR, 0, Math.PI, true);  ctx.stroke();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, eyeR, 0, Math.PI, true);  ctx.stroke();
    }
}

// Shared conic-gradient base: no shadow, rotating fill + bold outline + flat highlight
function conicBase(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    colors: string[], angle: number,
    strokeColor: string,
) {
    let grd: CanvasGradient;
    if (typeof (ctx as unknown as { createConicGradient?: unknown }).createConicGradient === 'function') {
        grd = (ctx as unknown as { createConicGradient: (a: number, x: number, y: number) => CanvasGradient })
            .createConicGradient(angle, x, y);
        colors.forEach((c, i) => grd.addColorStop(i / (colors.length - 1), c));
    } else {
        grd = ctx.createLinearGradient(
            x + Math.cos(angle) * r, y + Math.sin(angle) * r,
            x - Math.cos(angle) * r, y - Math.sin(angle) * r,
        );
        colors.forEach((c, i) => grd.addColorStop(i / (colors.length - 1), c));
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - r * 0.26, y - r * 0.28, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
}

function drawQuartz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, _frame: number) {
    conicBase(ctx, x, y, r, ['#f0ece4','#d6d0c8','#a8a098','#d6d0c8','#f0ece4'], 0, def.strokeColor);
}

function drawSalt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, _frame: number) {
    conicBase(ctx, x, y, r, ['#ffe888','#ffaa00','#cc6600','#ffaa00','#ffe888'], 0, def.strokeColor);
    // Trapped-bubble inclusions
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(120,50,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.1, r * 0.18, r * 0.11, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - r * 0.18, y - r * 0.05, r * 0.11, r * 0.07, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x - r * 0.26, y - r * 0.28, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,248,160,0.88)'; ctx.fill();
}

function drawRoseQuartz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, _frame: number) {
    conicBase(ctx, x, y, r, ['#ffe0ec','#f4a0b5','#d06080','#f4a0b5','#ffe0ec'], 0, def.strokeColor);
    // Polka dot inclusions
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(x + r * 0.28, y + r * 0.16, r * 0.1,  0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 0.22, y + r * 0.3,  r * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.28, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawRuby(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    conicBase(ctx, x, y, r, ['#ff88aa','#ff4466','#cc0030','#ff4466','#ff88aa'], frame * 0.004, def.strokeColor);
    // 4-pointed star
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,215,220,0.72)';
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.1, r * 0.11, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.1, r * 0.38, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawSapphire(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    conicBase(ctx, x, y, r, ['#aaccff','#3388ff','#0044bb','#3388ff','#aaccff'], frame * 0.005, def.strokeColor);
    // Crescent moon
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const cx = x + r * 0.08, cy = y - r * 0.06, cr = r * 0.34;
    ctx.fillStyle = 'rgba(190,220,255,0.82)';
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3388ff';
    ctx.beginPath(); ctx.arc(cx + cr * 0.44, cy - cr * 0.14, cr * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawEmerald(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    conicBase(ctx, x, y, r, ['#88ffcc','#22cc66','#008844','#22cc66','#88ffcc'], frame * 0.006, def.strokeColor);
    // 4 dots in diamond (◆) arrangement
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(200,255,220,0.80)';
    const dd = r * 0.3, dr = r * 0.1;
    ctx.beginPath(); ctx.arc(x,      y - dd, dr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + dd, y,      dr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x,      y + dd, dr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - dd, y,      dr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    conicBase(ctx, x, y, r, ['#ffffff','#d8f0ff','#80c0f0','#d8f0ff','#ffffff'], frame * 0.010, def.strokeColor);
    // Large 4-pointed star
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.04, r * 0.13, r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.04, r * 0.52, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Extra-bright corner highlight
    ctx.beginPath(); ctx.ellipse(x - r * 0.26, y - r * 0.28, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
}

function drawRainbowDiamond(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    def: GemDef,
    frame: number,
) {
    // Rotating rainbow via conic gradient (with linear fallback)
    const angle = (frame * 0.018) % (Math.PI * 2);
    let grd: CanvasGradient;
    if (typeof (ctx as unknown as { createConicGradient?: unknown }).createConicGradient === 'function') {
        grd = (ctx as unknown as { createConicGradient: (a: number, x: number, y: number) => CanvasGradient })
            .createConicGradient(angle, x, y);
        grd.addColorStop(0,     '#ff6b8a');
        grd.addColorStop(0.166, '#ffb347');
        grd.addColorStop(0.333, '#ffe066');
        grd.addColorStop(0.5,   '#7fff7f');
        grd.addColorStop(0.666, '#6bbaff');
        grd.addColorStop(0.833, '#c77cff');
        grd.addColorStop(1,     '#ff6b8a');
    } else {
        const lx = x + Math.cos(angle) * r;
        const ly = y + Math.sin(angle) * r;
        grd = ctx.createLinearGradient(x - Math.cos(angle) * r, y - Math.sin(angle) * r, lx, ly);
        grd.addColorStop(0,    '#ff6b8a');
        grd.addColorStop(0.25, '#ffe066');
        grd.addColorStop(0.5,  '#7fff7f');
        grd.addColorStop(0.75, '#6bbaff');
        grd.addColorStop(1,    '#c77cff');
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.stroke();

    // 4 sparkle dots at diagonal positions + center dot
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const sd = r * 0.55;
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * sd, y + Math.sin(a) * sd, r * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r * 0.1, 0, Math.PI * 2); ctx.fill();

    // Flat highlight
    ctx.beginPath(); ctx.ellipse(x - r * 0.26, y - r * 0.28, r * 0.26, r * 0.17, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.80)'; ctx.fill();
}

function drawPearl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    // Iridescent rotating conic gradient
    const angle = frame * 0.008;
    let grd: CanvasGradient;
    if (typeof (ctx as unknown as { createConicGradient?: unknown }).createConicGradient === 'function') {
        grd = (ctx as unknown as { createConicGradient: (a: number, x: number, y: number) => CanvasGradient })
            .createConicGradient(angle, x, y);
        grd.addColorStop(0,    '#ffffff');
        grd.addColorStop(0.18, '#f0eaf8');
        grd.addColorStop(0.36, '#d8c8f8');
        grd.addColorStop(0.52, '#c8f0e8');
        grd.addColorStop(0.68, '#f8e0f0');
        grd.addColorStop(0.84, '#e8f0ff');
        grd.addColorStop(1,    '#ffffff');
    } else {
        grd = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        grd.addColorStop(0,   '#ffffff');
        grd.addColorStop(0.3, '#d8c8f8');
        grd.addColorStop(0.6, '#c8f0e8');
        grd.addColorStop(1,   '#f8e0f0');
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = 'rgba(180,160,220,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // Bright white highlight
    ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.3, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 0.18, y - r * 0.42, r * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
}

function drawGlasses(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    blinking: boolean,
) {
    const lensR   = Math.max(3, Math.min(9, r * 0.22));  // lens circle radius
    const spacing = lensR * 2.6;                          // center-to-center
    const eyeY    = y + r * 0.08;
    const frameW  = Math.max(1.5, lensR * 0.32);

    ctx.save();
    ctx.strokeStyle = '#111';
    ctx.fillStyle   = '#111';
    ctx.lineWidth   = frameW;
    ctx.lineCap     = 'round';

    if (!blinking) {
        // Lens frames
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, lensR, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, lensR, 0, Math.PI * 2); ctx.stroke();

        // Bridge between the two lenses
        ctx.beginPath();
        ctx.moveTo(x - spacing + lensR, eyeY);
        ctx.lineTo(x + spacing - lensR, eyeY);
        ctx.stroke();

        // Ear stems (short lines going outward)
        ctx.beginPath();
        ctx.moveTo(x - spacing - lensR, eyeY);
        ctx.lineTo(x - spacing - lensR * 1.7, eyeY - lensR * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + spacing + lensR, eyeY);
        ctx.lineTo(x + spacing + lensR * 1.7, eyeY - lensR * 0.4);
        ctx.stroke();

        // Pupils — tiny filled dots inside each lens
        const pupilR = Math.max(1, lensR * 0.38);
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, pupilR, 0, Math.PI * 2); ctx.fill();

        // Tiny white shine dots
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const sh = pupilR * 0.45;
        ctx.beginPath(); ctx.arc(x - spacing + sh, eyeY - sh, sh, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + spacing + sh, eyeY - sh, sh, 0, Math.PI * 2); ctx.fill();
    } else {
        // Closed — ∩ arcs inside the lens frames
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, lensR * 0.55, 0, Math.PI, true); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, lensR * 0.55, 0, Math.PI, true); ctx.stroke();
        // Still draw the frames + bridge + stems
        ctx.beginPath(); ctx.arc(x - spacing, eyeY, lensR, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + spacing, eyeY, lensR, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - spacing + lensR, eyeY);
        ctx.lineTo(x + spacing - lensR, eyeY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - spacing - lensR, eyeY);
        ctx.lineTo(x - spacing - lensR * 1.7, eyeY - lensR * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + spacing + lensR, eyeY);
        ctx.lineTo(x + spacing + lensR * 1.7, eyeY - lensR * 0.4);
        ctx.stroke();
    }

    ctx.restore();
}

function drawGoldNugget(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, def: GemDef, frame: number) {
    void frame;
    // Circular body so it actually touches neighboring gems (matches physics radius)
    const grd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    grd.addColorStop(0,    '#ffee88');
    grd.addColorStop(0.5,  '#ffd700');
    grd.addColorStop(1,    '#aa7700');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = def.strokeColor; ctx.lineWidth = 2.5; ctx.stroke();
    // Gold star detail (4-pointed)
    ctx.fillStyle = 'rgba(255,245,150,0.80)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.08, r * 0.08, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.08, r * 0.28, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    // Bright highlight
    ctx.beginPath(); ctx.ellipse(x - r * 0.26, y - r * 0.28, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,252,200,0.90)'; ctx.fill();
}

function drawGemBall(
    ctx: CanvasRenderingContext2D,
    b: Ball,
    def: GemDef,
    globalFrame: number,
) {
    const { x, y, radius: r } = b;
    const blinkFrame = (globalFrame + b.blinkOffset) % 260;
    const isBlinking = blinkFrame < 10;

    switch (def.id) {
        case 'quartz':          drawQuartz(ctx, x, y, r, def, globalFrame);        break;
        case 'salt':            drawSalt(ctx, x, y, r, def, globalFrame);          break;
        case 'rose_quartz':     drawRoseQuartz(ctx, x, y, r, def, globalFrame);    break;
        case 'ruby':            drawRuby(ctx, x, y, r, def, globalFrame);          break;
        case 'sapphire':        drawSapphire(ctx, x, y, r, def, globalFrame);      break;
        case 'emerald':         drawEmerald(ctx, x, y, r, def, globalFrame);       break;
        case 'diamond':         drawDiamond(ctx, x, y, r, def, globalFrame);       break;
        case 'rainbow_diamond': drawRainbowDiamond(ctx, x, y, r, def, globalFrame); break;
        case 'shiny_pearl':     drawPearl(ctx, x, y, r, def, globalFrame);         break;
        case 'gold_nugget':     drawGoldNugget(ctx, x, y, r, def, globalFrame);    break;
        default:
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = def.color; ctx.fill();
    }

    if (def.id === 'shiny_pearl') {
        drawGlasses(ctx, x, y, r, isBlinking);
    } else {
        drawEyes(ctx, x, y, r, isBlinking);
    }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
    onClose: () => void;
    allCharacters?: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, xp: number) => void;
}

type GamePhase = 'charPick' | 'playing' | 'over';

const BuriedTreasure: React.FC<Props> = ({ onClose, allCharacters = [], onAwardXP }) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const ballsRef     = useRef<Ball[]>([]);
    const dropXRef     = useRef<number>(CANVAS_W / 2);
    const difficultyRef = useRef<Difficulty>('medium');
    const nextGemRef   = useRef<string>(randomDropGem('medium'));
    const canDropRef   = useRef<boolean>(true);
    const scoreRef     = useRef<number>(0);
    const frameRef     = useRef<number>(0);

    const [phase, setPhase]           = useState<GamePhase>('charPick');
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [score, setScore]           = useState(0);
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const [mergeFlash, setMergeFlash] = useState<{ label: string; isGold?: boolean } | null>(null);
    const [nextGemId, setNextGemId]   = useState<string>(nextGemRef.current);

    const stepRef = useRef<() => void>(() => { });
    const drawRef = useRef<() => void>(() => { });

    // ── Draw ─────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        frameRef.current++;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Walls
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);

        // Drop guide line
        const dx = dropXRef.current;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, CANVAS_H); ctx.stroke();
        ctx.setLineDash([]);

        // Ghost preview of next gem
        const ng = GEM_BY_ID.get(nextGemRef.current);
        if (ng && canDropRef.current) {
            ctx.globalAlpha = 0.28;
            ctx.beginPath();
            ctx.arc(dx, ng.radius + 2, ng.radius, 0, Math.PI * 2);
            ctx.fillStyle = ng.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // All balls
        for (const b of ballsRef.current) {
            const def = GEM_BY_ID.get(b.gemId);
            if (!def) continue;
            drawGemBall(ctx, b, def, frameRef.current);
        }
    }, []);

    // ── Physics step ─────────────────────────────────────────────────
    const step = useCallback(() => {
        const balls = ballsRef.current;
        const mergedIds = new Set<number>();

        // Integrate
        for (const b of balls) {
            b.vy = Math.min(b.vy + GRAVITY, MAX_VY);
            b.x += b.vx;
            b.y += b.vy;
            b.vx *= FRICTION;

            // Floor
            if (b.y + b.radius >= FLOOR) {
                b.y = FLOOR - b.radius;
                b.vy *= -DAMPING;
                b.vx *= 0.9;
                if (Math.abs(b.vy) < 0.2) b.vy = 0;
            }
            // Walls
            if (b.x - b.radius < 0)        { b.x = b.radius;        b.vx *= -DAMPING; }
            if (b.x + b.radius > CANVAS_W)  { b.x = CANVAS_W - b.radius; b.vx *= -DAMPING; }

            b.age++;
            b.settled = Math.abs(b.vx) < SETTLE_VEL && Math.abs(b.vy) < SETTLE_VEL;
        }

        // Collision + merge detection
        const newBalls: Ball[] = [];
        for (let i = 0; i < balls.length; i++) {
            if (mergedIds.has(balls[i].id)) continue;
            for (let j = i + 1; j < balls.length; j++) {
                if (mergedIds.has(balls[j].id)) continue;
                const a = balls[i], b2 = balls[j];
                const dx   = b2.x - a.x;
                const dy   = b2.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minD = a.radius + b2.radius;

                if (dist < minD) {
                    const merge = lookupMerge(a.gemId, b2.gemId);
                    if (merge && a.age >= MIN_MERGE_AGE && b2.age >= MIN_MERGE_AGE) {
                        mergedIds.add(a.id); mergedIds.add(b2.id);
                        const resDef = GEM_BY_ID.get(merge.result);
                        if (resDef) {
                            const nb: Ball = {
                                id: newId(),
                                gemId: merge.result,
                                x: (a.x + b2.x) / 2,
                                y: (a.y + b2.y) / 2,
                                vx: (a.vx + b2.vx) * 0.3,
                                vy: -3,
                                radius: resDef.radius,
                                settled: false,
                                age: 0,
                                blinkOffset: Math.floor(Math.random() * 260),
                            };
                            newBalls.push(nb);
                            scoreRef.current += merge.xp;
                            setScore(scoreRef.current);

                            const isGold = merge.result === 'gold_nugget';
                            setMergeFlash({ label: resDef.label, isGold });
                            setTimeout(() => setMergeFlash(null), isGold ? 2000 : 1200);

                            if (selectedCharId && onAwardXP) {
                                onAwardXP(selectedCharId, merge.xp);
                            }
                        }
                        break;
                    } else if (dist > 0) {
                        // Push apart
                        const nx = dx / dist, ny = dy / dist;
                        const overlap = (minD - dist) / 2;
                        a.x  -= nx * overlap; a.y  -= ny * overlap;
                        b2.x += nx * overlap; b2.y += ny * overlap;
                        const dot = (b2.vx - a.vx) * nx + (b2.vy - a.vy) * ny;
                        if (dot < 0) {
                            a.vx  += dot * nx; a.vy  += dot * ny;
                            b2.vx -= dot * nx; b2.vy -= dot * ny;
                        }
                    }
                }
            }
        }

        ballsRef.current = ballsRef.current.filter(b => !mergedIds.has(b.id)).concat(newBalls);

        // Game over: settled ball above danger line
        if (ballsRef.current.some(b => b.y - b.radius < 60 && b.settled)) {
            setPhase('over');
        }
    }, [selectedCharId, onAwardXP]);

    useEffect(() => { stepRef.current = step; }, [step]);
    useEffect(() => { drawRef.current = draw; }, [draw]);

    // ── Game loop ─────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'playing') return;
        let animId: number;
        const loop = () => {
            stepRef.current();
            drawRef.current();
            animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [phase]);

    // ── Pointer input ─────────────────────────────────────────────────
    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = Math.max(30, Math.min(CANVAS_W - 30, e.clientX - rect.left));
        dropXRef.current = x;
    }, []);

    const handleDrop = useCallback(() => {
        if (!canDropRef.current) return;
        const gemId = nextGemRef.current;
        const def   = GEM_BY_ID.get(gemId);
        if (!def) return;

        canDropRef.current = false;
        const ball: Ball = {
            id: newId(),
            gemId,
            x: dropXRef.current,
            y: def.radius + 2,
            vx: 0,
            vy: 1,
            radius: def.radius,
            settled: false,
            age: 0,
            blinkOffset: Math.floor(Math.random() * 260),
        };
        ballsRef.current.push(ball);

        const next = randomDropGem(difficultyRef.current);
        nextGemRef.current = next;
        setNextGemId(next);
        setTimeout(() => { canDropRef.current = true; }, 600);
    }, []);

    // ── Start / Restart ───────────────────────────────────────────────
    const startGame = useCallback(() => {
        ballsRef.current = [];
        scoreRef.current = 0;
        frameRef.current = 0;
        setScore(0);
        canDropRef.current = true;
        _nextId = 1;
        difficultyRef.current = difficulty;
        const first = randomDropGem(difficulty);
        nextGemRef.current = first;
        setNextGemId(first);
        dropXRef.current = CANVAS_W / 2;
        setPhase('playing');
    }, [difficulty]);

    // ─── Phase: charPick ──────────────────────────────────────────────
    if (phase === 'charPick') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-end px-4 h-12 border-b border-gray-800/40">
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <div className="text-4xl mb-1">💎</div>
                <h2 className="text-2xl font-bold text-white mb-1">Buried Treasure</h2>
                <p className="text-gray-400 text-sm mb-6">Match gems to unearth rarer stones</p>

                {allCharacters.length > 0 && (
                    <>
                        <p className="text-gray-300 text-sm mb-3">Choose a character to receive XP:</p>
                        <div className="flex flex-wrap gap-2 justify-center max-w-sm mb-6">
                            {allCharacters.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCharId(c.id)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                        selectedCharId === c.id
                                            ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
                                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <p className="text-gray-300 text-sm mb-3">Choose a difficulty:</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm mb-6">
                    {DIFFICULTIES.map(d => (
                        <button
                            key={d.id}
                            onClick={() => setDifficulty(d.id)}
                            title={d.desc}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                difficulty === d.id
                                    ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
                                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                            }`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>

                {/* Gem chain preview */}
                <div className="flex items-center gap-1 mb-6 flex-wrap justify-center max-w-xs">
                    {GEMS.map((g, i) => (
                        <React.Fragment key={g.id}>
                            <div
                                className="rounded-full border flex items-center justify-center text-xs font-bold"
                                style={{
                                    width: Math.max(18, g.radius * 0.8),
                                    height: Math.max(18, g.radius * 0.8),
                                    background: g.color,
                                    borderColor: g.strokeColor,
                                    fontSize: 8,
                                    color: '#333',
                                }}
                                title={g.label}
                            />
                            {i < GEMS.length - 1 && (
                                <span className="text-gray-600 text-xs">→</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex gap-1 flex-wrap justify-center max-w-xs mb-6">
                    {GEMS.map(g => (
                        <span key={g.id} className="text-gray-500 text-xs">{g.label}</span>
                    )).reduce((acc: React.ReactNode[], el, i, arr) => {
                        acc.push(el);
                        if (i < arr.length - 1) acc.push(<span key={`sep-${i}`} className="text-gray-700 text-xs">·</span>);
                        return acc;
                    }, [])}
                </div>

                <button onClick={startGame}
                    className="px-6 py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold transition-colors">
                    Start Digging
                </button>
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: over ─────────────────────────────────────────────────
    if (phase === 'over') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <div className="text-4xl mb-2">💎</div>
                <h2 className="text-3xl font-bold text-white mb-2">Game Over</h2>
                <p className="text-gray-400 text-sm mb-4">The treasure chest overflowed!</p>
                <div className="text-5xl font-black text-yellow-400 mb-2">{score.toLocaleString()}</div>
                <p className="text-gray-400 text-xs mb-8">gems unearthed</p>
                <div className="flex gap-3">
                    <button onClick={startGame}
                        className="px-6 py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold transition-colors">
                        Dig Again
                    </button>
                    <button onClick={onClose}
                        className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors">
                        Exit
                    </button>
                </div>
            </div>
        );
    }

    // ─── Phase: playing ───────────────────────────────────────────────
    const nextDef = GEM_BY_ID.get(nextGemId);

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center select-none">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl z-10">✕</button>

            {/* Header */}
            <div className="flex items-center gap-6 mb-3">
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Score</div>
                    <div className="text-2xl font-black text-yellow-400">{score.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Next</div>
                    {nextDef && (
                        <div className="flex flex-col items-center">
                            <div
                                className="rounded-full border"
                                style={{
                                    width: nextDef.radius * 2,
                                    height: nextDef.radius * 2,
                                    background: nextDef.color,
                                    borderColor: nextDef.strokeColor,
                                }}
                            />
                            <div className="text-xs text-gray-500 mt-0.5 max-w-[80px] text-center leading-tight">
                                {nextDef.label}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="rounded-xl cursor-crosshair border border-gray-800 touch-none"
                    onPointerMove={handlePointerMove}
                    onClick={handleDrop}
                    onTouchStart={e => {
                        const rect = canvasRef.current!.getBoundingClientRect();
                        const t = e.touches[0];
                        dropXRef.current = Math.max(30, Math.min(CANVAS_W - 30, t.clientX - rect.left));
                        handleDrop();
                    }}
                />

                {/* Merge flash */}
                {mergeFlash && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div
                            className={`backdrop-blur rounded-2xl px-6 py-4 text-center animate-bounce ${
                                mergeFlash.isGold
                                    ? 'bg-yellow-900/80 border border-yellow-400'
                                    : 'bg-black/70'
                            }`}
                            style={{ animationDuration: '0.4s', animationIterationCount: mergeFlash.isGold ? 4 : 2 }}
                        >
                            {mergeFlash.isGold && <div className="text-3xl mb-1">✨</div>}
                            <div className={`font-bold ${mergeFlash.isGold ? 'text-3xl text-yellow-300' : 'text-2xl text-white'}`}>
                                {mergeFlash.label}
                            </div>
                            {mergeFlash.isGold && (
                                <div className="text-yellow-400 text-sm mt-1">You found the Gold Nugget!</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Hint */}
            <p className="text-gray-600 text-xs mt-3">Click or tap to drop · Move cursor to aim</p>

            {/* Gem progression strip */}
            <div className="mt-2 flex items-center gap-0.5 flex-wrap justify-center max-w-xs">
                {GEMS.map((g, i) => (
                    <React.Fragment key={g.id}>
                        <div
                            className="rounded-full border opacity-70"
                            style={{
                                width: 14,
                                height: 14,
                                background: g.color,
                                borderColor: g.strokeColor,
                                borderWidth: 1,
                            }}
                            title={g.label}
                        />
                        {i < GEMS.length - 1 && (
                            <span className="text-gray-700 text-xs leading-none">›</span>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default BuriedTreasure;
