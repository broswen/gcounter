

// Gcounter is a map of node id to value
export interface Gcounter {
    [key: string]: number
}

// Counts is a map of gcounter id to Gcounter
export interface GCounters {
    [key: string]: Gcounter
}

export function mergeGCounter(a: Gcounter, b: Gcounter): Gcounter {
    const c: Gcounter = {}
    for (let [k, v] of Object.entries(a)) {
        c[k] = v
    }
    for (let [k, v] of Object.entries(b)) {
        if (k in c) {
            if (v > c[k]) {
                c[k] = v
            }
        } else {
            c[k] = v
        }
    }
    return c
}

export function mergeGCounters(a: GCounters, b: GCounters): GCounters {
    const c: GCounters = {}
    for (let [k, v] of Object.entries(a)) {
        c[k] = v
    }
    for (let [k, v] of Object.entries(b)) {
        if (k in c) {
            c[k] = mergeGCounter(c[k], v)
        } else {
            c[k] = v
        }
    }
    return c
}

export function increment(a: Gcounter, node: string) {
    if (node in a) {
        a[node]++
    } else {
        a[node] = 1
    }
}

export function getValue(a: Gcounter): number {
    let sum = 0
    for (let v of Object.values(a)) {
        sum += v
    }
    return sum
}