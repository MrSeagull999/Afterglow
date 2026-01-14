import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'

import { BatchRunSummarySection } from '../src/renderer/inspector/BatchRunSummarySection'

test('BatchRunSummarySection Pending section: collapsed by default; clicking header expands and collapses', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
  ;(globalThis as any).window = dom.window
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).HTMLElement = dom.window.HTMLElement
  ;(globalThis as any).Event = dom.window.Event
  ;(globalThis as any).KeyboardEvent = dom.window.KeyboardEvent

  const activeBatchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now() - 1000,
    assetIds: ['a1', 'a2', 'a3', 'a4'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2', a3: 'v3', a4: 'v4' },
    failedAssetIds: [],
    dismissed: false
  } as any

  const versionsByAssetId = {
    a1: [{ id: 'v1', generationStatus: 'completed' }],
    a2: [{ id: 'v2', generationStatus: 'pending' }],
    a3: [{ id: 'v3', generationStatus: 'pending' }],
    a4: [{ id: 'v4', generationStatus: 'completed' }]
  } as any

  const baseProps = {
    assets: [
      { id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
      { id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any,
      { id: 'a3', jobId: 'j', name: 'Three', originalPath: '/z', versionIds: [], createdAt: '', updatedAt: '' } as any,
      { id: 'a4', jobId: 'j', name: 'Four', originalPath: '/w', versionIds: [], createdAt: '', updatedAt: '' } as any
    ],
    selectionCount: 4,
    selectedAssetIds: ['a1', 'a2', 'a3', 'a4'],
    activeBatchRun,
    versionsByAssetId,
    onDismiss: () => undefined,
    onJumpToAsset: () => undefined,
    onNextFailed: () => undefined,
    onNextPending: () => undefined,
    onNextCompleted: () => undefined
  }

  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  await act(async () => {
    root.render(<BatchRunSummarySection {...baseProps} />)
  })

  const toggle = dom.window.document.querySelector('[data-testid="batch-run-pending-toggle"]') as any
  assert.ok(toggle)
  assert.ok(toggle.textContent.includes('Pending (2)'))
  assert.ok(toggle.textContent.includes('▸'))

  // collapsed means no pending rows rendered
  assert.equal(!!dom.window.document.querySelector('[data-testid="batch-run-jump-a2"]'), false)
  assert.equal(!!dom.window.document.querySelector('[data-testid="batch-run-jump-a3"]'), false)

  await act(async () => {
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  assert.ok((toggle as any).textContent.includes('▾'))
  assert.ok(dom.window.document.querySelector('[data-testid="batch-run-jump-a2"]'))
  assert.ok(dom.window.document.querySelector('[data-testid="batch-run-jump-a3"]'))

  const ordinals = Array.from(dom.window.document.querySelectorAll('[data-testid="batch-run-ordinal"]')).map((n: any) => n.textContent)
  assert.ok(ordinals.includes('#2'))
  assert.ok(ordinals.includes('#3'))

  await act(async () => {
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  assert.ok((toggle as any).textContent.includes('▸'))
  assert.equal(!!dom.window.document.querySelector('[data-testid="batch-run-jump-a2"]'), false)
  assert.equal(!!dom.window.document.querySelector('[data-testid="batch-run-jump-a3"]'), false)
})
