import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LibraryHeader } from '../src/renderer/components/library/LibraryHeader'

test('Left panel: library header uses wrapping (not truncation)', () => {
  const html = renderToStaticMarkup(<LibraryHeader />)
  assert.ok(html.includes('data-testid="library-header"'))
  assert.ok(html.includes('whitespace-normal'))
})
