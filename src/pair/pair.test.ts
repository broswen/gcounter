import {mergePairs, Pairs} from "./pair";

describe('pair', function () {
   test('mergePairs should merge', () => {
       const pairs1: Pairs = {
           "a": {
               key: "a",
               value: "a",
               ts: 1
           }
       }
       const pairs2: Pairs = {
           "b": {
               key: "b",
               value: "b",
               ts: 1
           }
       }
       const merged = {
           "a": {
               key: "a",
               value: "a",
               ts: 1
           },
           "b": {
               key: "b",
               value: "b",
               ts: 1
           }
       }
       expect(mergePairs(pairs1, pairs2)).toEqual(merged)
   })

    test('mergePairs should overwrite older', () => {
       const pairs1: Pairs = {
           "a": {
               key: "a",
               value: "a",
               ts: 1
           }
       }
       const pairs2: Pairs = {
           "a": {
               key: "a",
               value: "a",
               ts: 2
           }
       }
       const merged = {
           "a": {
               key: "a",
               value: "a",
               ts: 2
           }
       }
       expect(mergePairs(pairs1, pairs2)).toEqual(merged)
   })
});