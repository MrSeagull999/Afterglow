export interface RenovateChanges {
  floor?: FloorChange
  wallPaint?: WallPaintChange
  curtains?: CurtainChange
}

export interface FloorChange {
  enabled: boolean
  material: string
  color?: string
  pattern?: string
}

export interface WallPaintChange {
  enabled: boolean
  color: string
  finish?: 'matte' | 'eggshell' | 'satin' | 'semi-gloss' | 'gloss'
  walls?: 'all' | 'accent' | string[]
}

export interface CurtainChange {
  enabled: boolean
  style: string
  color?: string
  material?: string
}

export function buildRenovatePrompt(changes: RenovateChanges): string {
  const changeParts: string[] = []
  const preserveParts: string[] = []

  if (changes.floor?.enabled) {
    const floor = changes.floor
    let floorDesc = `Change the flooring to ${floor.material}`
    if (floor.color) floorDesc += ` in ${floor.color}`
    if (floor.pattern) floorDesc += ` with a ${floor.pattern} pattern`
    changeParts.push(floorDesc)
  } else {
    preserveParts.push('flooring')
  }

  if (changes.wallPaint?.enabled) {
    const paint = changes.wallPaint
    let paintDesc = `Paint the walls ${paint.color}`
    if (paint.finish) paintDesc += ` with a ${paint.finish} finish`
    if (paint.walls === 'accent') {
      paintDesc += ' on the accent wall only'
    } else if (Array.isArray(paint.walls)) {
      paintDesc += ` on the following walls: ${paint.walls.join(', ')}`
    }
    changeParts.push(paintDesc)
  } else {
    preserveParts.push('wall paint colors')
  }

  if (changes.curtains?.enabled) {
    const curtains = changes.curtains
    let curtainDesc = `Replace the curtains with ${curtains.style} curtains`
    if (curtains.color) curtainDesc += ` in ${curtains.color}`
    if (curtains.material) curtainDesc += ` made of ${curtains.material}`
    changeParts.push(curtainDesc)
  } else {
    preserveParts.push('curtains/window treatments')
  }

  const changeInstructions = changeParts.length > 0
    ? `Make the following changes to this interior photograph:\n${changeParts.map((c, i) => `${i + 1}) ${c}.`).join('\n')}`
    : ''

  const preserveInstructions = preserveParts.length > 0
    ? `PRESERVE exactly as shown: ${preserveParts.join(', ')}.`
    : ''

  return `${changeInstructions}

Requirements:
1) ${preserveInstructions}
2) PRESERVE all furniture, decor, and objects exactly as shown - do not move, add, or remove any items.
3) PRESERVE all architectural elements: walls (structure), ceilings, windows, doors, trims, and built-in features.
4) PRESERVE all lighting fixtures and their positions.
5) The changed surfaces must look photorealistic with proper textures, reflections, and shadows.
6) Maintain consistent lighting that matches the original photograph.
7) The result must be photorealistic and suitable for professional real estate marketing.
8) Maintain the exact same camera angle and perspective.
9) Only change what is explicitly specified above - everything else must remain untouched.`
}

export const FLOOR_MATERIALS = [
  'hardwood',
  'engineered hardwood',
  'laminate',
  'vinyl plank',
  'tile',
  'marble',
  'concrete',
  'carpet',
  'bamboo',
  'stone'
] as const

export const FLOOR_COLORS = [
  'light oak',
  'natural oak',
  'honey oak',
  'walnut',
  'espresso',
  'gray',
  'whitewashed',
  'ebony',
  'cherry',
  'ash'
] as const

export const WALL_COLORS = [
  'white',
  'off-white',
  'cream',
  'beige',
  'light gray',
  'warm gray',
  'cool gray',
  'charcoal',
  'navy blue',
  'sage green',
  'dusty rose',
  'terracotta',
  'soft yellow',
  'pale blue'
] as const

export const CURTAIN_STYLES = [
  'sheer',
  'blackout',
  'linen',
  'velvet',
  'cotton',
  'roman shades',
  'roller blinds',
  'plantation shutters'
] as const

export type FloorMaterial = typeof FLOOR_MATERIALS[number]
export type FloorColor = typeof FLOOR_COLORS[number]
export type WallColor = typeof WALL_COLORS[number]
export type CurtainStyle = typeof CURTAIN_STYLES[number]
