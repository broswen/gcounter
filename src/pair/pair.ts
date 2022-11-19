export interface Pair {
    key: string
    value: string | null
    ts: number
}

export interface Pairs {
    [key: string]: Pair
}

export function mergePairs(pairs1: Pairs, pairs2: Pairs): Pairs {
    let newPairs: Pairs = {}
    for (let [k, v] of Object.entries(pairs1)) {
        newPairs[k] = v
    }
    for (let [k, v] of Object.entries(pairs2)) {
        //ignore if pairs2 value is older
        if (newPairs[k] !== undefined && newPairs[k].ts > v.ts) {
           continue
        }
        newPairs[k] = v
    }
    return newPairs
}