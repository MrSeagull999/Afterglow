import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MainStage } from '../src/renderer/components/mainstage/MainStage'
import { ModuleInspectorShell } from '../src/renderer/inspector/ModuleInspectorShell'

test('Selection flow: selecting 1 asset updates MainStage and Inspector reacts to same selection', () => {
  const selectedAssetIds = ['asset_1']

  const mainStageHtml = renderToStaticMarkup(
    <MainStage
      selectedAssetIds={selectedAssetIds}
      assets={[{ id: 'asset_1', jobId: 'job', name: 'Kitchen', originalPath: '/x', versionIds: [], createdAt: '', updatedAt: '' } as any]}
    />
  )

  const inspectorHtml = renderToStaticMarkup(
    <ModuleInspectorShell selection={{ selectedAssetIds, isBatch: false }} moduleType="clean" />
  )

  assert.ok(mainStageHtml.includes('Kitchen'))
  assert.ok(inspectorHtml.includes('Selection:'))
  assert.ok(inspectorHtml.includes('1'))
})

test('No-regression: prompt preview and provider metadata still render in Inspector', () => {
  const inspectorHtml = renderToStaticMarkup(
    <ModuleInspectorShell selection={{ selectedAssetIds: ['asset_1'], isBatch: false }} moduleType="clean" />
  )

  assert.ok(inspectorHtml.includes('Final Prompt (Live)'))
  assert.ok(inspectorHtml.includes('Effective Provider'))
  assert.ok(inspectorHtml.includes('Model'))
  assert.ok(inspectorHtml.includes('Endpoint'))
})
