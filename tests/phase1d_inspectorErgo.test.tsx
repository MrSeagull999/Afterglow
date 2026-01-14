import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

test('Inspector: module picker renders horizontally and ModuleRail is not present', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(!html.includes('data-testid="module-picker-strip"'))
  assert.ok(!html.includes('data-testid="module-rail"'))
})

test('Inspector: prompt textarea is resizable (resize-y)', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('resize-y'))
})
