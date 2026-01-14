import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { InspectorPanel } from '../src/renderer/inspector/InspectorPanel'
import { BatchRunSummarySection } from '../src/renderer/inspector/BatchRunSummarySection'

test('InspectorPanel renders sections in required order', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  const order = [
    'data-testid="section-selection"',
    // Batch run section is conditional and not present unless a batch run exists
    'data-testid="section-provider"',
    'data-testid="section-prompt"',
    'data-testid="section-extra"',
    'data-testid="section-module"',
    'data-testid="section-primary-action"'
  ]

  const indexes = order.map((token) => html.indexOf(token))
  indexes.forEach((idx, i) => assert.ok(idx >= 0, `missing section token: ${order[i]}`))

  for (let i = 1; i < indexes.length; i++) {
    assert.ok(indexes[i] > indexes[i - 1], `sections out of order: ${order[i - 1]} -> ${order[i]}`)
  }
})

test('InspectorPanel Batch Run: failed rows render static chip + ordinal + Jump button', () => {
  const activeBatchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now() - 1000,
    assetIds: ['a1', 'a2', 'a3'],
    createdVersionIdsByAssetId: { a1: 'v1', a3: 'v3' },
    failedAssetIds: ['a2'],
    dismissed: false
  } as any

  const html = renderToStaticMarkup(
    <BatchRunSummarySection
      assets={[
        { id: 'a1', jobId: 'j', name: 'One', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any,
        { id: 'a2', jobId: 'j', name: 'Two', originalPath: '/y', versionIds: [], createdAt: '', updatedAt: '' } as any,
        { id: 'a3', jobId: 'j', name: 'Three', originalPath: '/z', versionIds: [], createdAt: '', updatedAt: '' } as any
      ]}
      selectionCount={3}
      selectedAssetIds={['a1', 'a2', 'a3']}
      activeBatchRun={activeBatchRun}
      versionsByAssetId={{}}
      onDismiss={() => undefined}
      onJumpToAsset={() => undefined}
      onNextFailed={() => undefined}
      onNextPending={() => undefined}
      onNextCompleted={() => undefined}
    />
  )

  assert.ok(html.includes('data-testid="section-batch-run"'), html.slice(0, 600))
  assert.ok(html.includes('Failures'), html.slice(0, 600))

  // static thumbnail-lite affordances
  assert.ok(html.includes('data-testid="batch-run-chip"'), html.slice(0, 600))
  assert.ok(html.includes('data-testid="batch-run-ordinal"'), html.slice(0, 600))
  assert.ok(html.includes('#2'), html.slice(0, 600))

  // jump still present
  assert.ok(html.includes('data-testid="batch-run-jump-a2"'), html.slice(0, 600))
})

test('InspectorPanel no-regression: provider truth rows exist', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('PROVIDER TRUTH'))
  assert.ok(html.includes('Provider'))
  assert.ok(html.includes('Model'))
  assert.ok(html.includes('Endpoint'))
})

test('InspectorPanel no-regression: prompt preview + hash exist', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="clean"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  assert.ok(html.includes('PROMPT TRUTH'))
  assert.ok(html.includes('Final Prompt (Live)'))
  assert.ok(html.includes('promptHash'))
})

test('InspectorPanel: module controls render under MODULE SETTINGS (Twilight preset label exists)', () => {
  const html = renderToStaticMarkup(
    <InspectorPanel
      activeModule="twilight"
      selectedAssetIds={['a1']}
      assets={[{ id: 'a1', jobId: 'j', name: 'Front', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
      onApply={() => undefined}
    />
  )

  const moduleHeaderIdx = html.indexOf('MODULE SETTINGS')
  const presetLabelIdx = html.indexOf('Preset')

  assert.ok(moduleHeaderIdx >= 0)
  assert.ok(presetLabelIdx > moduleHeaderIdx)
})
