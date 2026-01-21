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

// Room-specific furniture constraints (must match stagingPrompts.ts)
const ROOM_FURNITURE_CONSTRAINTS: Record<string, string> = {
  'small bedroom': 'Use only a SINGLE bed (not queen or king). Include minimal furniture: one small nightstand, and optionally a small dresser or desk. Do not overcrowd the space.',
  "children's bedroom": 'Use child-appropriate furniture: a single or bunk bed, child-sized desk, toy storage, and playful but tasteful decor. Furniture should be safe with rounded edges.',
  'nursery': 'Include a crib, changing table, comfortable nursing chair, and soft storage. Use calming colors and child-safe furniture.',
  'studio apartment': 'Use space-efficient furniture that serves multiple purposes. Include a sofa bed or murphy bed, compact dining area, and smart storage solutions.',
  'home office': 'Include a desk, ergonomic office chair, and appropriate storage. Ensure good lighting for work.',
  'master bedroom': 'Use a king or queen bed as the focal point with matching nightstands. Include a seating area if space permits.',
  'guest bedroom': 'Use a queen bed with simple, welcoming decor. Keep furniture minimal but comfortable.',
  'bedroom': 'Use a queen or double bed with nightstands. Include a dresser if space permits.',
  'living room': 'Include a sofa as the main seating, with accent chairs, coffee table, and side tables. Arrange furniture to create a conversational grouping.',
  'dining room': 'Include a dining table with chairs appropriately sized for the space. A 6-seater table for medium rooms, 4-seater for smaller spaces.',
  'kitchen': 'If space permits, add bar stools at a counter or island. Keep staging minimal to showcase the kitchen itself.',
  'family room': 'Use comfortable, durable furniture suitable for family use. Include ample seating and a media console if appropriate.',
  'media room': 'Include comfortable seating oriented toward where a TV/screen would be. Consider a sectional sofa or theater-style seating.',
  'bathroom': 'Add minimal staging - towels, bath mat, and small decorative items only. Do not add furniture.',
  'open-plan living/dining': 'Define distinct zones for living and dining with furniture placement. Use a rug to anchor the living area and ensure visual flow between spaces.'
}

export interface StagingPromptParams {
  roomType: string
  style: string
  roomDimensions?: {
    enabled: boolean
    width: string
    length: string
    unit: 'feet' | 'meters'
    backWall?: string
    leftWall?: string
    rightWall?: string
    ceilingHeight?: string
  }
}

// Standard furniture dimensions for scale reference
const FURNITURE_SCALE_REFERENCE = `
FURNITURE SCALE REFERENCE (use these as anchors for realistic sizing):
- Standard door: 2.1m tall × 0.9m wide
- Single bed: 0.9m wide × 1.9m long
- Double bed: 1.4m wide × 1.9m long  
- Queen bed: 1.5m wide × 2.0m long
- King bed: 1.8m wide × 2.0m long
- Bedside table: 0.5m wide × 0.5m deep × 0.6m tall
- Standard desk: 1.2m wide × 0.6m deep × 0.75m tall
- Office chair seat height: 0.45m
- Dining chair seat height: 0.45m
- 2-seater sofa: 1.5m wide
- 3-seater sofa: 2.0-2.4m wide
- Coffee table: 1.2m × 0.6m × 0.45m tall
- Standard ceiling height: 2.4-2.7m`

export interface EditModeParams {
  userChanges: string
  preserveExisting?: boolean
}

export function buildEditModePrefix(params: EditModeParams): string {
  const preserveNote = params.preserveExisting !== false 
    ? `
PRESERVE everything else exactly as shown:
- Keep all existing furniture in the same positions
- Maintain all existing decor items
- Do not add any new elements unless specified
- Do not remove any elements unless specified` 
    : ''

  return `⚠️ EDIT MODE ACTIVE ⚠️
This image already contains virtual staging. Make ONLY the following changes:

${params.userChanges}
${preserveNote}

All other requirements and preservation rules still apply.`
}

