import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ThreeColumnLayout } from '../src/renderer/components/layout/ThreeColumnLayout'
import { LibraryHeader } from '../src/renderer/components/library/LibraryHeader'
import { ModuleGridTile } from '../src/renderer/components/modules/ModuleGridTile'

test('Library column uses clamp sizing tokens and header does not clip vertically', () => {
  const html = renderToStaticMarkup(
    <ThreeColumnLayout left={<LibraryHeader />} center={<div />} right={<div />} />
  )

  // clamp token for width
  assert.ok(html.includes('w-[clamp(280px,22vw,420px)]'))

  // header should not be hard-clipped by a fixed h-* + overflow-hidden combo
  const headerHtml = renderToStaticMarkup(<LibraryHeader />)
  assert.ok(headerHtml.includes('min-h-12'))
  assert.ok(!headerHtml.includes('overflow-hidden'))
})

test('Library thumbnails-only tiles render without per-asset action buttons', () => {
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
  // no action labels/buttons should appear in library thumb-only tile
  assert.ok(!html.includes('Approve'))
  assert.ok(!html.includes('versions'))
})
