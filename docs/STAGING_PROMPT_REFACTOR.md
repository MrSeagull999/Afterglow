# Virtual Staging Prompt System - Refactor Documentation

## Overview
This document outlines the refactored virtual staging prompt system that eliminates redundancy and prevents unwanted additions.

---

## Problems Solved

### 1. **Curtains Added When Unchecked**
**Root Cause:** The old base prompt (line 118) explicitly requested "curtains where appropriate" regardless of checkbox state.

**Solution:** Removed all soft furnishings and decor from base prompt. Curtains are now ONLY added when the "Add Curtains" checkbox is enabled.

### 2. **Unwanted Lighting Fixtures**
**Root Cause:** Base prompt requested "lamps" without specifying portable vs. permanent fixtures. AI interpreted this broadly and added ceiling lights.

**Solution:** 
- Base prompt now explicitly forbids modifying permanent lighting fixtures
- "Add Accent Lighting" checkbox now clarifies: "PORTABLE lamps only - do NOT add or modify ceiling fixtures, wall sconces, or permanent lighting"

### 3. **Redundant Instructions**
**Root Cause:** Base prompt pre-included items that checkboxes were supposed to add (rugs, cushions, throws, curtains, artwork, plants, lamps).

**Solution:** Complete separation - base prompt only handles furniture and architecture, checkboxes add everything else.

---

## Refactored Base Prompt Structure

### What the Base Prompt NOW Includes:
- **Room dimensions** (if provided)
- **Furniture placement rules** (room-specific constraints)
- **Scale requirements** (realistic furniture sizing)
- **Preservation rules** (architecture, materials, lighting, windows)
- **Mirror placement restrictions** (prevents AI hallucinations in reflections)
- **Reflective surface guidelines** (minimizes camera-facing reflective objects)
- **Quality requirements** (photorealism, camera angle)

### What the Base Prompt NO LONGER Includes:
- ❌ Soft furnishings (rugs, cushions, throws, curtains)
- ❌ Decor items (artwork, plants, decorative objects)
- ❌ Lighting accessories (lamps)
- ❌ Window treatments

### Mirror Placement Restrictions (NEW)

**Problem Solved:** When mirrors face the camera directly, AI models often hallucinate reflections that don't match actual room geometry (e.g., showing non-existent doors, windows, or incorrect perspectives).

**Solution:** The base prompt now includes explicit mirror placement rules:
- Mirrors NEVER positioned to reflect back toward camera
- Mirrors placed on perpendicular walls (left/right walls)
- Mirrors positioned to reflect side walls, windows, or room depth
- Acceptable placements: above furniture (angled down), on side walls, or in corners (angled away)
- Mirror reflections must match actual room geometry - no hallucinated elements

**Additional Safety:** Broader reflective surface guidelines prevent glossy artwork, metallic objects, and glass-fronted items from facing the camera directly.

---

## Checkbox System - Individual Prompt Snippets

Each checkbox adds a **single, specific instruction**. Here's what each one does:

### Soft Furnishings

#### **Add Area Rug**
```
Add an appropriately sized area rug that anchors the furniture arrangement and complements the design style.
```

#### **Add Throws & Cushions**
```
Add decorative throws draped over sofas/chairs and decorative cushions arranged on seating and beds for a lived-in, inviting feel.
```

### Window Treatments

#### **Add Curtains**
```
Add curtains or drapes to bare windows in a style matching the overall design aesthetic. Use floor-length curtains that complement the room's color palette.
```

### Decor Elements

#### **Add Indoor Plants**
```
Include 1-3 indoor plants in appropriate locations (corners, beside furniture, on surfaces). Mix sizes from small potted plants to larger floor plants where space permits.
```

#### **Add Wall Art**
```
Add wall art that complements the room's style. Include properly scaled and positioned artwork, framed prints, or photography on appropriate walls.
```

#### **Add Mirrors**
```
Include a tasteful mirror positioned on a side wall or above furniture (dresser, console table). The mirror must be positioned to reflect room depth or side walls rather than face the camera directly. Ensure reflections show actual room geometry only.
```
**Note:** This checkbox includes built-in safety rules to prevent AI hallucinations in mirror reflections.

### Lighting

#### **Add Accent Lighting**
```
Add portable lighting fixtures: table lamps on side tables/consoles and floor lamps in corners or beside seating. These are PORTABLE lamps only - do NOT add or modify ceiling fixtures, wall sconces, or permanent lighting.
```
**Note:** This explicitly prevents ceiling light additions.

### Style Modifiers

#### **Minimal Staging**
```
STYLE MODIFIER: Use minimal furniture - only essential pieces. Keep the space feeling open and uncluttered with maximum negative space.
```

#### **Luxury Staging**
```
STYLE MODIFIER: Use high-end, luxury furniture and finishes. Include premium materials like marble, brass, velvet, and rich textiles. Select designer-quality pieces.
```

#### **Family-Friendly**
```
STYLE MODIFIER: Stage with family-friendly furniture - durable fabrics, rounded edges, and a warm, inviting feel suitable for families with children. Avoid delicate or fragile-looking pieces.
```

### Color Modifiers

#### **Neutral Color Palette**
```
COLOR MODIFIER: Use a neutral color palette throughout - whites, creams, beiges, grays, and natural wood tones. Avoid bold or bright accent colors.
```

#### **Warm Color Palette**
```
COLOR MODIFIER: Use warm colors throughout the staging - terracotta, rust, warm browns, golden tones, and warm neutrals.
```

#### **Cool Color Palette**
```
COLOR MODIFIER: Use cool colors throughout the staging - blues, greens, cool grays, and silver tones.
```

---

## Edit Mode Template

Use this when modifying already-staged images. The `buildEditModePrefix()` function creates this prefix:

