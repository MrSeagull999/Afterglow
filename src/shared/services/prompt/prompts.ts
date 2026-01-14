export function buildCleanSlateBasePrompt(): string {
  return `Remove all movable furniture and loose objects from this interior real estate photograph to create a clean, empty room. Requirements:
1) Remove ALL movable furniture including sofas, chairs, stools, tables, beds, cabinets, shelving units, and any other furniture pieces.
2) Remove ALL loose objects including:
   - Potted plants (indoor and outdoor)
   - Chairs and stools (all types)
   - Fireplace tools, screens, and accessories
   - Baskets and bins
   - Decorative items and clutter
   - Artwork, mirrors, and wall hangings
   - Lamps and portable lighting
   - Rugs and mats
   - Curtains and drapes
   - Cushions and throws
   - Personal items, cables, cords, and boxes
3) PRESERVE all architectural elements exactly: walls, floors, ceilings, windows, doors, built-in features, permanent light fixtures, outlets, switches, and trim.
4) PRESERVE all surface materials and textures exactly as shown - do not change paint colors, flooring materials, or any finishes.
5) Fill in areas where furniture was removed with realistic continuation of the existing floor, wall, or surface materials.
6) Maintain consistent lighting and shadows appropriate for an empty room.
7) Do not redesign or restyle the room - only remove movable objects.
8) The result must be photorealistic and suitable for professional real estate marketing.
9) Maintain the exact same camera angle and perspective.`
}

export function buildStagingBasePrompt(params: { roomType: string; style: string }): string {
  return `Virtually stage this empty ${params.roomType} with realistic, high-quality furniture and decor in a ${params.style} style. Requirements:
1) Add appropriate furniture for a ${params.roomType}: select pieces that are proportional to the space and professionally arranged.
2) Use a cohesive ${params.style} design aesthetic throughout - furniture, textiles, and accessories should complement each other.
3) Include realistic soft furnishings: rugs, cushions, throws, and curtains where appropriate.
4) Add tasteful decor: artwork, plants, lamps, and decorative objects that enhance the space without cluttering.
5) Ensure all furniture is properly grounded with realistic shadows and reflections.
6) PRESERVE all architectural elements exactly: walls, floors, ceilings, windows, doors, and built-in features.
7) PRESERVE all surface materials - do not change paint colors, flooring, or any existing finishes.
8) Maintain consistent lighting that matches the original photograph.
9) The result must be photorealistic and suitable for professional real estate marketing.
10) Maintain the exact same camera angle and perspective.
11) Furniture placement should feel natural and allow for realistic traffic flow through the space.`
}

export interface RenovateChanges {
  floor?: {
    enabled: boolean
    material: string
    color?: string
    pattern?: string
  }
  wallPaint?: {
    enabled: boolean
    color: string
    finish?: 'matte' | 'eggshell' | 'satin' | 'semi-gloss' | 'gloss'
    walls?: 'all' | 'accent' | string[]
  }
  curtains?: {
    enabled: boolean
    style: string
    color?: string
    material?: string
  }
}

export function buildRenovateBasePrompt(changes: RenovateChanges): string {
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
