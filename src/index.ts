import {shardName, shardURL} from "./sharding/sharding";
import {getCache} from "./cache/cache";
import Toucan from "toucan-js";

export { Counter } from './counter/counter'

export interface Config {
	// how many durable objects to shard writes/reads to
	shardCount: number
	// how long to wait before flushing updates
	flushDelay: number
	// how long to wait before sending another update
	syncDelay: number
}

export const DefaultConfig: Config = {
	shardCount: 10,
	flushDelay: 5 * 1000,
	syncDelay: 2 * 1000
}

export interface WorkerAnalyticsNamespace {
	writeDataPoint(data: DataPoint): void
}

export interface DataPoint {
	blobs?: string[]
	doubles?: number[]
	indexes?: string[]
}

export interface Env {
	CONFIG: KVNamespace
	COUNTER: DurableObjectNamespace
	COUNTER_DATA: WorkerAnalyticsNamespace
	WORKER_DATA: WorkerAnalyticsNamespace
	SENTRY_DSN: string
	environment: string
}

const MAIN_SHARD = 'SHARD'

export async function getConfig(env: Env): Promise<Config> {
	let data = '{}'
	try {
		data = await env.CONFIG.get('worker') ?? '{}'
	} catch (e) {
		console.log('couldnt get config from kv')
	}
	const parsedConfig = JSON.parse(data)
	let config = DefaultConfig
	Object.assign(config, DefaultConfig, parsedConfig)
	return config
}

export default {
	fetch: handler
};


export async function handler(
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	const sentry = new Toucan({
		dsn: env.SENTRY_DSN,
		request,
		context: ctx,
		tracesSampleRate: 1.0,
		environment: env.environment
	})

	const config = await getConfig(env)
	const url = new URL(request.url)
	const key = url.pathname.slice(1)

	const dump = url.searchParams.get('dump')
	if (dump) {
		const id = env.COUNTER.idFromName(dump)
		const obj = env.COUNTER.get(id)
		const url = shardURL(dump)
		try {
			return obj.fetch(new Request(url + `?dump=true`))
		} catch (e) {
			sentry.captureException(e)
		}
	}

	if (url.pathname === '/favicon.ico') {
		return new Response('no favicon', {status: 404})
	}

	if (!key.length) {
		return new Response('invalid key', {status: 400})
	}
	const ip = request.headers.get('cf-connecting-ip') ?? ''
	const k = key + ip
	// randomize based on time for testing
	// const k = new Date().getTime().toString()
	const shardId = await shardName(MAIN_SHARD, k, [config.shardCount])


	if (request.method === 'PUT') {
		const id = env.COUNTER.idFromName(shardId)
		const obj = env.COUNTER.get(id)
		const req = new Request(shardURL(shardId, key), {method: 'PUT'})
		try {
			return obj.fetch(req)
		} catch (e) {
			sentry.captureException(e)
			return new Response('internal server error', {status: 500})
		}
	}

	if (request.method === 'GET') {
		const shardUrl = shardURL(shardId, key)
		const req = new Request(shardUrl, {method: 'GET'})

		let cache = await getCache()
		let res = await cache.match(req)
		//cache only works with workers behind custom domains
		if (res === undefined) {
			const id = env.COUNTER.idFromName(shardId)
			const obj = env.COUNTER.get(id)
			try {
				res = await obj.fetch(req)
			} catch (e) {
				sentry.captureException(e)
				return new Response('internal server error', {status: 500})
			}
			res = new Response(res.body, res)
			res.headers.append('Cache-Control', 's-maxage=5')
			ctx.waitUntil(cache.put(req, res.clone()))
	}
		return res
	}
	return new Response('not allowed', {status: 405});
}
