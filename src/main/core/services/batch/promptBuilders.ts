/**
 * Prompt builders for agent batch generation.
 *
 * The provider labels images automatically:
 *   Image 1 = source photo (the one being edited)
 *   Image 2 = first reference image (the anchor)
 *
 * Prompts must reflect this ordering.
 */

export const ANCHOR_ROLE =
  'STYLE ANCHOR — apply the colour palette, sky hue, cloud treatment, ambient light temperature, ' +
  'and atmospheric mood of this image to the source photo. ' +
  'Do NOT copy buildings, trees, structures, or any architectural elements from this anchor into the source photo.'

/**
 * Wraps a per-image base prompt in a style-transfer frame.
 * Image 1 = source photo, Image 2 = anchor (as labelled by the provider).
 */
export function buildStyleTransferPrompt(basePrompt: string, referenceBrief?: string): string {
  const briefBlock = referenceBrief
    ? `STYLE TARGET — match these specific visual parameters:\n${referenceBrief}\n\n`
    : ''

  return (
    briefBlock +
    'Style-transfer edit: Image 2 is the approved STYLE ANCHOR for this batch. ' +
    'Apply the colour palette, sky hue, cloud formations, ambient light temperature, and atmospheric tone of Image 2 to Image 1. ' +
    'Preserve Image 1\'s architecture, composition, viewpoint, and all structural elements exactly — ' +
    'do not import geometry, buildings, or trees from Image 2 into Image 1. ' +
    'Natural variation in cloud positions and sky texture across images in this batch is expected and desirable.\n\n' +
    basePrompt
  )
}

/**
 * Prepends corrective instructions derived from evaluation issues.
 * Used on retry attempts when referenceMatch is below threshold.
 */
export function buildCorrectivePrompt(previousPrompt: string, issues: string[]): string {
  if (!issues.length) return previousPrompt

  const corrections = issues.map(i => `• ${i}`).join('\n')

  return (
    'PREVIOUS ATTEMPT DID NOT MATCH THE STYLE ANCHOR. CORRECT THESE SPECIFIC ISSUES:\n' +
    corrections + '\n\n' +
    'Re-generate fixing all of the above while still applying the anchor\'s colour palette and atmosphere. ' +
    'Do not reintroduce any of these problems.\n\n' +
    previousPrompt
  )
}
