import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ModuleGridTile } from '../src/renderer/components/modules/ModuleGridTile'

test('Pending state renders overlay in Library thumbnail (thumb-only tile)', () => {
  const html = renderToStaticMarkup(
    <ModuleGridTile
      asset={{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: ['v1'], createdAt: '', updatedAt: '' } as any}
      versions={[
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'generating',
          generationStatus: 'pending',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]}
      activeModule={null}
      isSelected={false}
      isExpanded={false}
      viewMode="grid"
      versionProgress={{ v1: 42 }}
      onToggleSelect={() => undefined}
      onToggleExpand={() => undefined}
      libraryThumbOnly
    />
  )

  assert.ok(html.includes('data-testid="library-thumb"'))
  assert.ok(html.includes('data-testid="library-thumb-pending"'))
  assert.ok(!html.includes('%'))
})

test('Legacy-only generating status still renders pending overlay in Library thumbnail', () => {
  const html = renderToStaticMarkup(
    <ModuleGridTile
      asset={{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: ['v_legacy'], createdAt: '', updatedAt: '' } as any}
      versions={[
        {
          id: 'v_legacy',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'generating',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]}
      activeModule={null}
      isSelected={false}
      isExpanded={false}
      viewMode="grid"
      versionProgress={{ v_legacy: 42 }}
      onToggleSelect={() => undefined}
      onToggleExpand={() => undefined}
      libraryThumbOnly
    />
  )

  assert.ok(html.includes('data-testid="library-thumb"'))
  assert.ok(html.includes('data-testid="library-thumb-pending"'))
})

test('Failed state renders small warning indicator in Library thumbnail and does not inline error text', () => {
  const html = renderToStaticMarkup(
    <ModuleGridTile
      asset={{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: ['v2'], createdAt: '', updatedAt: '' } as any}
      versions={[
        {
          id: 'v2',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          status: 'error',
          generationStatus: 'failed',
          generationError: 'Bad prompt',
          error: 'Bad prompt',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]}
      activeModule={null}
      isSelected={false}
      isExpanded={false}
      viewMode="grid"
      versionProgress={{}}
      onToggleSelect={() => undefined}
      onToggleExpand={() => undefined}
      libraryThumbOnly
    />
  )

  assert.ok(html.includes('data-testid="library-thumb-failed"'))
  assert.ok(!html.includes('Bad prompt'))
})
