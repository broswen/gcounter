import {parseShardPath, Shard} from "./shard";
import {DefaultConfig, getConfig} from "../index";
import mock = jest.mock;
import {Pair, Pairs} from "../pair/pair";

describe('parseShardPath', function () {
   test('should parse path', () => {
       expect(parseShardPath('/id:3:2:1/a')).toEqual({
           id: 'id',
           shardId: 'id:3:2:1',
           upperShardId: 'id:2:1',
           key: 'a',
           level: 4
       })
   })
    test('should parse path without key', () => {
       expect(parseShardPath('/id:3:2:1')).toEqual({
           id: 'id',
           shardId: 'id:3:2:1',
           upperShardId: 'id:2:1',
           key: '',
           level: 4
       })
   })
    test('main shard shouldnt have upper shard', () => {
        expect(parseShardPath('/id/a')).toEqual({
            id: 'id',
            shardId: 'id',
            upperShardId: '',
            key: 'a',
            level: 1
        })
        expect(parseShardPath('/shard')).toEqual({
            id: 'shard',
            shardId: 'shard',
            upperShardId: '',
            key: '',
            level: 1
        })
        expect(parseShardPath('/shard:1')).toEqual({
            id: 'shard',
            shardId: 'shard:1',
            upperShardId: 'shard',
            key: '',
            level: 2
        })
    })
    test('should throw on bad path', () => {
       expect(() => parseShardPath('/')).toThrow()
   })
});

const env = getMiniflareBindings()

describe('getConfig', () => {
    test('should get default config', async () => {
        expect(await getConfig(env)).toEqual(DefaultConfig)
    })
})

describe('get', () => {
    test('should get local state', async () => {
        const id = env.SHARDS.newUniqueId()
        const storage = await getMiniflareDurableObjectStorage(id)
        const pairs = {
            'a': {
                key: 'a',
                value: 'test',
                ts: 1
            }
        }
        await storage.put<Pairs>('pairs', pairs)
        const stub = env.SHARDS.get(id)
        const res = await stub.fetch('https://example.com/a')
        expect(res.status).toEqual(200)
    })
})

describe('flush', () => {
    test('schedule flush', async () => {
        const id = env.SHARDS.newUniqueId()
        const state = await getMiniflareDurableObjectState(id)
        jest.useFakeTimers()
        const shard = new Shard(state, env)
        const mockFlush = jest.fn()

        await shard.scheduleFlush(() => mockFlush())

        jest.advanceTimersByTime(4000)
        expect(shard.flushTimeout).not.toBeUndefined()

        jest.advanceTimersByTime(2000)
        expect(mockFlush).toHaveBeenCalled()
    })
    test('schedule and cancel flush', async () => {
        const id = env.SHARDS.newUniqueId()
        const state = await getMiniflareDurableObjectState(id)
        jest.useFakeTimers()
        const shard = new Shard(state, env)
        const mockFlush = jest.fn()

        await shard.scheduleFlush(() => mockFlush())

        jest.advanceTimersByTime(4000)
        expect(shard.flushTimeout).not.toBeUndefined()

        shard.cancelFlush()
        expect(shard.flushTimeout).toBeUndefined()

        jest.advanceTimersByTime(2000)
        expect(mockFlush).not.toHaveBeenCalled()
    })
})