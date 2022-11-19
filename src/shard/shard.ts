import {mergePairs, Pair, Pairs} from "../pair/pair";
import {DataPoint, Env} from "../index";
import {shardURL} from "../sharding/sharding";
import Toucan from "toucan-js";

export interface PathDetails {
    level: number
    id: string
    shardId: string
    upperShardId: string
    key: string
}

// how long to wait before flushing
export const FLUSH_DELAY = 5 * 1000
// rate limit for upper shard propagation
export const PROPAGATION_RATE = 2 * 1000

export function upperShard(shardId: string): string {
//    SHARD:3:2:1
    const shardParts = shardId.split(':')

    if (shardParts.length > 2) {
        return shardParts[0] + ':' + shardParts.slice(2).join(':')
    } else if (shardParts.length === 2) {
        return shardParts[0]
    }
    return ''
}
export function parseShardPath(path: string): PathDetails {
    let details: PathDetails = {
        level: 0,
        id: '',
        shardId: '',
        upperShardId: '',
        key: ''
    }
    // /id:10:5:3/A
    const pathParts = path.split('/')
    if (pathParts.length < 2) {
        throw new Error(`malformed request path: ${path}`)
    }
    if (pathParts[1] === '') {
        throw new Error(`malformed request path: ${path}`)
    }
    if (pathParts.length > 2) {
        details.key = pathParts[2]
    }
    details.shardId = pathParts[1]
    details.upperShardId = upperShard(details.shardId)

    const shardParts = pathParts[1].split(':')
    details.level = shardParts.length

    details.id = shardParts[0]
    return details
}

export interface ShardAnalytics {
    id: string
    shardId: string
    key: string
    method: string
    level: number
    keys: number
}

export class Shard implements DurableObject {
    state: DurableObjectState
    pairs: Pairs = {}
    env: Env
    lastPropagation: number = 0
    // used in the alarm handler, alarm should run before memory is evicted based on ALARM_DELAY < 30 seconds
    details: PathDetails | undefined
    shardAnalytics: ShardAnalytics
    sentry: Toucan

    // created by setTimeout when scheduling a data flush
    flushTimeout: ReturnType<typeof setTimeout> | undefined

    constructor(state: DurableObjectState, env: Env) {
        this.state = state
        this.env = env
        this.shardAnalytics = {
            id: '',
            shardId: '',
            key: '',
            method: '',
            level: -1,
            keys: -1
        }
        this.state.blockConcurrencyWhile(async () => {
            this.pairs = await this.state.storage?.get<Pairs>('pairs') ?? {}
        })
        this.sentry = new Toucan({
            dsn: this.env.SENTRY_DSN,
            context: this.state,
            tracesSampleRate: 1.0,
            environment: env.environment
        })
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url)
        const details = parseShardPath(url.pathname)
        this.details = details
        const mainShard = details.upperShardId === ''

        this.sentry.setTags({
            'shardId': this.details?.shardId,
            'id': this.details?.id,
            'objectId': this.state.id.toString()
        })

        this.shardAnalytics = {
            id: details.id,
            shardId: details.shardId,
            key: details.key,
            method: request.method,
            level: details.level,
            keys: Object.keys(this.pairs).length
        }

        if (details.id === '') {
            return new Response('bad request path', {status: 400})
        }
        if (request.method === 'GET') {
            // get value from local state or return not found
            let pair = this.pairs[details.key]
            let status = 200
            if (pair === undefined) {
                let status = 404
                pair = {
                    key: details.key,
                    value: null,
                    ts: new Date().getTime()
                }
            }
            this.writeAnalytics()
            return new Response(JSON.stringify(pair), {status, headers: {'Content-Type': 'application/json'}})
        }

        if (request.method === 'PUT') {
            // only non-main shards receive PUT requests
            // set value in local state, propagate to upper shard
            const data = await request.text()
            const pair = {
                key: details.key,
                value: data,
                ts: new Date().getTime()
            }
            this.pairs[details.key] = pair
            if(this.details.level === 1) {
                // main shard, persist data
                this.state.storage?.put<Pairs>('pairs', this.pairs)
                this.env.PAIRS.put(this.details.id, JSON.stringify(this.pairs))
            } else {
                // not main shard, propagate changes
                this.maybePropagateChanges(this.details.upperShardId)
            }
            this.writeAnalytics()
            return new Response(JSON.stringify(pair), {headers: {'Content-Type': 'application/json'}})
        }

        if (request.method === 'PATCH') {
            // merge pairs with own state
            const pairs: Pairs = await request.json<Pairs>()
            const merged = mergePairs(pairs, this.pairs)
            this.pairs = merged
            if(this.details.level === 1) {
                // main shard, persist data
                this.state.storage?.put<Pairs>('pairs', this.pairs)
                this.env.PAIRS.put(this.details.id, JSON.stringify(this.pairs))
            } else {
                // not main shard, propagate changes
                this.maybePropagateChanges(this.details.upperShardId)
            }
            this.writeAnalytics()
            return new Response('OK')
        }
        return new Response('method not allowed', {status: 405})
    }

    // scheduleFlush schedules f() to run FLUSH_DELAY milliseconds later
    async scheduleFlush(f: () => Promise<void>): Promise<void> {
        this.flushTimeout = setTimeout(f, FLUSH_DELAY)
    }

    // cancelFlush clears the current flushTimeout if set
    cancelFlush(): void {
        if (this.flushTimeout !== undefined) {
            clearTimeout(this.flushTimeout)
            this.flushTimeout = undefined
        }
    }

    // maybePRopagateChanges rate-limits propagateChanges and schedules a flush if necessary
    async maybePropagateChanges(upperShardId: string): Promise<void> {
        this.cancelFlush()
        if (new Date().getTime() - this.lastPropagation < PROPAGATION_RATE) {
            this.scheduleFlush(() => this.propagateChanges(upperShardId))
        } else {
            try {
                this.propagateChanges(upperShardId)
            }catch (e) {
                this.sentry.captureException(e)
            }
        }
    }

    // propagateChanges PATCHes local data to the upper shard
    async propagateChanges(upperShardId: string): Promise<void> {
        const id = this.env.SHARDS.idFromName(upperShardId)
        const obj = this.env.SHARDS.get(id)
        const req = new Request(shardURL(upperShardId), {method: 'PATCH', body: JSON.stringify(this.pairs)})
        const resp = await obj.fetch(req)
        if (resp.ok)  {
            this.lastPropagation = new Date().getTime()
            // if propagation was successful, we can clear the local shard state
            this.pairs = {}
        }
        return
    }

    // writeAnalytics writes the current shard analytics to workers analytics engine
    async writeAnalytics(): Promise<void> {
        let data: DataPoint = {
            blobs: [this.shardAnalytics.id, this.shardAnalytics.shardId, this.shardAnalytics.key, this.shardAnalytics.method],
            doubles: [this.shardAnalytics.level, Object.keys(this.pairs).length],
            indexes: [this.shardAnalytics.shardId]
        }

        this.env.SHARDS_DATA.writeDataPoint(data)
    }
}