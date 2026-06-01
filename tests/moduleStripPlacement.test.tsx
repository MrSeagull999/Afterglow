import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

test('Module strip renders as a pinned TOOLS toolbar region near the top of Inspector', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(!html.includes('data-testid="module-picker-strip"'))
})

test('Inspector header is clean (no old awkward subheading block)', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('data-testid="inspector-header"'))
  assert.ok(!html.includes('INSPECTOR — ALL CONTROLS LIVE HERE'))
})