export function buildStagingBasePrompt(params: StagingPromptParams): string {
  const { roomType, style, roomDimensions } = params
  
  // Build wall-specific dimensions instruction if provided
  let dimensionsInstruction = ''
  if (roomDimensions?.enabled) {
    const unit = roomDimensions.unit === 'meters' ? 'm' : 'ft'
    const wallDimensions: string[] = []
    
    if (roomDimensions.backWall) {
      wallDimensions.push(`The BACK WALL (wall facing the camera) is approximately ${roomDimensions.backWall}${unit} wide`)
    }
    if (roomDimensions.leftWall) {
      wallDimensions.push(`The LEFT WALL extends approximately ${roomDimensions.leftWall}${unit} into the room`)
    }
    if (roomDimensions.rightWall) {
      wallDimensions.push(`The RIGHT WALL extends approximately ${roomDimensions.rightWall}${unit} into the room`)
    }
    if (roomDimensions.ceilingHeight) {
      wallDimensions.push(`Ceiling height is approximately ${roomDimensions.ceilingHeight}${unit}`)
    }
    
    // Fallback to legacy width×length if no wall-specific dimensions
    if (wallDimensions.length === 0 && roomDimensions.width && roomDimensions.length) {
      dimensionsInstruction = `\n\nROOM DIMENSIONS: This room is approximately ${roomDimensions.width} × ${roomDimensions.length} ${roomDimensions.unit === 'meters' ? 'meters' : 'feet'}.`
    } else if (wallDimensions.length > 0) {
      dimensionsInstruction = `\n\nROOM DIMENSIONS:\n${wallDimensions.join('.\n')}.

CRITICAL SCALE INSTRUCTION: Use these wall dimensions to calculate correct furniture sizes. Do NOT shrink furniture to "fit nicely" - furniture must be rendered at REAL-WORLD scale. If a bed would realistically take up most of a 2.7m wall, then it should take up most of that wall in the image. The goal is photorealism, not aesthetic balance.
${FURNITURE_SCALE_REFERENCE}`
    }
  }
  
  // Get room-specific furniture constraints
  const furnitureConstraint = ROOM_FURNITURE_CONSTRAINTS[roomType] || ''
  const furnitureInstruction = furnitureConstraint ? `\n\nFURNITURE REQUIREMENTS FOR ${roomType.toUpperCase()}: ${furnitureConstraint}` : ''

  return `Virtually stage this empty ${roomType} with realistic, high-quality furniture in a ${style} style.${dimensionsInstruction}${furnitureInstruction}

CORE REQUIREMENTS:
1) Add appropriate furniture for a ${roomType}: select pieces that are proportional to the space and professionally arranged.
2) Use a cohesive ${style} design aesthetic throughout - furniture and textiles should complement each other.
3) Ensure all furniture is properly grounded with realistic shadows and reflections.
4) Furniture placement should feel natural and allow for realistic traffic flow through the space.
5) All furniture must be realistically scaled - do not miniaturize or shrink furniture to fit the space.

FURNITURE POSITIONING GUIDANCE:
- CRITICAL: When specific wall placement is requested in custom instructions (e.g., "bed against right wall"), you MUST follow those instructions exactly. This is a mandatory requirement.
- Wall identification system: BACK WALL = wall facing the camera (visible in background), LEFT WALL = wall on left side of image, RIGHT WALL = wall on right side of image.
- For bedrooms: If a wall is specified for the bed (e.g., "bed against RIGHT WALL"), the bed headboard MUST be placed flush against that wall. Do NOT place the bed in the center of the room. Do NOT float the bed away from the wall.
- Default furniture placement: Furniture should be positioned against walls or in logical arrangements. Do NOT arbitrarily center furniture in the middle of the room unless explicitly requested to do so.
- If custom instructions specify "bed against RIGHT WALL", this means: position the bed so the headboard is touching the right wall, with the bed extending into the room perpendicular to that wall.

STRICT PRESERVATION RULES:
- PRESERVE all architectural elements exactly: walls, floors, ceilings, windows, doors, and built-in features.
- PRESERVE all surface materials - do not change paint colors, flooring, or any existing finishes.
- DO NOT add, remove, or modify any lighting fixtures (ceiling lights, wall sconces, pendant lights, chandeliers, recessed lighting).
- DO NOT add or modify window treatments (curtains, drapes, blinds, shades) unless explicitly instructed.
- DO NOT add decorative elements (artwork, plants, decorative objects, accessories) unless explicitly instructed.
- Maintain consistent lighting that matches the original photograph.
- CRITICAL: Maintain the EXACT same camera angle, perspective, and viewpoint as the input image. Do NOT shift, rotate, zoom, or change the camera position in any way. The output must show the same view of the room as the input.

MIRROR PLACEMENT RULES:
- Mirrors should NEVER be positioned to reflect directly back toward the camera.
- Place mirrors on walls perpendicular to the camera view (left or right walls).
- Mirrors should reflect side walls, windows, or room depth - NOT the camera perspective.
- Acceptable mirror placements: above dressers/console tables (angled slightly downward), on side walls (reflecting the opposite wall), or leaning mirrors in corners (angled away from camera).
- If a mirror would face the camera directly, reposition it to a different wall, angle it to reflect the side of the room, or replace with alternative wall art.
- Mirror reflections must be consistent with actual room geometry - do NOT hallucinate or invent doors, windows, or architectural elements in reflections.

REFLECTIVE SURFACE GUIDELINES:
- Avoid placing highly reflective objects (mirrors, glossy artwork, metallic sculptures) directly facing the camera.
- Glass-fronted cabinets and picture frames should be angled to minimize direct reflection toward camera.
- TV screens should be positioned to show minimal glare/reflection from the camera angle.

OUTPUT QUALITY:
- The result must be photorealistic and suitable for professional real estate marketing.
- ONLY add elements that are explicitly specified in additional instructions below.`
}

