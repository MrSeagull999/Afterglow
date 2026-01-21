export interface Guardrail {
  id: string
  label: string
  promptFragment: string
  appliesTo: ('clean' | 'stage' | 'renovate' | 'twilight')[]
}

export const ARCHITECTURAL_GUARDRAILS: Guardrail[] = [
  {
    id: 'preserve_walls',
    label: 'Preserve Walls',
    promptFragment: 'Preserve all walls exactly as shown - do not alter wall positions, angles, or structural elements.',
    appliesTo: ['clean', 'stage', 'renovate']
  },
  {
    id: 'preserve_floors',
    label: 'Preserve Floors',
    promptFragment: 'Preserve the floor layout and boundaries exactly as shown.',
    appliesTo: ['clean', 'stage']
  },
  {
    id: 'preserve_ceilings',
    label: 'Preserve Ceilings',
    promptFragment: 'Preserve ceilings exactly as shown - do not alter ceiling height, features, or lighting fixtures.',
    appliesTo: ['clean', 'stage', 'renovate']
  },
  {
    id: 'preserve_windows',
    label: 'Preserve Windows',
    promptFragment: 'Preserve all windows exactly as shown - same size, position, frame style, and view through them.',
    appliesTo: ['clean', 'stage', 'renovate']
  },
  {
    id: 'preserve_doors',
    label: 'Preserve Doors',
    promptFragment: 'Preserve all doors exactly as shown - same position, style, and state (open/closed).',
    appliesTo: ['clean', 'stage', 'renovate']
  },
  {
    id: 'preserve_trims',
    label: 'Preserve Trims & Moldings',
    promptFragment: 'Preserve all architectural trims, moldings, baseboards, and crown moldings exactly.',
    appliesTo: ['clean', 'stage', 'renovate']
  },
  {
    id: 'preserve_camera_angle',
    label: 'Preserve Camera Angle',
    promptFragment: 'Maintain the exact same camera angle, perspective, and field of view.',
    appliesTo: ['clean', 'stage', 'renovate', 'twilight']
  },
  {
    id: 'preserve_lighting_fixtures',
    label: 'Preserve Lighting Fixtures',
    promptFragment: 'Preserve all lighting fixtures exactly as shown - do not add, remove, or modify light fixtures.',
    appliesTo: ['clean', 'stage']
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic Quality',
    promptFragment: 'The result must be photorealistic and indistinguishable from a professional real estate photograph.',
    appliesTo: ['clean', 'stage', 'renovate', 'twilight']
  },
  {
    id: 'realistic_scale',
    label: 'Realistic Furniture Scale',
    promptFragment: `CRITICAL FURNITURE SCALE REQUIREMENT: All furniture must be rendered at REAL-WORLD dimensions - do NOT shrink, miniaturize, or scale down furniture to make it "fit nicely" or look aesthetically balanced. The goal is photorealism, not visual harmony.

REAL-WORLD FURNITURE SIZES (these are NON-NEGOTIABLE):
- Queen bed: 1.5m wide × 2.0m long (will dominate a small bedroom - this is CORRECT)
- Single bed: 0.9m wide × 1.9m long
- Bedside table: 0.5m wide × 0.6m tall
- Standard desk: 1.2m wide × 0.6m deep
- 3-seater sofa: 2.0-2.4m wide
- Standard door: 2.1m tall (use as visual scale reference)

If standard furniture would make the room look cramped or cluttered, that is the CORRECT result for a small room. Do NOT artificially shrink furniture to create more visual space. If furniture truly cannot fit, use FEWER pieces or choose appropriately SMALLER furniture types (e.g., single bed instead of queen), but never shrink standard furniture below real-world dimensions.`,
    appliesTo: ['stage']
  }
]

export function getGuardrailsForModule(module: 'clean' | 'stage' | 'renovate' | 'twilight'): Guardrail[] {
  return ARCHITECTURAL_GUARDRAILS.filter(g => g.appliesTo.includes(module))
}

export function buildGuardrailPrompt(guardrailIds: string[]): string {
  const guardrails = ARCHITECTURAL_GUARDRAILS.filter(g => guardrailIds.includes(g.id))
  return guardrails.map(g => g.promptFragment).join(' ')
}

export function getDefaultGuardrailIds(module: 'clean' | 'stage' | 'renovate' | 'twilight'): string[] {
  return getGuardrailsForModule(module).map(g => g.id)
}
