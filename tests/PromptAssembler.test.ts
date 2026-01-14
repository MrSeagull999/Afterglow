import test from 'node:test'
import assert from 'node:assert/strict'

import { assemblePrompt } from '../src/shared/services/prompt/promptAssembler'

test('assemblePrompt: deterministic fullPrompt + promptHash for same inputs', async () => {
  const input = {
    moduleType: 'clean' as const,
    basePrompt: 'Base prompt.',
    options: ['Option A.', 'Option B.'],
    guardrails: ['Guardrail A.', 'Guardrail B.'],
    extraInstructions: 'Extra instructions.'
  }

  const a = await assemblePrompt(input)
  const b = await assemblePrompt(input)

  assert.equal(a.fullPrompt, b.fullPrompt)
  assert.equal(a.promptHash, b.promptHash)
  assert.deepEqual(a.sections, b.sections)
})

test('assemblePrompt: fixed section ordering and double-newline separators', async () => {
  const result = await assemblePrompt({
    moduleType: 'clean',
    basePrompt: 'BASE',
    options: ['OPT1', 'OPT2'],
    guardrails: ['GR1'],
    extraInstructions: 'EXTRA'
  })

  assert.deepEqual(
    result.sections.map((s) => s.id),
    ['base', 'options', 'guardrails', 'extra_instructions']
  )

  assert.equal(result.fullPrompt, 'BASE\n\nOPT1 OPT2\n\nGR1\n\nEXTRA')
})

test('assemblePrompt: normalizes CRLF and trims; omits empty sections', async () => {
  const result = await assemblePrompt({
    moduleType: 'clean',
    basePrompt: '  BASE\r\n',
    options: ['  ', 'OPT\r\n'],
    guardrails: [],
    extraInstructions: ''
  })

  assert.deepEqual(result.sections.map((s) => s.id), ['base', 'options'])
  assert.equal(result.fullPrompt, 'BASE\n\nOPT')
})

test('assemblePrompt: changing any content changes promptHash', async () => {
  const a = await assemblePrompt({
    moduleType: 'clean',
    basePrompt: 'BASE',
    options: ['OPT'],
    guardrails: ['GR'],
    extraInstructions: 'EXTRA'
  })

  const b = await assemblePrompt({
    moduleType: 'clean',
    basePrompt: 'BASE!',
    options: ['OPT'],
    guardrails: ['GR'],
    extraInstructions: 'EXTRA'
  })

  assert.notEqual(a.fullPrompt, b.fullPrompt)
  assert.notEqual(a.promptHash, b.promptHash)
})
