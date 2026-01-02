export type LightingCondition = 'overcast' | 'sunny'

export const LIGHTING_MODIFIERS = {
  sunny: `
IMPORTANT LIGHTING CORRECTION STEP:
Before applying twilight or evening lighting, remove all visual evidence of direct sunlight.
- Neutralize harsh midday shadows caused by overhead sun.
- Reduce strong highlight contrast on roofs, paving, foliage, and walls.
- Soften specular highlights and sunlit hotspots.
- Ensure lighting appears evenly diffused, as if the sun has already dropped below the horizon.

All shadows must be recalculated to match dusk conditions:
- No hard or directional midday shadows.
- Shadows should be soft, low-contrast, and consistent with ambient twilight.
`,
  overcast: ''
}

export function assembleTwilightPrompt(
  basePrompt: string,
  lightingCondition: LightingCondition,
  customPrompt?: string
): string {
  const parts: string[] = []
  
  // 1. Lighting modifier (if sunny)
  const modifier = LIGHTING_MODIFIERS[lightingCondition]
  if (modifier) {
    parts.push(modifier.trim())
  }
  
  // 2. Base preset prompt
  parts.push(basePrompt)
  
  // 3. Custom prompt (if provided)
  if (customPrompt && customPrompt.trim()) {
    parts.push(`\nAdditional instructions: ${customPrompt.trim()}`)
  }
  
  return parts.join('\n\n')
}
