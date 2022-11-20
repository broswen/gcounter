import {parseShardPath, Counter} from "./counter";
import {DefaultConfig, getConfig} from "../index";
import {GCounters} from "../gcounter/gcounter";

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
    test('should return value', async () => {
        const id = env.COUNTER.newUniqueId()
        const storage = await getMiniflareDurableObjectStorage(id)
        storage.put<GCounters>('gcounters', {
            'key1': {
                'id1': 1,
                'id2': 1
            }
        })
        const stub = env.COUNTER.get(id)
        const res = await stub.fetch('https://gcounter.broswen.com/SHARD:1/key1')
        expect(await res.text()).toEqual('2')
        expect(res.status).toEqual(200)
    })
})

describe('flush', () => {
    test('schedule flush', async () => {
        const id = env.COUNTER.newUniqueId()
        const state = await getMiniflareDurableObjectState(id)
        jest.useFakeTimers()
        const shard = new Counter(state, env)
        const mockFlush = jest.fn()

        await shard.scheduleFlush(() => mockFlush())

        jest.advanceTimersByTime(4000)
        expect(shard.flushTimeout).not.toBeUndefined()

        jest.advanceTimersByTime(2000)
        expect(mockFlush).toHaveBeenCalled()
    })
    test('schedule and cancel flush', async () => {
        const id = env.COUNTER.newUniqueId()
        const state = await getMiniflareDurableObjectState(id)
        jest.useFakeTimers()
        const shard = new Counter(state, env)
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