import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTwilightPreviewBasePrompt } from '../src/shared/services/prompt/prompts'

test('Preview twilight prompt biases warm interior glow toward neutral warm-white (not saturated orange)', async () => {
  const preset = 'Create a premium twilight real estate photograph from this exterior image.'
  const preview = buildTwilightPreviewBasePrompt(preset)

  assert.match(preview, /neutral warm-white/i)
  assert.match(preview, /not saturated orange/i)
})
