import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ModuleInspectorShell } from '../src/renderer/inspector/ModuleInspectorShell'

test('ModuleInspectorShell renders required text and selection count (single)', () => {
  const prev = process.env.IMAGE_PROVIDER
  delete process.env.IMAGE_PROVIDER

  const html = renderToStaticMarkup(
    <ModuleInspectorShell selection={{ selectedAssetIds: ['a1'], isBatch: false }} moduleType="clean" />
  )

  assert.ok(html.includes('Inspector'))
  assert.ok(html.includes('PHASE 2 — PROMPT TRUTH SURFACE ACTIVE'))
  assert.ok(html.includes('1 item selected'))
  assert.ok(html.includes('Apply to Selected (1)'))
  assert.ok(html.includes('Extra Instructions'))
  assert.ok(html.includes('Final Prompt (Live)'))
  assert.ok(html.includes('Effective Provider'))
  assert.ok(html.includes('Model'))
  assert.ok(html.includes('Endpoint'))

  if (prev !== undefined) process.env.IMAGE_PROVIDER = prev
})

test('ModuleInspectorShell renders batch subtext (N selected)', () => {
  const html = renderToStaticMarkup(
    <ModuleInspectorShell selection={{ selectedAssetIds: ['a1', 'a2'], isBatch: true }} moduleType="clean" />
  )

  assert.ok(html.includes('Batch mode: 2 selected'))
  assert.ok(html.includes('Apply to Selected (2)'))
})

test('ModuleInspectorShell shows env override warning when IMAGE_PROVIDER is set', () => {
  const prev = process.env.IMAGE_PROVIDER
  process.env.IMAGE_PROVIDER = 'openrouter'

  const html = renderToStaticMarkup(
    <ModuleInspectorShell selection={{ selectedAssetIds: ['a1'], isBatch: false }} moduleType="clean" />
  )

  assert.ok(html.includes('Overridden by env: IMAGE_PROVIDER=openrouter'))

  if (prev === undefined) delete process.env.IMAGE_PROVIDER
  else process.env.IMAGE_PROVIDER = prev
})
