import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'

import { useJobStore } from '../src/renderer/store/useJobStore'
import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
  ;(globalThis as any).window = dom.window
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).HTMLElement = dom.window.HTMLElement
  ;(globalThis as any).Event = dom.window.Event
  ;(globalThis as any).KeyboardEvent = dom.window.KeyboardEvent
  ;(globalThis as any).MouseEvent = dom.window.MouseEvent

  // Inspector truth hook expects these to exist in the renderer.
  ;(globalThis as any).window.api = {
    invoke: async () => null
  }

  return dom
}

test('Batch run keyboard shortcuts: ]/[\\ trigger next navigation when active batch run exists', async () => {
  const dom = setupDom()

  let failedCalls = 0
  let pendingCalls = 0
  let completedCalls = 0

  useJobStore.setState({
    activeBatchRun: {
      id: 'r',
      moduleId: 'clean',
      startedAt: Date.now() - 1000,
      assetIds: ['a1'],
      createdVersionIdsByAssetId: { a1: 'v1' },
      failedAssetIds: [],
      dismissed: false
    },
    jumpToNextFailedInBatchRun: () => {
      failedCalls += 1
    },
    jumpToNextPendingInBatchRun: () => {
      pendingCalls += 1
    },
    jumpToNextCompletedInBatchRun: () => {
      completedCalls += 1
    }
  } as any)

  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <InspectorPanel
        activeModule="clean"
        selectedAssetIds={['a1']}
        assets={[{ id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
        onApply={() => undefined}
      />
    )
  })

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ']' }))
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '[' }))
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '\\' }))
  })

  assert.equal(failedCalls, 1)
  assert.equal(pendingCalls, 1)
  assert.equal(completedCalls, 1)

  await act(async () => {
    root.unmount()
  })
})

test('Batch run keyboard shortcuts: do nothing when there is no active batch run', async () => {
  const dom = setupDom()

  let failedCalls = 0
  useJobStore.setState({
    activeBatchRun: undefined,
    jumpToNextFailedInBatchRun: () => {
      failedCalls += 1
    }
  } as any)

  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <InspectorPanel
        activeModule="clean"
        selectedAssetIds={['a1']}
        assets={[{ id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
        onApply={() => undefined}
      />
    )
  })

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ']' }))
  })

  assert.equal(failedCalls, 0)

  await act(async () => {
    root.unmount()
  })
})

test('Batch run keyboard shortcuts: ignored inside input/textarea/contentEditable', async () => {
  const dom = setupDom()

  let failedCalls = 0
  useJobStore.setState({
    activeBatchRun: {
      id: 'r',
      moduleId: 'clean',
      startedAt: Date.now() - 1000,
      assetIds: ['a1'],
      createdVersionIdsByAssetId: { a1: 'v1' },
      failedAssetIds: [],
      dismissed: false
    },
    jumpToNextFailedInBatchRun: () => {
      failedCalls += 1
    }
  } as any)

  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <InspectorPanel
        activeModule="clean"
        selectedAssetIds={['a1']}
        assets={[{ id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
        onApply={() => undefined}
      />
    )
  })

  const input = dom.window.document.createElement('input')
  dom.window.document.body.appendChild(input)
  input.focus()

  const textarea = dom.window.document.createElement('textarea')
  dom.window.document.body.appendChild(textarea)

  const editable = dom.window.document.createElement('div')
  editable.setAttribute('contenteditable', 'true')
  dom.window.document.body.appendChild(editable)

  await act(async () => {
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ']', bubbles: true }))
    textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ']', bubbles: true }))
    editable.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ']', bubbles: true }))
  })

  assert.equal(failedCalls, 0)

  await act(async () => {
    root.unmount()
  })
})
