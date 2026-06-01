import test from 'node:test'
import assert from 'node:assert/strict'

import { HQ_PREVIEW_REQUIRES_APPROVAL, HQ_PREVIEW_AUTO_APPROVES } from '../src/main/core/modules/shared/generateService'

test('HQ generation allowed from draft version (no approval requirement)', () => {
  assert.equal(HQ_PREVIEW_REQUIRES_APPROVAL, false)
})

test('HQ generation allowed from approved version (still allowed)', () => {
  assert.equal(HQ_PREVIEW_REQUIRES_APPROVAL, false)
})

test('HQ generation does not auto-approve', () => {
  assert.equal(HQ_PREVIEW_AUTO_APPROVES, false)
})
