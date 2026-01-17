import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveHqRegenSourceVersionId,
  selectHqRegenModel,
  buildHqRegenCreateVersionInput
} from '../src/main/core/store/versionStore'

test('resolveHqRegenSourceVersionId: uses parent version when approved has parentVersionId and parent has outputPath', () => {
  const source = resolveHqRegenSourceVersionId({
    approvedVersion: { parentVersionId: 'p1' } as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/parent.png' } as any
  })

  assert.equal(source, 'p1')
})

test('resolveHqRegenSourceVersionId: returns null when no parentVersionId', () => {
  const source = resolveHqRegenSourceVersionId({
    approvedVersion: { parentVersionId: undefined } as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/parent.png' } as any
  })

  assert.equal(source, null)
})

test('resolveHqRegenSourceVersionId: returns null when parent has no outputPath', () => {
  const source = resolveHqRegenSourceVersionId({
    approvedVersion: { parentVersionId: 'p1' } as any,
    parentVersion: { id: 'p1', outputPath: undefined } as any
  })

  assert.equal(source, null)
})

test('selectHqRegenModel: prefers advancedCustomModel when present', () => {
  const model = selectHqRegenModel({
    advancedCustomModel: ' custom-model ',
    previewImageModel: 'preview-image-model',
    previewModel: 'preview-model'
  })

  assert.equal(model, 'custom-model')
})

test('selectHqRegenModel: falls back to previewImageModel then previewModel', () => {
  assert.equal(
    selectHqRegenModel({ advancedCustomModel: '', previewImageModel: 'm1', previewModel: 'm2' }),
    'm1'
  )
  assert.equal(
    selectHqRegenModel({ advancedCustomModel: '', previewImageModel: undefined, previewModel: 'm2' }),
    'm2'
  )
})

test('buildHqRegenCreateVersionInput: copies recipe+seed, sets parentVersionId, and uses parent as source when available', () => {
  const approved = {
    id: 'a1',
    assetId: 'asset1',
    module: 'twilight',
    recipe: { basePrompt: 'bp', injectors: ['i'], guardrails: ['g'], settings: { fullPrompt: 'fp' } },
    seed: 123,
    parentVersionId: 'p1'
  }

  const input = buildHqRegenCreateVersionInput({
    approvedVersion: approved as any,
    parentVersion: { id: 'p1', outputPath: '/tmp/p.png' } as any,
    model: 'chosen-model'
  })

  assert.equal(input.qualityTier, 'hq_preview')
  assert.equal(input.parentVersionId, 'a1')
  assert.deepEqual(input.sourceVersionIds, ['p1'])
  assert.deepEqual(input.recipe, approved.recipe)
  assert.equal(input.seed, 123)
  assert.equal(input.model, 'chosen-model')
})

test('buildHqRegenCreateVersionInput: uses empty sourceVersionIds when no usable parent', () => {
  const approved = {
    id: 'a1',
    assetId: 'asset1',
    module: 'twilight',
    recipe: { basePrompt: 'bp', injectors: [], guardrails: [], settings: {} },
    seed: null,
    parentVersionId: undefined
  }

  const input = buildHqRegenCreateVersionInput({
    approvedVersion: approved as any,
    parentVersion: null,
    model: 'chosen-model'
  })

  assert.deepEqual(input.sourceVersionIds, [])
  assert.equal(input.seed, null)
  assert.equal(input.parentVersionId, 'a1')
})
