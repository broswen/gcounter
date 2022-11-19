import {Config, DataPoint, DefaultConfig, Env, getConfig} from "../index";
import {shardURL} from "../sharding/sharding";
import Toucan from "toucan-js";
import {GCounters} from "../gcounter/gcounter";

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
    state: DurableObjectState
    env: Env
    config: Config = DefaultConfig
    lastPropagation: number = 0
    details: PathDetails | undefined
    sentry: Toucan
    gcounters: GCounters = {}

    // created by setTimeout when scheduling a data flush
    flushTimeout: ReturnType<typeof setTimeout> | undefined

    constructor(state: DurableObjectState, env: Env) {
        this.state = state
        this.env = env
        this.state.blockConcurrencyWhile(async () => {
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
        const url = new URL(request.url)
        const details = parseShardPath(url.pathname)
        this.details = details

        this.sentry.setTags({
            'shardId': this.details?.shardId,
            'id': this.details?.id,
            'objectId': this.state.id.toString()
        })

        return new Response('method not allowed', {status: 405})
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
}