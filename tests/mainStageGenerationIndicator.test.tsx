import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'
import { useJobStore } from '../src/renderer/store/useJobStore'

test('Pending state renders spinner in MainStage header', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
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
    viewedVersionIdByAssetId: { a1: 'v1' }
  })

  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: ['v1'], createdAt: '', updatedAt: '' } as any]}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-generation-indicator"'))
  assert.ok(html.includes('Generating'))
})

test('Legacy-only generating status still renders spinner in MainStage header', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v_legacy',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'generating',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v_legacy' }
  })

  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: ['v_legacy'], createdAt: '', updatedAt: '' } as any]}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-generation-indicator"'))
  assert.ok(html.includes('Generating'))
})

test('Failed state renders non-alarming failure indicator in MainStage header', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v2',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'error',
          generationStatus: 'failed',
          generationError: 'Provider down',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v2' }
  })

  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: ['v2'], createdAt: '', updatedAt: '' } as any]}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-generation-indicator"'))
  assert.ok(html.includes('Generation failed'))
  assert.ok(!html.includes('Provider down'))
})