```typescript
import { buildEditModePrefix } from '@/shared/services/prompt/prompts'

// Example usage:
const editPrefix = buildEditModePrefix({
  userChanges: "Remove the blue sofa and replace it with a gray sectional",
  preserveExisting: true // default
})
```

### Generated Output:
```
⚠️ EDIT MODE ACTIVE ⚠️
This image already contains virtual staging. Make ONLY the following changes:

[USER SPECIFIED CHANGES]

PRESERVE everything else exactly as shown:
- Keep all existing furniture in the same positions
- Maintain all existing decor items
- Do not add any new elements unless specified
- Do not remove any elements unless specified

All other requirements and preservation rules still apply.
```

### Example Edit Mode Scenarios:

**Scenario 1: Remove specific item**
```typescript
buildEditModePrefix({
  userChanges: "Remove the area rug but keep all other elements"
})
```

**Scenario 2: Add missing element**
```typescript
buildEditModePrefix({
  userChanges: "Add a coffee table between the sofa and chairs"
})
```

**Scenario 3: Replace item**
```typescript
buildEditModePrefix({
  userChanges: "Replace the wooden dining table with a glass-top table"
})
```

**Scenario 4: Modify color**
```typescript
buildEditModePrefix({
  userChanges: "Change the throw pillows from blue to warm terracotta tones"
})
```

---

## Checkbox Conflicts & Recommendations

### Mutually Exclusive Options

#### **Color Modifiers**
- ⚠️ **Neutral**, **Warm**, and **Cool** palettes should NOT be used together
- **Recommendation:** Make these radio buttons instead of checkboxes, or add logic to deselect others when one is chosen

#### **Style Modifiers**
- ⚠️ **Minimal Staging** conflicts with **Luxury Staging**
  - Minimal = sparse, essential only
  - Luxury = rich, layered, abundant
- **Recommendation:** Allow only one style modifier at a time

### Compatible Combinations

✅ **Good Combinations:**
- Luxury Staging + Warm Palette + Add Curtains + Add Artwork
- Minimal Staging + Neutral Palette + Add Plants
- Family-Friendly + Warm Palette + Add Area Rug + Add Throws & Cushions

❌ **Avoid:**
- Minimal Staging + Luxury Staging (contradictory)
- Neutral Palette + Warm Palette + Cool Palette (conflicting)
- Multiple style modifiers simultaneously

### Redundancy Checks

**No longer redundant** (previously were):
- ✅ Add Curtains - now only adds when checked
- ✅ Add Plants - now only adds when checked
- ✅ Add Artwork - now only adds when checked
- ✅ Add Accent Lighting - now only adds when checked

---

## Implementation Notes

### Files Modified

1. **`/src/shared/services/prompt/prompts.ts`**
   - Refactored `buildStagingBasePrompt()` to remove decor/soft furnishing instructions
   - Added explicit preservation rules
   - Added `buildEditModePrefix()` function

2. **`/prompt-bank/injectors/staging.json`**
   - Clarified all prompt fragments
   - Added explicit exclusions (e.g., "PORTABLE lamps only")
   - Added category prefixes (STYLE MODIFIER, COLOR MODIFIER)

### How Prompts Are Assembled

```typescript
// From promptAssembler.ts
const sections = [
  'base',              // Base prompt (furniture + preservation rules)
  'options',           // Checkbox injectors (decor, soft furnishings)
  'guardrails',        // Safety/quality guardrails
  'extra_instructions' // Custom user instructions
]

// Final prompt = base + options + guardrails + extra
```

### Testing Checklist

- [ ] Stage empty room with NO checkboxes → should have furniture only, no decor
- [ ] Uncheck "Add Curtains" → windows should remain bare
- [ ] Check "Add Accent Lighting" → should add table/floor lamps, NOT ceiling lights
- [ ] Check "Add Plants" → should add 1-3 plants
- [ ] Use Edit Mode to modify existing staging → should preserve other elements

---

## Migration Guide

### For Existing Jobs

Existing staged images were created with the old prompt system. When re-generating or creating new versions:

1. **First generation after refactor:** May look different (less cluttered, more minimal)
2. **To match old results:** Enable relevant checkboxes (Add Curtains, Add Plants, Add Artwork, etc.)
3. **To modify existing staging:** Use Edit Mode with `sourceVersionId` pointing to the staged version

### Recommended Default Checkboxes

For a "standard" staging that matches previous behavior, enable:
- ✅ Add Area Rug
- ✅ Add Curtains
- ✅ Add Throws & Cushions
- ✅ Add Indoor Plants
- ✅ Add Wall Art
- ✅ Add Accent Lighting
- ⚠️ Add Mirrors (optional - only if mirrors are desired, includes safety rules)

---

## Future Enhancements

### Suggested UI Improvements

1. **Make color modifiers radio buttons** (only one at a time)
2. **Make style modifiers radio buttons** (only one at a time)
3. **Add "Standard Staging" preset** that enables common checkboxes
4. **Add "Edit Mode" toggle** in UI that prepends the edit mode prefix
5. **Show prompt preview** so users can see exactly what will be sent

### Additional Injectors to Consider

- **Add Decorative Accessories** (vases, books, candles)
- **Add Mirrors** (wall mirrors, standing mirrors)
- **Add Window Seats/Benches**
- **Seasonal Styling** (holiday decor, seasonal colors)

---

## Summary

The refactored system provides:
- ✅ **Clean separation** between base requirements and optional elements
- ✅ **No unwanted additions** - everything is explicit
- ✅ **Edit Mode support** for modifying existing staging
- ✅ **Clear preservation rules** preventing architectural changes
- ✅ **Explicit exclusions** preventing ceiling light additions
- ✅ **Non-redundant checkboxes** - each adds something unique

All issues identified in the original request have been resolved.
