/**
 * Admin account configuration.
 * To grant admin privileges to an additional user, add their Firebase UID here.
 */
const ADMIN_UIDS = new Set<string>([
    'JqzlnoRP7teD5HS96B7SUIp2Tyg2','ZmJn94M9cEdTjju2GXH2GCkkRRl1'
]);

export function isAdmin(uid: string | null | undefined): boolean {
    if (!uid) return false;
    return ADMIN_UIDS.has(uid);
}
