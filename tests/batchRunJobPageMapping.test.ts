import test from 'node:test'
import assert from 'node:assert/strict'

import { getBatchRunMappingFromResults } from '../src/renderer/pages/JobPage'

test('JobPage results->mapping helper uses returned versionIds per asset (and records failures)', () => {
  const results = [
    { assetId: 'a1', versionId: 'v1' },
    { assetId: 'a2', error: 'Provider error' },
    { assetId: 'a3', versionId: 'v3' }
  ]

  const { createdVersionIdsByAssetId, failedAssetIds } = getBatchRunMappingFromResults(results)

  assert.deepEqual(createdVersionIdsByAssetId, { a1: 'v1', a3: 'v3' })
  assert.deepEqual(failedAssetIds, ['a2'])
})
