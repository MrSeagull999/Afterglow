# Virtual Staging Prompt - Quick Reference

## Base Prompt (Always Included)

**Includes:**
- Furniture placement for the room type
- Scale and proportion requirements
- Realistic shadows and grounding
- Traffic flow rules
- **Mirror placement restrictions** (prevents AI hallucinations)
- **Reflective surface guidelines** (minimizes camera-facing reflections)

**Explicitly EXCLUDES:**
- ❌ Lighting fixtures (ceiling, wall, permanent)
- ❌ Window treatments (unless checkbox enabled)
- ❌ Decorative elements (unless checkbox enabled)
- ❌ Soft furnishings (unless checkbox enabled)

**Mirror Safety Rules (Built-in):**
- Mirrors NEVER face camera directly
- Placed on perpendicular walls or above furniture
- Reflections must match actual room geometry
- No hallucinated doors/windows in reflections

---

## Checkbox Prompt Snippets

### Soft Furnishings
| Checkbox | What It Adds |
|----------|-------------|
| **Add Area Rug** | Appropriately sized area rug anchoring furniture |
| **Add Throws & Cushions** | Decorative throws on sofas/chairs, cushions on seating/beds |

### Window Treatments
| Checkbox | What It Adds |
|----------|-------------|
| **Add Curtains** | Floor-length curtains/drapes matching design aesthetic |

### Decor
| Checkbox | What It Adds |
|----------|-------------|
| **Add Indoor Plants** | 1-3 plants (small potted to large floor plants) |
| **Add Wall Art** | Properly scaled artwork/prints/photography |
| **Add Mirrors** | Mirror on side wall or above furniture (safe placement, no hallucinations) |

### Lighting
| Checkbox | What It Adds |
|----------|-------------|
| **Add Accent Lighting** | Table lamps + floor lamps (PORTABLE ONLY, no ceiling fixtures) |

### Style Modifiers (Choose ONE)
| Checkbox | Effect |
|----------|---------|
| **Minimal Staging** | Essential furniture only, maximum negative space |
| **Luxury Staging** | High-end furniture, premium materials (marble, brass, velvet) |
| **Family-Friendly** | Durable fabrics, rounded edges, warm inviting feel |

### Color Modifiers (Choose ONE)
| Checkbox | Color Palette |
|----------|---------------|
| **Neutral Palette** | Whites, creams, beiges, grays, natural wood |
| **Warm Palette** | Terracotta, rust, warm browns, golden tones |
| **Cool Palette** | Blues, greens, cool grays, silver tones |

---

## Edit Mode Template

**When to use:** Modifying already-staged images

**Function:**
```typescript
import { buildEditModePrefix } from '@/shared/services/prompt/prompts'

const editPrefix = buildEditModePrefix({
  userChanges: "Your specific changes here",
  preserveExisting: true
})
```

**Examples:**
- Remove item: `"Remove the area rug"`
- Add item: `"Add a coffee table between sofa and chairs"`
- Replace item: `"Replace wooden table with glass-top table"`
- Modify color: `"Change pillows from blue to terracotta"`

---

## Conflict Matrix

### ⚠️ DO NOT Combine:
- Minimal Staging + Luxury Staging
- Neutral + Warm + Cool palettes (pick one)
- Multiple style modifiers

### ✅ Good Combinations:
- Luxury + Warm + Curtains + Artwork
- Minimal + Neutral + Plants
- Family-Friendly + Warm + Rug + Throws

---

## Testing Checklist

- [ ] No checkboxes = furniture only (no decor/curtains)
- [ ] Curtains unchecked = bare windows
- [ ] Accent Lighting = lamps only (no ceiling lights)
- [ ] Edit Mode = preserves existing elements

---

## Files Modified

1. `src/shared/services/prompt/prompts.ts` - Base prompt + Edit Mode function
2. `prompt-bank/injectors/staging.json` - Checkbox definitions

See `STAGING_PROMPT_REFACTOR.md` for full documentation.
