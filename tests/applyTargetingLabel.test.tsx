import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

test('Apply targeting label: single-select uses Version label when provided', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      applyTargetLabel="Applying to: Version ver_123"
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('data-testid="apply-target-label"'))
  assert.ok(html.includes('Applying to: Version ver_123'))
})

test('Apply targeting label: multi-select uses latest-per-asset label', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1', 'a2']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      applyTargetLabel="Applying to: Latest version of each selected asset"
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('Applying to: Latest version of each selected asset'))
})
