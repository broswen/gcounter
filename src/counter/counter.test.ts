import {Counter, Counters, mergeCounter, mergeCounters} from "./counter";

describe('Counter', () => {
    test('should merge counters properly', () => {
        const a: Counter = {
            'node1': 1,
            'node2': 2
        }
        const b: Counter = {
            'node1': 1,
            'node2': 2,
            'node3': 2
        }
        expect(mergeCounter(a, b)).toEqual({
            'node1': 1,
            'node2': 2,
            'node3': 2
        })
    })
    test('should merge empty', () => {
        const a: Counter = {
            'node1': 1,
            'node2': 2
        }
        const b: Counter = {
        }
        expect(mergeCounter(a, b)).toEqual({
            'node1': 1,
            'node2': 2,
        })
    })
})

describe('Counters', function () {
    test('should merge counters', () => {
        const a: Counters = {
           'key1': {
               'node1': 1,
               'node2': 3
           },
           'key2': {
               'node1': 2,
               'node2': 2
           }
        }
        const b: Counters = {
           'key1': {
               'node1': 2,
               'node2': 2
           },
           'key2': {
               'node1': 1,
               'node2': 3
           }
        }
        expect(mergeCounters(a, b)).toEqual({
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