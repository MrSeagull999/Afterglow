import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage, nextMainStageBatchView } from '../src/renderer/components/mainstage/MainStage'

test('MainStage multi-select renders contact sheet when N>1', () => {
  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1', 'a2']}
      assets={[
        { id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
        { id: 'a2', jobId: 'j', name: 'B', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any
      ]}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-contact-sheet"'))
  assert.ok(html.includes('2 selected'))
})

test('MainStage keybinding: N toggles between contact sheet and focused view', () => {
  assert.equal(nextMainStageBatchView('contact', 'n'), 'focused')
  assert.equal(nextMainStageBatchView('focused', 'N'), 'contact')
  assert.equal(nextMainStageBatchView('contact', 'x'), 'contact')
})
