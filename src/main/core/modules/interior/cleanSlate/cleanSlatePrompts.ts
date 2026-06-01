export function buildCleanSlatePrompt(): string {
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

export function buildCleanSlatePromptWithInjectors(injectorPrompts: string[]): string {
  const base = buildCleanSlatePrompt()
  if (injectorPrompts.length === 0) return base

  return `${base}

Additional requirements:
${injectorPrompts.join('\n')}`
}
