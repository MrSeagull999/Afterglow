import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel, retryViewedVersionFromInspector, shouldShowInspectorRetry } from '../src/renderer/inspector/InspectorPanel'
import { useJobStore } from '../src/renderer/store/useJobStore'

test('Inspector Retry appears only when viewed version is failed (single-select)', () => {
  useJobStore.setState({
    currentJob: { id: 'j', name: 'Job', metadata: {}, sceneIds: [], createdAt: '', updatedAt: '' } as any,
    versionsByAssetId: {
      a1: [
        {
          id: 'v_failed',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'error',
          generationStatus: 'failed',
          generationError: 'Boom',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v_failed' }
  })

  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: ['v_failed'], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('GENERATION ERROR'))

  assert.equal(
    shouldShowInspectorRetry({
      selectionCount: 1,
      currentJobId: 'j',
      viewedVersion: { generationStatus: 'failed' }
    }),
    true
  )

  assert.equal(
    shouldShowInspectorRetry({
      selectionCount: 2,
      currentJobId: 'j',
      viewedVersion: { generationStatus: 'failed' }
    }),
    false
  )

  assert.equal(
    shouldShowInspectorRetry({
      selectionCount: 1,
      currentJobId: 'j',
      viewedVersion: { generationStatus: 'completed' }
    }),
    false
  )
})

test('Inspector retry helper switches viewer to newly created pending version (non-destructive)', async () => {
  const viewedByAsset: Record<string, string | null> = {}
  const lastAppliedByAsset: Record<string, string | null> = {}

  const newId = await retryViewedVersionFromInspector({
    jobId: 'j',
    assetId: 'a1',
    versionId: 'v_failed',
    invoke: async () => ({ id: 'v_new' }),
    setViewedVersionId: (assetId, versionId) => {
      viewedByAsset[assetId] = versionId
    },
    setLastAppliedVersionId: (assetId, versionId) => {
      lastAppliedByAsset[assetId] = versionId
    }
  })

  assert.equal(newId, 'v_new')
  assert.equal(viewedByAsset['a1'], 'v_new')
  assert.equal(lastAppliedByAsset['a1'], 'v_new')
})
