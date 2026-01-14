import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ModuleGridTile } from '../src/renderer/components/modules/ModuleGridTile'

test('Library thumb-only tile shows thumbnail + selection affordance and no action buttons', () => {
  const html = renderToStaticMarkup(
    <ModuleGridTile
      asset={{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any}
      versions={[] as any}
      activeModule={null}
      isSelected={true}
      isExpanded={false}
      viewMode="grid"
      versionProgress={{}}
      onToggleSelect={() => undefined}
      onToggleExpand={() => undefined}
      libraryThumbOnly
    />
  )

  assert.ok(html.includes('data-testid="library-thumb"'))
  assert.ok(!html.includes('Approve'))
  assert.ok(!html.includes('Retry'))
  assert.ok(!html.includes('versions'))
})
