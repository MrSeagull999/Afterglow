import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'
import { useJobStore } from '../src/renderer/store/useJobStore'

test('Approve button visible for draft viewed version', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'preview_ready',
          lifecycleStatus: 'draft',
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

  assert.ok(html.includes('data-testid="mainstage-approve-button"'))
  assert.ok(!html.includes('data-testid="mainstage-approved-badge"'))
})

test('Approved badge visible when viewed version is approved (and Approve button hidden)', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'approved',
          lifecycleStatus: 'approved',
          approvedAt: 123,
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

  assert.ok(html.includes('data-testid="mainstage-approved-badge"'))
  assert.ok(!html.includes('data-testid="mainstage-approve-button"'))
})

test('Delete disabled/blocked when approved version viewed', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
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

  assert.ok(html.includes('data-testid="mainstage-delete-button"'))
  assert.ok(html.includes('disabled'))
})
