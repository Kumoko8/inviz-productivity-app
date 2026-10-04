import { getDownloadURL, getMetadata, ref } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Fetches a Firebase Storage download URL for the given path.
 * - Trims whitespace and skips empty paths.
 * - Retries once with any leading slashes stripped (handles paths stored with a
 *   leading "/" that Firebase Storage does not accept).
 * - On failure, logs a warning and returns "".
 */
export async function fetchAnimUrl(path?: string): Promise<string> {
    const raw = (path || "").toString().trim();
    if (!raw) return "";

    const candidates = [raw];
    if (raw.startsWith("/")) candidates.push(raw.replace(/^\/+/, ""));

    for (const p of candidates) {
        try {
            const url = await getDownloadURL(ref(storage, p));
            console.debug("storageUtils.fetchAnimUrl: resolved", { path: raw, candidate: p, url });
            return url;
        } catch (err) {
            console.warn("storageUtils.fetchAnimUrl: failed for candidate", p, err);
            try {
                const meta = await getMetadata(ref(storage, p));
                console.debug("storageUtils.fetchAnimUrl: metadata", p, meta);
            } catch (merr) {
                console.warn("storageUtils.fetchAnimUrl: getMetadata failed", p, merr);
            }
        }
    }

    return "";
}
