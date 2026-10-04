import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import { characterData } from "../components/CharacterData";

async function fetchUrlForPath(path: string): Promise<string> {
    try {
        if (!path) return "";
        const r = ref(storage, path.trim());
        return await getDownloadURL(r);
    } catch (err) {
        console.warn("Could not fetch animation url for", path, err);
        return "";
    }
}

export default function usePreviewLoader(names: string[] = []) {
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            const map: Record<string, string> = {};
            for (const n of names) {
                const nameLower = (n || "").toLowerCase();
                const cd = characterData.find(c => ((c.name || "").toLowerCase() === nameLower));
                const path = cd?.animation || cd?.defaultAnimation || "";
                map[n] = path ? await fetchUrlForPath(path) : "";
            }
            if (mounted) setUrls(map);
            if (mounted) setLoading(false);
        };
        load().catch(e => {
            console.error("usePreviewLoader error", e);
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, [names.join("|")]);

    return { urls, loading };
}
