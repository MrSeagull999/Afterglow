import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveGenerationStatus } from '../src/shared/resolveGenerationStatus'

test('resolveGenerationStatus prefers generationStatus when present', () => {
  const v = { generationStatus: 'pending', status: 'preview_ready' } as any
  assert.equal(resolveGenerationStatus(v), 'pending')
})

test('resolveGenerationStatus maps legacy generating statuses to pending', () => {
  assert.equal(resolveGenerationStatus({ status: 'generating' } as any), 'pending')
  assert.equal(resolveGenerationStatus({ status: 'hq_generating' } as any), 'pending')
  assert.equal(resolveGenerationStatus({ status: 'final_generating' } as any), 'pending')
})

test('resolveGenerationStatus maps legacy error to failed', () => {
  assert.equal(resolveGenerationStatus({ status: 'error' } as any), 'failed')
})

test('resolveGenerationStatus maps legacy ready/approved statuses to completed', () => {
  assert.equal(resolveGenerationStatus({ status: 'preview_ready' } as any), 'completed')
  assert.equal(resolveGenerationStatus({ status: 'hq_ready' } as any), 'completed')
  assert.equal(resolveGenerationStatus({ status: 'final_ready' } as any), 'completed')
  assert.equal(resolveGenerationStatus({ status: 'approved' } as any), 'completed')
})

test('resolveGenerationStatus returns idle for null/undefined/version without known legacy status', () => {
  assert.equal(resolveGenerationStatus(null), 'idle')
  assert.equal(resolveGenerationStatus(undefined), 'idle')
  assert.equal(resolveGenerationStatus({} as any), 'idle')
})
