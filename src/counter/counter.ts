import {Config, DefaultConfig, Env, getConfig} from "../index";
import Toucan from "toucan-js";
import {GCounters, getGCounters, incrementGCounters, mergeGCounters} from "../gcounter/gcounter";
import {shardURL} from "../sharding/sharding";

export interface PathDetails {
    level: number
    id: string
    shardId: string
    upperShardId: string
    key: string
}

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

export class Counter implements DurableObject {
    id: string = ''
    state: DurableObjectState
    env: Env
    config: Config = DefaultConfig
    lastSync: number = 0
    details: PathDetails | undefined
    sentry: Toucan
    gcounters: GCounters = {}

    // created by setTimeout when scheduling a data flush
    flushTimeout: ReturnType<typeof setTimeout> | undefined

    constructor(state: DurableObjectState, env: Env) {
        this.state = state
        this.env = env
        this.state.blockConcurrencyWhile(async () => {
            this.id = this.state.id.toString()
            this.gcounters = await this.state.storage?.get<GCounters>('gcounters') ?? {}
            this.config = await getConfig(this.env)
        })
        this.sentry = new Toucan({
            dsn: this.env.SENTRY_DSN,
            context: this.state,
            tracesSampleRate: 1.0,
            environment: env.environment
        })
    }

    async fetch(request: Request): Promise<Response> {
        console.log(request.url)
        try {
            const url = new URL(request.url)
            this.details = parseShardPath(url.pathname)

            this.sentry.setTags({
                'shardId': this.details?.shardId,
                'id': this.details?.id,
                'objectId': this.state.id.toString()
            })

            const dump = url.searchParams.get('dump')
            if (dump) {
                return new Response(JSON.stringify(this.gcounters), {headers: {'Content-Type': 'application/json'}})
            }

            if (request.method === 'GET') {
                if (this.details.key === '') {
                    return new Response('invalid key', {status: 400})
                }

                await this.maybeSync(this.details.upperShardId)

                const value = getGCounters(this.gcounters, this.details.key)
                if (value === undefined) {
                    return new Response('not found', {status: 404})
                }
                return new Response(JSON.stringify(value))
            }

            if (request.method === 'PUT') {
                incrementGCounters(this.gcounters, this.details.key, this.details.shardId)
                const value = getGCounters(this.gcounters, this.details.key)
                this.state.storage.put<GCounters>('gcounters', this.gcounters)
                this.maybeSync(this.details.upperShardId)
                return new Response(JSON.stringify(value))
            }

            if (request.method === 'PATCH') {
                const state = await request.json<GCounters>()
                this.gcounters = mergeGCounters(this.gcounters, state)
                this.state.storage.put<GCounters>('gcounters', this.gcounters)
                return new Response(JSON.stringify(this.gcounters))
            }

            return new Response('method not allowed', {status: 405})
        } catch (e) {
            this.sentry.captureException(e)
            return new Response(JSON.stringify(e), {status: 500})
        }
    }

    // scheduleFlush schedules f() to run FLUSH_DELAY milliseconds later
    async scheduleFlush(f: () => Promise<void>): Promise<void> {
        this.flushTimeout = setTimeout(f, this.config.flushDelay)
    }

    // cancelFlush clears the current flushTimeout if set
    cancelFlush(): void {
        if (this.flushTimeout !== undefined) {
            clearTimeout(this.flushTimeout)
            this.flushTimeout = undefined
        }
    }

    async maybeSync(name: string): Promise<void> {
        this.cancelFlush()
        if (new Date().getTime() - this.lastSync <= this.config.syncDelay) {
            this.scheduleFlush(() => this.sync(name))
            return
        }
        return this.sync(name)
    }

    async sync(name: string): Promise<void> {
        const id = this.env.COUNTER.idFromName(name)
        const obj = this.env.COUNTER.get(id)
        const req = new Request(shardURL(name), {method: 'PATCH', body: JSON.stringify(this.gcounters)})
        const resp = await obj.fetch(req)
        if (resp.ok) {
            this.lastSync = new Date().getTime()
            const state = await resp.json<GCounters>()
            this.gcounters = mergeGCounters(this.gcounters, state)
        }
        return
    }
}