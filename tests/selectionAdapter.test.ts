import test from 'node:test'
import assert from 'node:assert/strict'

import { makeInspectorSelection } from '../src/renderer/inspector/selectionAdapter'

test('makeInspectorSelection: 1 selected -> isBatch=false', () => {
  const selection = makeInspectorSelection(['asset_1'])
  assert.deepEqual(selection.selectedAssetIds, ['asset_1'])
  assert.equal(selection.isBatch, false)
})

test('makeInspectorSelection: N selected -> isBatch=true', () => {
  const selection = makeInspectorSelection(['asset_1', 'asset_2', 'asset_3'])
  assert.deepEqual(selection.selectedAssetIds, ['asset_1', 'asset_2', 'asset_3'])
  assert.equal(selection.isBatch, true)
})
