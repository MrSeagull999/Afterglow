import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ToolDock } from '../src/renderer/components/toolDock/ToolDock'
import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'

test('ToolDock renders outside Inspector and Inspector does not contain tool chips', () => {
  const dockHtml = renderToStaticMarkup(
    <ToolDock activeModule="clean" onSelectModule={() => undefined} />
  )
  assert.ok(dockHtml.includes('data-testid="tool-dock"'))
  assert.ok(dockHtml.includes('TOOLS'))
  assert.ok(dockHtml.includes('Twilight'))

  const inspectorHtml = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )
  assert.ok(!inspectorHtml.includes('data-testid="module-picker-strip"'))
  assert.ok(!inspectorHtml.includes('TOOLS'))
})
