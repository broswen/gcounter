import {shardLayers, shardName, shardURL} from "./sharding/sharding";
import {getCache} from "./cache/cache";
import Toucan from "toucan-js";
import {Pairs} from "./pair/pair";

export { Shard } from "./shard/shard";

export interface Config {
	shardCount: number
	shardRatio: number
}

export const DefaultConfig: Config = {
	shardCount: 100,
	shardRatio: 5
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
	PAIRS: KVNamespace
	SHARDS: DurableObjectNamespace
	SHARDS_DATA: WorkerAnalyticsNamespace
	WORKERS_DATA: WorkerAnalyticsNamespace
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
	const layers = shardLayers(config.shardCount, config.shardRatio)
	const url = new URL(request.url)
	const dump = url.searchParams.get('dump')
	const key = url.pathname.slice(1)

	if (dump) {
		const pairs: string = await env.PAIRS.get(MAIN_SHARD) ?? '{}'
		return new Response(pairs, {
			headers: {
				'dump': 'true',
				'Content-Type': 'application/json'
			}
		})
	}

	if (url.pathname === '/favicon.ico') {
		return new Response('no favicon', {status: 404})
	}

	if (!key.length) {
		return new Response('invalid key', {status: 400})
	}
	//shards should try to receive traffic from nearby colos
	const ip = request.headers.get('cf-connecting-ip') ?? ''
	const k = key + ip
	const shardId = await shardName(MAIN_SHARD, k, layers)

	const data = await request.text()

	env.WORKERS_DATA.writeDataPoint({
		blobs: [key, ip, request.method],
		indexes: [key]
	})

	if (request.method === 'PUT') {
		const id = env.SHARDS.idFromName(shardId)
		const obj = env.SHARDS.get(id)
		const req = new Request(shardURL(shardId, key), {method: 'PUT', body: data})
		try {
			return obj.fetch(req)
		} catch (e) {
			sentry.captureException(e)
			return new Response('internal server error', {status: 500})
		}
	}

	if (request.method === 'GET') {
		const shardUrl = shardURL(MAIN_SHARD, key)
		const req = new Request(shardUrl, {method: 'GET'})

		let cache = await getCache()
		let res = await cache.match(req)
		//cache only works with workers behind custom domains
		if (res === undefined) {
			const id = env.SHARDS.idFromName(MAIN_SHARD)
			const obj = env.SHARDS.get(id)
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
