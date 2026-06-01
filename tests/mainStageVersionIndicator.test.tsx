import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  getNextViewedVersionIdForMainStage,
  getViewingLabelForMainStage,
  getActiveVersionIndexForMainStage,
  getDotStateForMainStage
} from '../src/renderer/components/mainstage/MainStage'
import { VersionDots } from '../src/renderer/components/mainstage/VersionDots'

test('MainStage viewing label: original and version indexing', () => {
  const ordered = [{ id: 'v1' }, { id: 'v2' }] as any

  assert.equal(
    getViewingLabelForMainStage({ orderedVersionsOldestFirst: ordered, viewedVersionId: null, viewedVersion: null }),
    'Viewing: Original'
  )

  assert.equal(
    getViewingLabelForMainStage({ orderedVersionsOldestFirst: ordered, viewedVersionId: 'v1', viewedVersion: ordered[0] }),
    'Viewing: Version 2 of 3'
  )

  assert.equal(
    getViewingLabelForMainStage({ orderedVersionsOldestFirst: ordered, viewedVersionId: 'v2', viewedVersion: ordered[1] }),
    'Viewing: Version 3 of 3'
  )
})

test('MainStage viewing label appends pending/failed state using resolver (including legacy)', () => {
  const pendingLegacy = { id: 'v1', status: 'generating' } as any
  const failedLegacy = { id: 'v2', status: 'error' } as any
  const ordered = [pendingLegacy, failedLegacy] as any

  assert.equal(
    getViewingLabelForMainStage({ orderedVersionsOldestFirst: ordered, viewedVersionId: 'v1', viewedVersion: pendingLegacy }),
    'Viewing: Version 2 of 3 (Generating…)'
  )

  assert.equal(
    getViewingLabelForMainStage({ orderedVersionsOldestFirst: ordered, viewedVersionId: 'v2', viewedVersion: failedLegacy }),
    'Viewing: Version 3 of 3 (Failed)'
  )
})

test('VersionDots renders correct count and aria-current, and active index changes with next/prev helper', () => {
  const gen1 = { id: 'v1', createdAt: '2020-01-01T00:00:00.000Z' } as any
  const gen2 = { id: 'v2', createdAt: '2020-01-02T00:00:00.000Z' } as any
  const orderedVersionsOldestFirst = [gen1, gen2]

  const step1Viewed = null
  const step1Index = getActiveVersionIndexForMainStage({ orderedVersionsOldestFirst, viewedVersionId: step1Viewed })
  assert.equal(step1Index, 0)

  const step2Viewed = getNextViewedVersionIdForMainStage({ orderedVersionsOldestFirst, viewedVersionId: step1Viewed, direction: 1 })
  const step2Index = getActiveVersionIndexForMainStage({ orderedVersionsOldestFirst, viewedVersionId: step2Viewed })
  assert.equal(step2Index, 1)

  const step3Viewed = getNextViewedVersionIdForMainStage({ orderedVersionsOldestFirst, viewedVersionId: step2Viewed, direction: 1 })
  const step3Index = getActiveVersionIndexForMainStage({ orderedVersionsOldestFirst, viewedVersionId: step3Viewed })
  assert.equal(step3Index, 2)

  const html = renderToStaticMarkup(
    <VersionDots
      count={3}
      activeIndex={step3Index}
      getAriaLabel={(i) => `View ${i}`}
      getState={(i) => getDotStateForMainStage({ index: i, orderedVersionsOldestFirst })}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-version-dots"'))
  assert.ok(html.includes('data-testid="mainstage-version-dot-0"'))
  assert.ok(html.includes('data-testid="mainstage-version-dot-1"'))
  assert.ok(html.includes('data-testid="mainstage-version-dot-2"'))
  assert.ok(html.includes('aria-current="true"'))
})
