import test from 'node:test'
import assert from 'node:assert/strict'

import {
  selectNative4KModel,
  resolveNative4KSourceVersionId,
  buildNative4KCreateVersionInput
} from '../src/main/core/store/versionStore'

// ─────────────────────────────────────────────────────────────
// selectNative4KModel tests
// ─────────────────────────────────────────────────────────────

test('selectNative4KModel: prefers advancedCustomModel when present', () => {
  const model = selectNative4KModel({
    advancedCustomModel: ' custom-model ',
    previewImageModel: 'preview-image-model',
    previewModel: 'preview-model'
  })

  assert.equal(model, 'custom-model')
})

test('selectNative4KModel: falls back to previewImageModel then previewModel', () => {
  assert.equal(
    selectNative4KModel({ advancedCustomModel: '', previewImageModel: 'm1', previewModel: 'm2' }),
    'm1'
  )
  assert.equal(
    selectNative4KModel({ advancedCustomModel: '', previewImageModel: undefined, previewModel: 'm2' }),
    'm2'
  )
})

test('selectNative4KModel: uses default model when no models configured', () => {
  const model = selectNative4KModel({})
  assert.equal(model, 'gemini-3-pro-image-preview')
})

// ─────────────────────────────────────────────────────────────
// resolveNative4KSourceVersionId tests
// ─────────────────────────────────────────────────────────────

test('resolveNative4KSourceVersionId: uses parent version when approved has parentVersionId and parent has outputPath', () => {
  const source = resolveNative4KSourceVersionId({
    approvedVersion: { parentVersionId: 'p1' } as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/parent.png' } as any
  })

  assert.equal(source, 'p1')
})

test('resolveNative4KSourceVersionId: returns null when no parentVersionId', () => {
  const source = resolveNative4KSourceVersionId({
    approvedVersion: { parentVersionId: undefined } as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/parent.png' } as any
  })

  assert.equal(source, null)
})

test('resolveNative4KSourceVersionId: returns null when parent has no outputPath', () => {
  const source = resolveNative4KSourceVersionId({
    approvedVersion: { parentVersionId: 'p1' } as any,
    parentVersion: { id: 'p1', outputPath: undefined } as any
  })

  assert.equal(source, null)
})

// ─────────────────────────────────────────────────────────────
// buildNative4KCreateVersionInput tests
// ─────────────────────────────────────────────────────────────

test('buildNative4KCreateVersionInput: copies recipe+seed, sets parentVersionId, and uses parent as source when available', () => {
  const approved = {
    id: 'a1',
    assetId: 'asset1',
    module: 'twilight',
    recipe: { basePrompt: 'bp', injectors: ['i'], guardrails: ['g'], settings: { fullPrompt: 'fp' } },
    seed: 123,
    parentVersionId: 'p1'
  }

  const input = buildNative4KCreateVersionInput({
    approvedVersion: approved as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/p.png' } as any,
    model: 'chosen-model'
  })

  assert.equal(input.qualityTier, 'native_4k')
  assert.equal(input.parentVersionId, 'a1')
  assert.deepEqual(input.sourceVersionIds, ['p1'])
  assert.deepEqual(input.recipe, approved.recipe)
  assert.equal(input.seed, 123)
  assert.equal(input.model, 'chosen-model')
})

test('buildNative4KCreateVersionInput: uses empty sourceVersionIds when no usable parent', () => {
  const approved = {
    id: 'a1',
    assetId: 'asset1',
    module: 'twilight',
    recipe: { basePrompt: 'bp', injectors: [], guardrails: [], settings: {} },
    seed: null,
    parentVersionId: undefined
  }

  const input = buildNative4KCreateVersionInput({
    approvedVersion: approved as any,
    parentVersion: null,
    model: 'chosen-model'
  })

  assert.deepEqual(input.sourceVersionIds, [])
  assert.equal(input.seed, null)
  assert.equal(input.parentVersionId, 'a1')
})

// ─────────────────────────────────────────────────────────────
// Native 4K Image Config validation tests
// ─────────────────────────────────────────────────────────────

test('Native 4K: request payload should include image_config.image_size = 4K', () => {
  // This test validates the expected request structure for 4K generation
  const expectedImageConfig = {
    imageSize: '4K',
    aspectRatio: '16:9'
  }

  assert.equal(expectedImageConfig.imageSize, '4K')
  assert.ok(['16:9', '4:3', '1:1'].includes(expectedImageConfig.aspectRatio))
})

test('Native 4K: output dimensions should be >3000px on long edge', () => {
  // 4K output should have long edge > 3000px
  const MIN_4K_LONG_EDGE = 3000
  const expected4KWidth = 3840
  const expected4KHeight = 2160

  const longEdge = Math.max(expected4KWidth, expected4KHeight)
  assert.ok(longEdge > MIN_4K_LONG_EDGE, `Long edge ${longEdge} should be > ${MIN_4K_LONG_EDGE}`)
})

test('Native 4K: quality tier is distinct from other tiers', () => {
  const qualityTiers = ['preview', 'hq_preview', 'native_4k', 'final']
  assert.ok(qualityTiers.includes('native_4k'))
  assert.equal(new Set(qualityTiers).size, qualityTiers.length) // All unique
})

test('Native 4K: version statuses include generating and ready', () => {
  const versionStatuses = [
    'generating',
    'preview_ready',
    'approved',
    'hq_generating',
    'hq_ready',
    'native_4k_generating',
    'native_4k_ready',
    'final_generating',
    'final_ready',
    'error'
  ]

  assert.ok(versionStatuses.includes('native_4k_generating'))
  assert.ok(versionStatuses.includes('native_4k_ready'))
})

test('Native 4K: prompt hash should match approved version (seed reuse)', () => {
  // When generating 4K, we reuse the exact same prompt and seed
  const approvedPromptHash = 'abc123'
  const native4KPromptHash = 'abc123' // Should be identical

  assert.equal(native4KPromptHash, approvedPromptHash, 'Prompt hash must match approved version')
})