export function buildTwilightPreviewBasePrompt(
  presetPromptTemplate: string,
  lightingCondition?: 'overcast' | 'sunny'
): string {
  const lightingModifier =
    lightingCondition === 'sunny'
      ? `This photograph was taken in bright midday sunlight. Transform the entire lighting condition from midday to dusk, as if the sun has already set below the horizon 20-30 minutes ago during blue hour.

Replace the harsh overhead sunlight with the soft, diffused ambient light of early evening. The scene should have the gentle, low-contrast illumination characteristic of dusk - no directional sun rays, no bright highlights, and no hard shadows from overhead light sources.

Specifically, transform the foliage and landscaping from their bright, sunlit appearance to the darker, more muted tones they would naturally have in evening light. Green leaves should appear significantly less saturated and less luminous than in midday sun. Tree shadows on the ground should be eliminated or softened to barely-visible subtle gradients that match the even ambient light of dusk.

The sky should display a natural blue hour gradient - transitioning from deep blue at the zenith down to soft warm peach and coral tones near the horizon line. This is not bright daylight blue sky; it's the cooler, richer blue of early evening after sunset.

Overall, reduce the scene's luminosity and contrast to match authentic dusk conditions. Every surface - roofs, walls, paving, grass, foliage - should appear as it would naturally look in the soft, even light of early evening, not in bright midday sun.`
      : ''

  const guard = `This is a time-of-day lighting conversion of the provided photograph. Preserve the exact scene composition, architecture, and all physical elements while changing only the lighting conditions to twilight.

For exterior photographs: Windows should glow with warm interior light, appearing as softly illuminated surfaces. The window glass shows a gentle amber or warm white glow from inside, but you cannot see through the glass to view interior details - just the warm light emanating from within.

For interior photographs: Through the windows, you should see the natural twilight sky outside exactly as it appears in the original photograph's exterior view. If the original shows neighboring buildings, fences, trees, or other structures through the windows, these must remain completely unchanged - only add the blue hour sky gradient above and behind these existing exterior elements. The view through the windows should look like the actual exterior at dusk, not an invented or altered scene.

Regarding lighting fixtures: Only work with light sources that already exist in the photograph. For exterior shots, enhance only the landscape lighting fixtures that are physically visible in the original image. For interior shots, enhance only the ceiling lights, lamps, and fixtures that are already present in the room. If you're uncertain whether a light source exists, it's better to show subtle ambient lighting rather than adding new fixtures.

The color palette should feel warm and inviting with neutral warm-white tones around 2700-3200K for interior lighting. Avoid heavily saturated orange or artificial-looking color casts. The overall look should be natural and balanced, as if this photograph was actually taken during twilight rather than artificially processed.

When details in the original photograph are unclear or partially obscured, leave them as they are - do not invent or add new details in these areas.`

  const presetAlreadyContainsGuard =
    /truth-preserving twilight conversion/i.test(presetPromptTemplate) ||
    /Treat windows as light-emitting planes, not viewports/i.test(presetPromptTemplate) ||
    /Do NOT invent exterior\/garden\/landscape lighting/i.test(presetPromptTemplate) ||
    /Ambiguity rule: If unsure, do nothing/i.test(presetPromptTemplate) ||
    /neutral warm-white/i.test(presetPromptTemplate)

  const parts: string[] = []
  if (lightingModifier) parts.push(lightingModifier)
  if (!presetAlreadyContainsGuard) parts.push(guard)
  parts.push(presetPromptTemplate)
  return parts.join('\n\n')
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
