export function buildRelightPreviewBasePrompt(presetPromptTemplate: string): string {
  const guard = `This is a lighting enhancement of the provided photograph. Preserve the exact scene composition, architecture, and all physical elements while improving only the lighting conditions.

Maintain all architectural elements exactly as shown - walls, floors, ceilings, windows, doors, and built-in features. Do not alter any surface materials, paint colors, flooring, or existing finishes. Preserve the camera angle and perspective.

The lighting transformation should feel natural and realistic, as if the photograph was taken under better lighting conditions rather than artificially processed. When details in the original photograph are unclear or partially obscured, leave them as they are - do not invent or add new details in these areas.`

  const presetAlreadyContainsGuard = /preserve.*exact.*scene/i.test(presetPromptTemplate)

  const parts: string[] = []
  if (!presetAlreadyContainsGuard) parts.push(guard)
  parts.push(presetPromptTemplate)
  return parts.join('\n\n')
}
