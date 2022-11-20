let encoder: TextEncoder | null = null

export function shardLayers(firstLayerCount: number, shardRatio: number): number[] {
    let shards: number[] = []
    shards.push(firstLayerCount)
    while (shards[shards.length - 1] > shardRatio) {
        shards.push(Math.ceil(shards[shards.length - 1]/shardRatio))
    }
    return shards
}

export async function shardName(id: string, key: string, layers: number[]): Promise<string> {
    if (layers.length < 1) {
        return `${id}`
    }
    let name = id
    let prevShard = await rendezvousHash(key, layers[0])
    name = name + `:${prevShard}`

    for (let i = 1; i < layers.length; i++) {
        prevShard = await rendezvousHash(`${prevShard}`, layers[i])
        name = name + `:${prevShard}`
    }
    return name
}

export function shardURL(shardName: string, key?: string | null): string {
    let url = `https://gcounter.broswen.com/${shardName}`
    if (key) {
        url += '/' + key
    }
    return url
}

export async function hash(value: string): Promise<number> {
    if(encoder === null) {
        encoder = new TextEncoder()
    }
    const data = encoder.encode(value)
    const buf = await crypto.subtle.digest('SHA-1', data)
    const dv = new DataView(buf)
    return dv.getUint32(0)
}

function jumpConsistentHash(key: number, buckets: number): number {
    let k = BigInt(key)
    let b = BigInt(-1);
    let j = BigInt(0);
    while (j < buckets) {
        b = j;
        k =
            ((k * BigInt(2862933555777941757)) % BigInt(2) ** BigInt(64)) +
            BigInt(1);
        j = BigInt(
            Math.floor(
                ((Number(b) + 1) * Number(BigInt(1) << BigInt(31))) /
                Number((k >> BigInt(33)) + BigInt(1))
            )
        );
    }
    return Number(b);
}

export async function rank(key: string, shard: number): Promise<number> {
    if(encoder === null) {
        encoder = new TextEncoder()
    }
    const data = encoder.encode(`${key}${shard}`)
    const buf = await crypto.subtle.digest('SHA-1', data)
    const dv = new DataView(buf)
    return dv.getUint32(0)
}

export async function rendezvousHash(key: string, buckets: number): Promise<number> {
    let maxIndex = 0
    let maxValue = 0
    for (let i = 0; i < buckets; i++) {
        const value = await rank(key, i)
        if (value > maxValue) {
            maxIndex = i
            maxValue = value
        }
    }
    return maxIndex
}