import {hash, rank, rendezvousHash, shardLayers, shardName, shardURL} from "./sharding";

describe('shardLayers', function () {
    test('tests', () => {
        expect(shardLayers(10, 2)).toEqual([10, 5, 3, 2])
        expect(shardLayers(100, 5)).toEqual([100, 20, 4])
        expect(shardLayers(120, 5)).toEqual([120, 24, 5])
    })
   test('should create with 10 shards per shard', () => {
       expect(shardLayers(100, 10)).toEqual([100, 10])
       expect(shardLayers(1000, 10)).toEqual([1000, 100, 10])
   })
   test('should create with 5 shards per shard', () => {
       expect(shardLayers(100, 5)).toEqual([100, 20, 4])
       expect(shardLayers(30, 5)).toEqual([30, 6, 2])
   })
});

describe('shardName', function () {
   test('should create shard name', async () => {
       expect(await shardName('shard', '5', [3, 2, 1])).toEqual('shard:0:0:0')
       expect(await shardName('shard', '5', [10, 5, 2])).toEqual('shard:0:0:0')
       expect(await shardName('shard', '5', [11, 6, 3])).toEqual('shard:0:0:0')
       expect(await shardName('shard', '5', [12, 7, 3])).toEqual('shard:0:0:0')
       expect(await shardName('shard', '5', [100, 50, 4])).toEqual('shard:64:19:0')
       expect(await shardName('shard', '5', [])).toEqual('shard')
   })
});

describe('shardURL', function () {
    test('should create url with shard name', () => {
        expect(shardURL('shard:1')).toEqual('https://shard.crystal.broswen.com/shard:1')
    })
    test('should create url with shard name and key', () => {
        expect(shardURL('shard:1', 'b')).toEqual('https://shard.crystal.broswen.com/shard:1/b')
    })
})

describe('hash', function () {
    test('should hash strings', async () => {
        expect(await hash('test')).toEqual(2840236005)
        expect(await hash('example data')).toEqual(2680433370)
    })
});

describe('rank', function () {
    test('should rank shards', async () => {
        expect(await rank('a', 1)).toBeTruthy()
    })
})

describe('rendezvous hash', function () {
   test('highest random weight', async () => {
       expect(await rendezvousHash('a', 10)).toEqual(1)
       expect(await rendezvousHash('a', 11)).toEqual(1)
       expect(await rendezvousHash('a', 12)).toEqual(1)
       expect(await rendezvousHash('a', 100)).toEqual(31)
       expect(await rendezvousHash('a', 101)).toEqual(31)
       expect(await rendezvousHash('a', 102)).toEqual(31)
   })
})