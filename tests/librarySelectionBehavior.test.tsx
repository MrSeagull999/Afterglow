import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'

import { ModuleGridTile } from '../src/renderer/components/modules/ModuleGridTile'

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
  ;(globalThis as any).window = dom.window
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).HTMLElement = dom.window.HTMLElement
  ;(globalThis as any).Event = dom.window.Event
  ;(globalThis as any).KeyboardEvent = dom.window.KeyboardEvent
  ;(globalThis as any).MouseEvent = dom.window.MouseEvent
  return dom
}

test('Library: single click on tile body replaces selection with that asset only', async () => {
  const dom = setupDom()
  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  let selected = new Set<string>(['a1', 'a2'])

  await act(async () => {
    root.render(
      <ModuleGridTile
        asset={{ id: 'a3', jobId: 'j', name: 'Three', originalPath: '/z', versionIds: [], createdAt: '', updatedAt: '' } as any}
        versions={[] as any}
        activeModule={null}
        isSelected={false}
        isExpanded={false}
        viewMode="grid"
        versionProgress={{}}
        onToggleSelect={() => {
          if (selected.has('a3')) selected.delete('a3')
          else selected.add('a3')
        }}
        onReplaceSelect={() => {
          selected = new Set(['a3'])
        }}
        onAddToSelect={() => {
          selected.add('a3')
        }}
        onToggleExpand={() => undefined}
        libraryThumbOnly
      />
    )
  })

  const tile = dom.window.document.querySelector('[data-testid="library-thumb"]') as any
  assert.ok(tile)

  await act(async () => {
    tile.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  assert.deepEqual(Array.from(selected), ['a3'])
})

test('Library: Shift-click adds asset to selection (group)', async () => {
  const dom = setupDom()
  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  const selected = new Set<string>(['a1'])

  await act(async () => {
    root.render(
      <ModuleGridTile
        asset={{ id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any}
        versions={[] as any}
        activeModule={null}
        isSelected={false}
        isExpanded={false}
        viewMode="grid"
        versionProgress={{}}
        onToggleSelect={() => {
          if (selected.has('a2')) selected.delete('a2')
          else selected.add('a2')
        }}
        onReplaceSelect={() => {
          selected.clear()
          selected.add('a2')
        }}
        onAddToSelect={() => {
          selected.add('a2')
        }}
        onToggleExpand={() => undefined}
        libraryThumbOnly
      />
    )
  })

  const tile = dom.window.document.querySelector('[data-testid="library-thumb"]') as any
  assert.ok(tile)

  await act(async () => {
    tile.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }))
  })

  assert.ok(selected.has('a1'))
  assert.ok(selected.has('a2'))
  assert.equal(selected.size, 2)
})

test('Library: Shift-click on already-selected asset removes it from selection', async () => {
  const dom = setupDom()
  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  const selected = new Set<string>(['a1', 'a2'])

  await act(async () => {
    root.render(
      <ModuleGridTile
        asset={{ id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any}
        versions={[] as any}
        activeModule={null}
        isSelected={true}
        isExpanded={false}
        viewMode="grid"
        versionProgress={{}}
        onToggleSelect={() => {
          if (selected.has('a2')) selected.delete('a2')
          else selected.add('a2')
        }}
        onReplaceSelect={() => {
          selected.clear()
          selected.add('a2')
        }}
        onAddToSelect={() => {
          selected.add('a2')
        }}
        onToggleExpand={() => undefined}
        libraryThumbOnly
      />
    )
  })

  const tile = dom.window.document.querySelector('[data-testid="library-thumb"]') as any
  assert.ok(tile)

  await act(async () => {
    tile.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }))
  })

  assert.ok(selected.has('a1'))
  assert.ok(!selected.has('a2'))
  assert.equal(selected.size, 1)
})

test('Library: clicking checkbox toggles membership and does not single-select', async () => {
  const dom = setupDom()
  const container = dom.window.document.getElementById('root') as any
  const root = createRoot(container)

  let replaceCalled = 0
  let toggleCalled = 0

  await act(async () => {
    root.render(
      <ModuleGridTile
        asset={{ id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any}
        versions={[] as any}
        activeModule={null}
        isSelected={false}
        isExpanded={false}
        viewMode="grid"
        versionProgress={{}}
        onToggleSelect={() => {
          toggleCalled += 1
        }}
        onReplaceSelect={() => {
          replaceCalled += 1
        }}
        onAddToSelect={() => undefined}
        onToggleExpand={() => undefined}
        libraryThumbOnly
      />
    )
  })

  const checkbox = dom.window.document.querySelector('button[aria-label]') as any
  assert.ok(checkbox)

  await act(async () => {
    checkbox.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  assert.equal(toggleCalled, 1)
  assert.equal(replaceCalled, 0)
})
