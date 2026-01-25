export interface StagingPromptParams {
  roomType?: string
  style?: string
}

export interface SecondaryAnglePromptParams extends StagingPromptParams {
  furnitureSpec: string
}

export function buildStagingPrompt(params: StagingPromptParams): string {
  const roomType = params.roomType || 'room'
  const style = params.style || 'modern contemporary'

  return `Virtually stage this empty ${roomType} with realistic furniture and decor in a ${style} style, creating a professionally photographed space suitable for luxury real estate marketing.

Add appropriate furniture for a ${roomType} that is proportional to the space and professionally arranged. Use a cohesive ${style} design aesthetic throughout - furniture, textiles, and accessories should complement each other naturally. Include realistic soft furnishings like rugs, cushions, throws, and curtains where appropriate. Add tasteful decor such as artwork, plants, lamps, and decorative objects that enhance the space without cluttering it.

All furniture should be properly grounded with realistic shadows and reflections, appearing as if it was actually photographed in this space. Furniture placement should feel natural and allow for realistic traffic flow through the room.

Preserve all architectural elements exactly as shown - walls, floors, ceilings, windows, doors, and built-in features must remain unchanged. Do not alter any surface materials, paint colors, flooring, or existing finishes. Maintain the same lighting conditions and camera angle as the original photograph.

The final result should be photorealistic and indistinguishable from an actual professionally staged and photographed property.`
}

export function buildSecondaryAnglePrompt(params: SecondaryAnglePromptParams): string {
  const roomType = params.roomType || 'room'
  const style = params.style || 'modern contemporary'

  return `Virtually stage this empty ${roomType} to match an existing staged view of the same space. You are viewing the same room from a different camera angle and must recreate the exact same furniture arrangement.

The furniture specification from the master view:
${params.furnitureSpec}

Place the exact same furniture items as specified above in the same positions relative to the room. You are simply viewing these same pieces from a different perspective - adjust their appearance for this camera angle accordingly. Maintain the same ${style} design aesthetic and color palette. Ensure furniture positions are physically consistent with the master view so items appear in the same locations when viewed from this angle. Include the same soft furnishings and decor items that would be visible from this perspective.

Preserve all architectural elements exactly as shown - walls, floors, ceilings, windows, doors, and built-in features must remain unchanged. Do not alter any surface materials, paint colors, flooring, or existing finishes. Maintain the same lighting conditions and camera angle as this input photograph.

The final result should be photorealistic and suitable for professional real estate marketing.`
}

export const ROOM_TYPES = [
  'living room',
  'bedroom',
  'master bedroom',
  'small bedroom',
  "children's bedroom",
  'guest bedroom',
  'dining room',
  'kitchen',
  'home office',
  'bathroom',
  'open-plan living/dining',
  'family room',
  'nursery',
  'media room',
  'studio apartment'
] as const

// Room-specific furniture constraints
export const ROOM_FURNITURE_CONSTRAINTS: Record<string, string> = {
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

export const STAGING_STYLES = [
  'modern contemporary',
  'minimalist',
  'scandinavian',
  'mid-century modern',
  'traditional',
  'transitional',
  'coastal',
  'industrial',
  'farmhouse',
  'bohemian',
  'luxury',
  'urban modern'
] as const

export type RoomType = typeof ROOM_TYPES[number]
export type StagingStyle = typeof STAGING_STYLES[number]
