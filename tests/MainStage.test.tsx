import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'

test('MainStage shows empty state when nothing selected', () => {
  const html = renderToStaticMarkup(<MainStage selectedAssetIds={[]} assets={[]} />)
  assert.ok(html.includes('MAINSTAGE — EDITING SURFACE'))
  assert.ok(html.includes('Select an image from the Library to begin'))
})

test('MainStage shows batch state when multiple selected', () => {
  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1', 'a2', 'a3']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
    />
  )
  assert.ok(html.includes('data-testid="mainstage-contact-sheet"'))
  assert.ok(html.includes('3 selected'))
})

test('MainStage shows selected asset label when exactly one selected', () => {
  const html = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Front', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
    />
  )

  assert.ok(html.includes('Selected:'))
  assert.ok(html.includes('Front'))
})
