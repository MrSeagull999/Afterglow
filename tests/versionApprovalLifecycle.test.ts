import test from 'node:test'
import assert from 'node:assert/strict'

import { getApprovalInvariantUpdates, isVersionDeletionLocked } from '../src/main/core/store/versionStore'

function v(partial: any) {
  return {
    id: partial.id,
    jobId: 'j',
    assetId: 'a',
    module: 'clean',
    qualityTier: 'preview',
    status: partial.status ?? 'preview_ready',
    recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
    sourceVersionIds: [],
    createdAt: new Date().toISOString(),
    ...partial
  }
}

test('Approving sets lifecycleStatus=approved and demotes previous approved to draft (single-approved invariant)', () => {
  const versions = [
    v({ id: 'v1', lifecycleStatus: 'approved', status: 'approved', approvedAt: 1 }),
    v({ id: 'v2', lifecycleStatus: 'draft', status: 'preview_ready' }),
    v({ id: 'v3', lifecycleStatus: 'draft', status: 'preview_ready' })
  ]

  const now = 123456
  const updates = getApprovalInvariantUpdates({
    versionsForAsset: versions as any,
    approveVersionId: 'v2',
    nowMs: now
  })

  const u1 = updates.find((u) => u.versionId === 'v1')
  const u2 = updates.find((u) => u.versionId === 'v2')

  assert.ok(u1)
  assert.equal(u1!.updates.lifecycleStatus, 'draft')
  assert.equal(u1!.updates.approvedAt, undefined)

  assert.ok(u2)
  assert.equal(u2!.updates.lifecycleStatus, 'approved')
  assert.equal(u2!.updates.approvedAt, now)
  assert.equal(u2!.updates.status, 'approved')

  const approvedCount = updates.filter((u) => u.updates.lifecycleStatus === 'approved').length
  assert.equal(approvedCount, 1)
})

test('Approved versions are locked from deletion (lifecycleStatus=approved)', () => {
  assert.equal(isVersionDeletionLocked({ lifecycleStatus: 'approved', status: 'preview_ready' } as any), true)
  assert.equal(isVersionDeletionLocked({ lifecycleStatus: 'draft', status: 'approved' } as any), true)
  assert.equal(isVersionDeletionLocked({ lifecycleStatus: 'draft', status: 'final_ready' } as any), true)
  assert.equal(isVersionDeletionLocked({ lifecycleStatus: 'draft', status: 'preview_ready' } as any), false)
})
