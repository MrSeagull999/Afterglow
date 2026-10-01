import sharp from 'sharp'
import test from 'node:test'
import assert from 'node:assert/strict'
import { KieImageProvider } from '../src/main/core/providers/KieImageProvider'
import { getResolvedProviderConfig } from '../src/shared/services/provider/resolvedProviderConfig'

const request = { model: 'gpt-image-2-5-flare', prompt: 'Edit the room', imageData: Buffer.from('source').toString('base64'), mimeType: 'image/png' }
function mock(responses: Array<Response | ((url: string, init?: RequestInit) => Promise<Response>)>) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift()
    assert.ok(next, 'Unexpected request')
    return typeof next === 'function' ? next(url, init) : next
  }) as typeof fetch
  return { calls, fetcher }
}
const ok = (data: unknown) => Response.json({ code: 200, data })
const upload = () => ok({ downloadUrl: 'https://storage.example/input.png' })
const created = () => ok({ taskId: 'task-1' })
const completed = () => ok({ state: 'success', resultJson: JSON.stringify({ resultUrls: ['https://storage.example/output.png'] }) })

test('Kie model selection overrides legacy provider env without changing Gemini routing', () => {
  assert.equal(getResolvedProviderConfig({ intendedModel: request.model, env: { IMAGE_PROVIDER: 'openrouter' } }).provider, 'kie')
  assert.equal(getResolvedProviderConfig({ intendedModel: 'gemini-3-pro-image-preview', env: { IMAGE_PROVIDER: 'openrouter' } }).provider, 'openrouter')
})
test('source and reference uploads, asynchronous polling, 4K and credential-free download', async () => {
  const { calls, fetcher } = mock([upload(), upload(), created(), ok({ state: 'generating' }), completed(), new Response('output', { headers: { 'Content-Type': 'image/png' } })])
  const result = await new KieImageProvider('test-key', fetcher, 0).generateImage({ ...request, imageSize: '4K', aspectRatio: '3:2', referenceImages: [{ imageData: request.imageData, mimeType: 'image/png', role: 'lighting reference' }] })
  assert.equal(result.success, true)
  assert.equal(result.imageData, Buffer.from('output').toString('base64'))
  const body = JSON.parse(calls[2].init!.body as string)
  assert.equal(body.model, 'gpt-image-2-5-flare-image-to-image')
  assert.equal(body.input.resolution, '4K')
  assert.equal(body.input.aspect_ratio, '3:2')
  assert.equal(body.input.input_urls.length, 2)
  assert.match(body.input.prompt, /Image 1: source image to edit/)
  assert.match(body.input.prompt, /Image 2: lighting reference/)
  assert.equal((calls[0].init!.headers as any).Authorization, 'Bearer test-key')
  assert.ok(calls[0].init!.body instanceof FormData)
  assert.equal(calls[5].init!.headers, undefined)
})
test('Sunburst text-to-image uses no uploads and maps HQ to 2K', async () => {
  const { calls, fetcher } = mock([created(), completed(), new Response('output', { headers: { 'Content-Type': 'image/png' } })])
  assert.equal((await new KieImageProvider('key', fetcher, 0).generateImage({ model: 'gpt-image-2-5-sunburst', prompt: 'Room', imageSize: '1536x1536' })).success, true)
  const body = JSON.parse(calls[0].init!.body as string)
  assert.equal(body.model, 'gpt-image-2-5-sunburst-text-to-image')
  assert.equal(body.input.resolution, '2K')
  assert.equal(body.input.input_urls, undefined)
})
test('missing key and unsupported inputs fail before making requests', async () => {
  const { fetcher, calls } = mock([])
  assert.match((await new KieImageProvider('', fetcher).generateImage(request)).error!, /KIE_API_KEY/)
  assert.equal((await new KieImageProvider('key', fetcher).generateImage({ ...request, imageSize: '4K', aspectRatio: '9:8' })).success, false)
  assert.equal((await new KieImageProvider('key', fetcher).generateImage({ ...request, referenceImages: Array(16).fill({ ...request, role: 'reference' }) })).success, false)
  assert.equal(calls.length, 0)
})
test('API failures, failed tasks and malformed results surface as failures', async () => {
  for (const responses of [
    [Response.json({ code: 401, msg: 'Invalid key' })],
    [upload(), created(), ok({ state: 'fail', failMsg: 'Generation rejected' })],
    [upload(), created(), ok({ state: 'success', resultJson: 'bad json' })],
    [upload(), created(), completed(), new Response('error', { status: 403 })]
  ]) {
    const { fetcher } = mock(responses)
    const result = await new KieImageProvider('key', fetcher, 0).generateImage(request)
    assert.equal(result.success, false)
    assert.ok(result.error)
  }
})
test('polling times out without submitting a second paid task', async () => {
  const { fetcher, calls } = mock([upload(), created(), async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })])
  const result = await new KieImageProvider('key', fetcher, 0, 20).generateImage(request)
  assert.match(result.error!, /timed out.*task-1/)
  assert.equal(calls.filter(call => call.url.endsWith('/createTask')).length, 1)
})

test('TIFF source is converted to PNG for Kie upload', async () => {
  const tiff = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).tiff().toBuffer()
  const { calls, fetcher } = mock([upload(), created(), completed(), new Response('output', { headers: { 'Content-Type': 'image/png' } })])
  const result = await new KieImageProvider('key', fetcher, 0).generateImage({ ...request, imageData: tiff.toString('base64'), mimeType: 'image/tiff' })
  assert.equal(result.success, true)
  const file = (calls[0].init!.body as FormData).get('file') as File
  assert.equal(file.type, 'image/png')
  assert.equal((await sharp(Buffer.from(await file.arrayBuffer())).metadata()).format, 'png')
})

test('Nano Banana Pro uses a single model ID, image_input and the requested ratio', async () => {
  const { calls, fetcher } = mock([upload(), created(), completed(), new Response('output', { headers: { 'Content-Type': 'image/png' } })])
  const result = await new KieImageProvider('key', fetcher, 0).generateImage({ ...request, model: 'nano-banana-pro', imageSize: '4K', aspectRatio: '4:5' })
  assert.equal(result.success, true)
  const body = JSON.parse(calls[1].init!.body as string)
  assert.equal(body.model, 'nano-banana-pro')
  assert.deepEqual(body.input.image_input, ['https://storage.example/input.png'])
  assert.equal(body.input.input_urls, undefined)
  assert.equal(body.input.background, undefined)
  assert.equal(body.input.resolution, '4K')
  assert.equal(body.input.aspect_ratio, '4:5')
  assert.equal(getResolvedProviderConfig({ intendedModel: 'nano-banana-pro' }).provider, 'kie')
})
test('Nano Banana Pro rejects more than 8 images before uploading', async () => {
  const { fetcher, calls } = mock([])
  const result = await new KieImageProvider('key', fetcher).generateImage({ ...request, model: 'nano-banana-pro', referenceImages: Array(8).fill({ ...request, role: 'reference' }) })
  assert.match(result.error!, /at most 8 images/)
  assert.equal(calls.length, 0)
})
