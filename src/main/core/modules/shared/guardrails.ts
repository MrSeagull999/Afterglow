export interface Guardrail {
  id: string
  label: string
  promptFragment: string
  appliesTo: ('clean' | 'stage' | 'renovate' | 'twilight' | 'relight')[]
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
    appliesTo: ['clean', 'stage', 'renovate', 'twilight', 'relight']
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
    appliesTo: ['clean', 'stage', 'renovate', 'twilight', 'relight']
  },
  {
    id: 'realistic_scale',
    label: 'Realistic Furniture Scale',
    promptFragment: `All furniture must be rendered at accurate real-world dimensions. A queen bed is 1.5m wide by 2.0m long, a standard sofa is 2.0-2.4m wide, and doors are typically 2.1m tall - use these as visual scale references. If standard-sized furniture would make a small room look cramped or cluttered, that is the correct and realistic result. Choose fewer pieces or smaller furniture types like a single bed instead of a queen, but never artificially shrink furniture below real-world dimensions to create more visual space.`,
    appliesTo: ['stage']
  }
]

export function getGuardrailsForModule(module: 'clean' | 'stage' | 'renovate' | 'twilight' | 'relight'): Guardrail[] {
  return ARCHITECTURAL_GUARDRAILS.filter(g => g.appliesTo.includes(module))
}

export function buildGuardrailPrompt(guardrailIds: string[]): string {
  const guardrails = ARCHITECTURAL_GUARDRAILS.filter(g => guardrailIds.includes(g.id))
  return guardrails.map(g => g.promptFragment).join(' ')
}

export function getDefaultGuardrailIds(module: 'clean' | 'stage' | 'renovate' | 'twilight' | 'relight'): string[] {
  return getGuardrailsForModule(module).map(g => g.id)
}
