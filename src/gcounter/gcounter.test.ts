import {Gcounter, GCounters, increment, mergeGCounter, mergeGCounters} from "./gcounter";

describe('Counter', () => {
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

describe('Counters', () => {
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
        increment(a, 'node1')
        increment(a, 'node2')
        expect(a).toStrictEqual({
            'node1': 1,
            'node2': 1
        })
    })
})