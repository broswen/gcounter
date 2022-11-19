

// Counter is a map of node id to value
export interface Counter {
    [key: string]: number
}

// Counts is a map of counter id to Counter
export interface Counters {
    [key: string]: Counter
}

export function mergeCounter(a: Counter, b: Counter): Counter {
    const c: Counter = {}
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

export function mergeCounters(a: Counters, b: Counters): Counters {
    const c: Counters = {}
    for (let [k, v] of Object.entries(a)) {
        c[k] = v
    }
    for (let [k, v] of Object.entries(b)) {
        if (k in c) {
            c[k] = mergeCounter(c[k], v)
        } else {
            c[k] = v
        }
    }
    return c
}

export function increment(a: Counter, node: string) {
    if (node in a) {
        a[node]++
    } else {
        a[node] = 1
    }
}

export function getValue(a: Counter): number {
    let sum = 0
    for (let v of Object.values(a)) {
        sum += v
    }
    return sum
}