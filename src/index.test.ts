import { handler } from './index'

class ExecutionContext {
    promises = [];
    waitUntil(promise: Promise<void>) {}
    passThroughOnException() {}
}

const env = getMiniflareBindings()
describe('fetch handler', () => {
    test('POST not allowed', async () => {
        const req = new Request("https://example.com/a", {method: 'POST'})
        const ctx = new ExecutionContext();
        const res = await handler(req, env, ctx)
        expect(res.status).toEqual(405)
    })
})