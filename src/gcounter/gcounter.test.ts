import {
    Gcounter,
    GCounters,
    getGCounter, getGCounters,
    incrementGCounter,
    incrementGCounters,
    mergeGCounter,
    mergeGCounters
} from "./gcounter";

describe('GCounter', () => {
    test('should merge counters properly', () => {
        const a: Gcounter = {
            'node1': 1,
            'node2': 2
        }
        const b: Gcounter = {
            'node1': 1,
            'node2': 2,
            'node3': 2
        }
        expect(mergeGCounter(a, b)).toEqual({
            'node1': 1,
            'node2': 2,
            'node3': 2
        })
    })
    test('should merge empty', () => {
        const a: Gcounter = {
            'node1': 1,
            'node2': 2
        }
        const b: Gcounter = {
        }
        expect(mergeGCounter(a, b)).toEqual({
            'node1': 1,
            'node2': 2,
        })
    })
})

describe('GCounters', () => {
    test('should merge counters', () => {
        const a: GCounters = {
           'key1': {
               'node1': 1,
               'node2': 3
           },
           'key2': {
               'node1': 2,
               'node2': 2
           }
        }
        const b: GCounters = {
           'key1': {
               'node1': 2,
               'node2': 2
           },
           'key2': {
               'node1': 1,
               'node2': 3
           }
        }
        expect(mergeGCounters(a, b)).toEqual({
            'key1': {
                'node1': 2,
                'node2': 3
            },
            'key2': {
                'node1': 2,
                'node2': 3
            }
        })
    })
});

describe('increment', () => {
    test('should increment empty', () => {
        const a: Gcounter = {}
        incrementGCounter(a, 'node1')
        incrementGCounter(a, 'node2')
        expect(a).toStrictEqual({
            'node1': 1,
            'node2': 1
        })
    })
    test('should increment empty with key', () => {
        const a: GCounters = {}
        incrementGCounters(a, 'key1', 'node1')
        incrementGCounters(a, 'key1', 'node2')
        expect(a).toStrictEqual({
            'key1': {
                'node1': 1,
                'node2': 1
            }
        })
    })
})

describe('get', () => {
    test('should get counter value', () => {
        const a: Gcounter = {
            'node1': 1,
            'node2': 2
        }
        expect(getGCounter(a)).toBe(3)
    })
    test('should get counters value', () => {
        const a: GCounters = {
            'key1': {
                'node1': 1,
                'node2': 2
            }
        }
        expect(getGCounters(a, 'key1')).toBe(3)
        expect(getGCounters(a, 'key2')).toBeUndefined()
    })
})