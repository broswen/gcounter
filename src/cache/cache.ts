
let crystalCache: Cache | undefined = undefined

const cacheName = 'CRYSTAL_CACHE'

export async function getCache(): Promise<Cache> {
    if (crystalCache === undefined) {
        crystalCache = await caches.open(cacheName)
    }
    return crystalCache
}