import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'
import { useJobStore } from '../src/renderer/store/useJobStore'

// Approval was removed from the UI; legacy approved versions must not show
// approval chrome or be locked from deletion.
test('Legacy approved version shows no approval UI and can be deleted', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'freeform',
          qualityTier: 'native_4k',
          status: 'approved',
          lifecycleStatus: 'approved',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v1' }
  })

  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: ['v1'], createdAt: '', updatedAt: '' } as any]}
    />
  )

  assert.ok(!html.includes('data-testid="mainstage-approve-button"'))
  assert.ok(!html.includes('data-testid="mainstage-approved-badge"'))
  const deleteButton = html.match(/<button[^>]*data-testid="mainstage-delete-button"[^>]*>/)?.[0] || ''
  assert.ok(deleteButton)
  assert.ok(!/\sdisabled=/.test(deleteButton))
})
