import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  MainStage,
  getNewestGeneratedVersionIdForMainStage,
  getNextViewedVersionIdForMainStage
} from '../src/renderer/components/mainstage/MainStage'

test('MainStage version controls appear only for single selection', () => {
  const multiHtml = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1', 'a2']}
      assets={[
        { id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
        { id: 'a2', jobId: 'j', name: 'B', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any
      ]}
    />
  )
  assert.ok(multiHtml.includes('data-testid="mainstage-contact-sheet"'))
  assert.ok(!multiHtml.includes('Show Original'))

  const singleHtml = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'A', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
    />
  )
  assert.ok(singleHtml.includes('Show Original'))
  assert.ok(singleHtml.includes('Show Current'))
  assert.ok(singleHtml.includes('Show Last Applied'))
  assert.ok(singleHtml.includes('Delete'))
})

test('MainStage version navigation is forward-in-time (oldest -> newest)', () => {
  const gen1 = { id: 'v1', createdAt: '2020-01-01T00:00:00.000Z' } as any
  const gen2 = { id: 'v2', createdAt: '2020-01-02T00:00:00.000Z' } as any
  const orderedVersionsOldestFirst = [gen1, gen2]

  assert.equal(
    getNextViewedVersionIdForMainStage({ orderedVersionsOldestFirst, viewedVersionId: null, direction: 1 }),
    'v1'
  )
  assert.equal(
    getNextViewedVersionIdForMainStage({ orderedVersionsOldestFirst, viewedVersionId: 'v1', direction: 1 }),
    'v2'
  )
  assert.equal(
    getNextViewedVersionIdForMainStage({ orderedVersionsOldestFirst, viewedVersionId: 'v2', direction: -1 }),
    'v1'
  )

  assert.equal(getNewestGeneratedVersionIdForMainStage(orderedVersionsOldestFirst), 'v2')
})
