import React, { useEffect, useRef } from 'react';
import { GRID, getSprite, type BubbleRecipe, type BubbleTile } from './rainbowBubbleTypes';

export const TileSprite: React.FC<{ pixels: string; size?: number; className?: string }> = ({ pixels, size = 40, className }) => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = ref.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, GRID, GRID);
        ctx.drawImage(getSprite(pixels), 0, 0);
    }, [pixels]);
    return (
        <canvas ref={ref} width={GRID} height={GRID} className={className}
            style={{ width: size, height: size, imageRendering: 'pixelated' }} />
    );
};

/** Sprite in a bubble with its name underneath. */
export const TileChip: React.FC<{ tile?: BubbleTile; size?: number; onClick?: () => void }> = ({ tile, size = 36, onClick }) => {
    if (!tile) return <span className="text-xs italic text-gray-600">missing</span>;
    return (
        <span className={`inline-flex flex-col items-center gap-0.5 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            style={{ maxWidth: 64 }} onClick={onClick} title={tile.name}>
            <span className="rounded-full border-2 border-purple-400/60 bg-white/10 flex items-center justify-center"
                style={{ width: size + 8, height: size + 8 }}>
                <TileSprite pixels={tile.pixels} size={size} />
            </span>
            <span className="text-gray-400 text-center leading-tight truncate w-full" style={{ fontSize: 9 }}>{tile.name}</span>
        </span>
    );
};

export const RecipeView: React.FC<{
    recipe: BubbleRecipe;
    tiles: Record<string, BubbleTile>;
    onTileClick?: (id: string) => void;
}> = ({ recipe, tiles, onTileClick }) => (
    <div className="flex flex-wrap items-start justify-center gap-1.5">
        <TileChip tile={tiles[recipe.a]} onClick={onTileClick && (() => onTileClick(recipe.a))} />
        {recipe.ingredients.map((id, i) => (
            <React.Fragment key={i}>
                <span className="text-gray-600 text-xs mt-3">+</span>
                <TileChip tile={tiles[id]} onClick={onTileClick && (() => onTileClick(id))} />
            </React.Fragment>
        ))}
        <span className="text-gray-600 text-xs mt-3">→</span>
        <TileChip tile={tiles[recipe.result]} onClick={onTileClick && (() => onTileClick(recipe.result))} />
        <span className="text-yellow-500 text-xs mt-3">+{recipe.xp}xp</span>
    </div>
);
