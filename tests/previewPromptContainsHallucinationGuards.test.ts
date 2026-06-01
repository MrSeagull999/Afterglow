import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTwilightPreviewBasePrompt } from '../src/shared/services/prompt/prompts'

test('Preview twilight prompt contains hallucination guardrails (window light-plane, no invented interior/exterior, if unsure do nothing)', async () => {
  const preset = 'Transform this real estate exterior photograph into a professional twilight/blue-hour scene.'
  const preview = buildTwilightPreviewBasePrompt(preset)

  assert.match(preview, /Treat windows as light-emitting planes, not viewports/i)
  assert.match(preview, /Do NOT show interior objects, furniture, silhouettes/i)
  assert.match(preview, /Do NOT invent exterior\/garden\/landscape lighting/i)
  assert.match(preview, /Only show exterior lighting if a physical lighting fixture is clearly visible/i)
  assert.match(preview, /If unsure, do nothing/i)
})
