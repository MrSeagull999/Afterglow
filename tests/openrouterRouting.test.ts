import test from 'node:test'
import assert from 'node:assert/strict'

import { OpenRouterProvider } from '../src/main/core/providers/OpenRouterProvider'
import { GoogleGeminiProvider } from '../src/main/core/providers/GoogleGeminiProvider'
import { getResolvedProviderConfig } from '../src/shared/services/provider/resolvedProviderConfig'

test('OpenRouter routing: uses OpenRouter base URL + Authorization Bearer OPENROUTER_API_KEY and JSON content-type', async () => {
  const calls: any[] = []

  const originalFetch = globalThis.fetch
  ;(globalThis as any).fetch = async (url: any, init: any) => {
    calls.push({ url, init })
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'data:image/png;base64,aGVsbG8=' } }] })
    } as any
  }

  try {
    const provider = new OpenRouterProvider('TEST_KEY', 'https://openrouter.ai/api/v1')

    const res = await provider.generateImage({
      model: 'gemini-3-pro-image-preview',
      prompt: 'P',
      imageData: 'AAA',
      mimeType: 'image/jpeg'
    })

    assert.equal(res.success, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
    assert.equal(calls[0].init.headers['Authorization'], 'Bearer TEST_KEY')
  } finally {
    ;(globalThis as any).fetch = originalFetch
  }
})

test('Resolved provider=openrouter -> do not use Gemini provider class', () => {
  const resolved = getResolvedProviderConfig({
    uiProvider: 'google',
    intendedModel: 'gemini-3-pro-image-preview',
    env: { IMAGE_PROVIDER: 'openrouter' }
  })

  assert.equal(resolved.provider, 'openrouter')

  const openrouter = new OpenRouterProvider('K', resolved.endpointBaseUrl)
  assert.equal(openrouter.name, 'openrouter')
  assert.equal(openrouter instanceof GoogleGeminiProvider, false)
})
