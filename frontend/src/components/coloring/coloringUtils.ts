interface RGBA { r: number; g: number; b: number; a: number }

function getPixel(data: Uint8ClampedArray, i: number): RGBA {
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

function colorDist(a: RGBA, b: RGBA): number {
    return Math.sqrt(
        (a.r - b.r) ** 2 +
        (a.g - b.g) ** 2 +
        (a.b - b.b) ** 2 +
        (a.a - b.a) ** 2
    );
}

export function hexToRgba(hex: string): RGBA {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 255,
    };
}

/**
 * Scanline queue-based flood fill.
 * Mutates imageData.data in-place — caller must putImageData afterward.
 * Uses Euclidean RGBA distance for tolerance, which handles anti-aliased edges.
 *
 * @param imageData  Raw canvas ImageData
 * @param startX     Click X (integer, within canvas bounds)
 * @param startY     Click Y (integer, within canvas bounds)
 * @param fillHex    CSS hex color to fill with, e.g. "#ff4488"
 * @param tolerance  0–255; how different a pixel can be from the seed and still be filled
 */
export function floodFill(
    imageData: ImageData,
    startX: number,
    startY: number,
    fillHex: string,
    tolerance: number = 30
): void {
    const { width, height, data } = imageData;
    const fill = hexToRgba(fillHex);

    const seedIdx = (startY * width + startX) * 4;
    const seed = getPixel(data, seedIdx);

    // If the seed pixel is already the fill color, nothing to do
    if (colorDist(seed, fill) < 2) return;

    const visited = new Uint8Array(width * height);
    const queue: number[] = [startY * width + startX];
    visited[startY * width + startX] = 1;

    while (queue.length > 0) {
        // Pop from the end (stack-style) — faster than shift
        const pos = queue.pop()!;
        const x = pos % width;
        const y = (pos - x) / width;
        const i = pos * 4;

        const cur = getPixel(data, i);
        if (colorDist(cur, seed) > tolerance) continue;

        // Fill this pixel
        data[i] = fill.r;
        data[i + 1] = fill.g;
        data[i + 2] = fill.b;
        data[i + 3] = fill.a;

        // Push 4-connected neighbors
        if (x > 0 && !visited[pos - 1]) {
            visited[pos - 1] = 1;
            queue.push(pos - 1);
        }
        if (x < width - 1 && !visited[pos + 1]) {
            visited[pos + 1] = 1;
            queue.push(pos + 1);
        }
        if (y > 0 && !visited[pos - width]) {
            visited[pos - width] = 1;
            queue.push(pos - width);
        }
        if (y < height - 1 && !visited[pos + width]) {
            visited[pos + width] = 1;
            queue.push(pos + width);
        }
    }
}
