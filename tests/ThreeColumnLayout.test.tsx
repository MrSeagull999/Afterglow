import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ThreeColumnLayout } from '../src/renderer/components/layout/ThreeColumnLayout'

test('ThreeColumnLayout renders Library (left), MainStage (center), Inspector (right) in order', () => {
  const html = renderToStaticMarkup(
    <ThreeColumnLayout
      left={<div>LEFT_LIBRARY</div>}
      center={<div>CENTER_MAINSTAGE</div>}
      right={<div>RIGHT_INSPECTOR</div>}
    />
  )

  assert.ok(html.includes('LEFT_LIBRARY'))
  assert.ok(html.includes('CENTER_MAINSTAGE'))
  assert.ok(html.includes('RIGHT_INSPECTOR'))

  const leftIndex = html.indexOf('LEFT_LIBRARY')
  const centerIndex = html.indexOf('CENTER_MAINSTAGE')
  const rightIndex = html.indexOf('RIGHT_INSPECTOR')

  assert.ok(leftIndex >= 0)
  assert.ok(centerIndex > leftIndex)
  assert.ok(rightIndex > centerIndex)

  assert.ok(html.includes('data-testid="library-panel"'))
  assert.ok(html.includes('data-testid="mainstage-panel"'))
  assert.ok(html.includes('data-testid="inspector-panel"'))
})
