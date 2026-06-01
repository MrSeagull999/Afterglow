import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { VersionDots } from '../src/renderer/components/mainstage/VersionDots'

test('Approved dot renders marker', () => {
  const html = renderToStaticMarkup(
    <VersionDots
      count={4}
      activeIndex={2}
      getAriaLabel={(i) => `Dot ${i}`}
      getState={() => 'completed'}
      isApproved={(i) => i === 2}
    />
  )

  assert.ok(html.includes('data-testid="mainstage-version-dot-approved-2"'))
})

test('Marker moves when approval changes', () => {
  const html1 = renderToStaticMarkup(
    <VersionDots
      count={4}
      activeIndex={2}
      getAriaLabel={(i) => `Dot ${i}`}
      getState={() => 'completed'}
      isApproved={(i) => i === 1}
    />
  )

  const html2 = renderToStaticMarkup(
    <VersionDots
      count={4}
      activeIndex={2}
      getAriaLabel={(i) => `Dot ${i}`}
      getState={() => 'completed'}
      isApproved={(i) => i === 3}
    />
  )

  assert.ok(html1.includes('data-testid="mainstage-version-dot-approved-1"'))
  assert.ok(!html1.includes('data-testid="mainstage-version-dot-approved-3"'))

  assert.ok(html2.includes('data-testid="mainstage-version-dot-approved-3"'))
  assert.ok(!html2.includes('data-testid="mainstage-version-dot-approved-1"'))
})
