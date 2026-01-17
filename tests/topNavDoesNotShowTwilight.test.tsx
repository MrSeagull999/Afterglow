import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { TopBar } from '../src/renderer/components/TopBar'

test('Top navigation does not render a Twilight button/tab', () => {
  const html = renderToStaticMarkup(<TopBar />)
  assert.ok(!html.includes('Twilight'))
})
