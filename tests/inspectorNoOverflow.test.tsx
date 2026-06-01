import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

test('Inspector Provider Truth rows use overflow-safe layout tokens', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onSelectModule={() => undefined}
      onOpenLibrary={() => undefined}
      onOpenSettings={() => undefined}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('data-testid="provider-row"'))
  assert.ok(html.includes('min-w-0'))
})

test('Inspector prompt textarea is resizable and readable by default (>=~220px token)', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onSelectModule={() => undefined}
      onOpenLibrary={() => undefined}
      onOpenSettings={() => undefined}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('resize-y'))
  // h-64 (~256px) default prompt height token
  assert.ok(html.includes('h-64'))
})
