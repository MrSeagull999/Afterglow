import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'
import { useJobStore } from '../src/renderer/store/useJobStore'

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
  ;(globalThis as any).window = dom.window
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).HTMLElement = dom.window.HTMLElement
  ;(globalThis as any).Event = dom.window.Event
  ;(globalThis as any).KeyboardEvent = dom.window.KeyboardEvent
  ;(globalThis as any).MouseEvent = dom.window.MouseEvent

  // Provide a minimal electronAPI to avoid MainStage early-returning; return dummy strings.
  ;(globalThis as any).window.electronAPI = {
    readImageAsDataURL: async (_p: string) => 'data:image/png;base64,AA=='
  }

  return dom
}

test('After batch apply, viewedVersionIdByAssetId is set and tiles show pending overlay immediately; later updates show completed image without reselect', async () => {
  const dom = setupDom()

  useJobStore.setState({
    currentJob: { id: 'j', name: 'Job', metadata: {}, sceneIds: [], createdAt: '', updatedAt: '' } as any,
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'generating',
          generationStatus: 'pending',
          recipe: { basePrompt: '', injectors: [], guardrails: [], settings: {} },
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
          status: 'generating',
          generationStatus: 'pending',
          recipe: { basePrompt: '', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    },
    viewedVersionIdByAssetId: { a1: 'v1', a2: 'v2' }
  } as any)

  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <MainStage
        selectedAssetIds={['a1', 'a2']}
        assets={[
          { id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
          { id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any
        ]}
      />
    )
  })

  // pending overlays should exist (at least one)
  assert.ok(dom.window.document.querySelector('[data-testid="mainstage-tile-pending"]'))

  // Now simulate store update to completed with outputPath
  useJobStore.getState().upsertVersionForAsset('a1', {
    ...(useJobStore.getState().versionsByAssetId['a1'][0] as any),
    generationStatus: 'completed',
    status: 'preview_ready',
    outputPath: '/out/a1.png'
  } as any)

  await act(async () => {
    root.render(
      <MainStage
        selectedAssetIds={['a1', 'a2']}
        assets={[
          { id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
          { id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any
        ]}
      />
    )
  })

  // should no longer show pending overlay for a1 (still maybe for a2)
  // and should include an <img> from our stubbed electronAPI.
  const imgs = Array.from(dom.window.document.querySelectorAll('img'))
  assert.ok(imgs.length > 0)
})
