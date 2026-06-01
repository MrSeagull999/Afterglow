import test from 'node:test'
import assert from 'node:assert/strict'

import { useJobStore } from '../src/renderer/store/useJobStore'

test('clicking Jump sets single selection to assetId and viewedVersionId to createdVersionId (non-destructive)', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          generationStatus: 'failed',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ],
      a2: [
        {
          id: 'v2',
          assetId: 'a2',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          generationStatus: 'pending',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v1', a2: 'v_old' },
    selectedAssetIds: new Set(['a1', 'a2']),
    activeBatchRun: {
      id: 'r1',
      moduleId: 'clean',
      startedAt: Date.now() - 1000,
      assetIds: ['a1', 'a2'],
      createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2' },
      dismissed: false
    }
  } as any)

  const beforeVersionsByAssetId = useJobStore.getState().versionsByAssetId

  useJobStore.getState().jumpToBatchAsset('a2')

  const state = useJobStore.getState()
  assert.deepEqual(Array.from(state.selectedAssetIds), ['a2'])
  assert.equal(state.viewedVersionIdByAssetId['a2'], 'v2')

  // no version stack mutation
  assert.strictEqual(state.versionsByAssetId, beforeVersionsByAssetId)
  assert.equal(state.versionsByAssetId['a2'][0].id, 'v2')
})
