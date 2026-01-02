export function buildCleanSlatePrompt(): string {
  return `Remove all furniture, decor, and clutter from this interior real estate photograph to create a clean, empty room. Requirements:
1) Remove ALL furniture including sofas, chairs, tables, beds, cabinets, shelving units, and any other movable items.
2) Remove ALL decor including artwork, mirrors, plants, lamps, rugs, curtains/drapes, cushions, and decorative objects.
3) Remove ALL clutter including personal items, cables, boxes, and miscellaneous objects.
4) PRESERVE all architectural elements exactly: walls, floors, ceilings, windows, doors, built-in features, light fixtures, outlets, and switches.
5) PRESERVE all surface materials and textures exactly as shown - do not change paint colors, flooring materials, or any finishes.
6) Fill in areas where furniture was removed with realistic continuation of the existing floor, wall, or surface materials.
7) Maintain consistent lighting and shadows appropriate for an empty room.
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
