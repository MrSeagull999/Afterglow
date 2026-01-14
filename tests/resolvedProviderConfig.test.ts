import test from 'node:test'
import assert from 'node:assert/strict'

import { getResolvedProviderConfig } from '../src/shared/services/provider/resolvedProviderConfig'

test('getResolvedProviderConfig: UI openrouter, no env override -> openrouter, resolvedBy=ui', () => {
  const resolved = getResolvedProviderConfig({
    uiProvider: 'openrouter',
    intendedModel: 'gemini-3-pro-image-preview',
    env: {}
  })

  assert.equal(resolved.provider, 'openrouter')
  assert.equal(resolved.resolvedBy, 'ui')
  assert.equal(resolved.model, 'gemini-3-pro-image-preview')
  assert.equal(resolved.endpointBaseUrl, 'https://openrouter.ai/api/v1')
  assert.equal(resolved.envOverride, undefined)
})

test('getResolvedProviderConfig: UI google, no env override -> gemini, resolvedBy=ui', () => {
  const resolved = getResolvedProviderConfig({
    uiProvider: 'google',
    intendedModel: 'gemini-3-pro-image-preview',
    env: {}
  })

  assert.equal(resolved.provider, 'gemini')
  assert.equal(resolved.resolvedBy, 'ui')
  assert.equal(resolved.endpointBaseUrl, 'https://generativelanguage.googleapis.com/v1beta')
})

test('getResolvedProviderConfig: env IMAGE_PROVIDER=openrouter overrides UI and is explicit', () => {
  const resolved = getResolvedProviderConfig({
    uiProvider: 'google',
    intendedModel: 'gemini-3-pro-image-preview',
    env: { IMAGE_PROVIDER: 'openrouter' }
  })

  assert.equal(resolved.provider, 'openrouter')
  assert.equal(resolved.resolvedBy, 'env_override')
  assert.deepEqual(resolved.envOverride, { key: 'IMAGE_PROVIDER', value: 'openrouter' })
})

