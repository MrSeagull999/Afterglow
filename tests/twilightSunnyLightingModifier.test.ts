import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTwilightPreviewBasePrompt } from '../src/shared/services/prompt/prompts'

test('Twilight preview prompt includes sunny lighting correction when lightingCondition is sunny', async () => {
  const preset = 'Transform this real estate exterior photograph into a professional twilight/blue-hour scene.'

  const sunny = buildTwilightPreviewBasePrompt(preset, 'sunny')
  assert.match(sunny, /IMPORTANT LIGHTING CORRECTION STEP/i)
  assert.match(sunny, /remove all visual evidence of direct sunlight/i)
  assert.match(sunny, /No hard or directional midday shadows/i)
  assert.match(sunny, /truth-preserving twilight conversion/i)

  const overcast = buildTwilightPreviewBasePrompt(preset, 'overcast')
  assert.ok(!/IMPORTANT LIGHTING CORRECTION STEP/i.test(overcast))
  assert.match(overcast, /truth-preserving twilight conversion/i)
})
