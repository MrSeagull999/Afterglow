# 4K Generation Workflow Explained

## Current Behavior

When you generate a 4K version, here's what happens:

### Source Image
**The 4K generation ALWAYS uses the ORIGINAL empty room image**, not the preview you approved.

From `generateService.ts:680`:
```typescript
const inputPath = asset.originalPath
console.log(`[GenerateService] Native 4K: Using ORIGINAL image: ${inputPath}`)
```

### Prompt & Settings
**The 4K generation reuses the EXACT prompt, seed, and settings from the approved preview version.**

From `generateService.ts:714-717`:
```typescript
// Reuse EXACT prompt, seed, and settings from approved version
const injectorPrompts = (version.recipe.settings.injectorPrompts as string[] | undefined) || []
const guardrailPrompts = (version.recipe.settings.guardrailPrompts as string[] | undefined) || []
const customInstructions = (version.recipe.settings.customInstructions as string | undefined) || ''
```

### Why This Happens

This is **intentional design** to ensure:
1. **Consistency** - Same prompt/seed should produce similar results
2. **Quality** - 4K generation starts from high-resolution original, not downscaled preview
3. **Reproducibility** - Exact settings are preserved from approved version

---

## Why Results Can Differ

Even though the prompt and seed are identical, the 4K output can differ from the preview because:

1. **Different input image** - Original (empty) vs. Preview (already staged)
2. **Different resolution** - 4K (3840px) vs. Preview (~1024px)
3. **AI variability** - Even with same seed, higher resolution can produce variations
4. **Model behavior** - AI may interpret instructions differently at 4K scale

---

## The "Random Success" You Experienced

When you generated 4K and got the bed on the right wall (as desired), it happened because:

1. The 4K generation used the **original empty room image**
2. It applied your custom instructions: "bed against RIGHT WALL"
3. At 4K resolution, the AI happened to follow the instruction correctly
4. The preview generation (at lower resolution) had ignored the instruction

This inconsistency is frustrating because you can't predict which generation will follow instructions.

---

## Current Approval Requirement

**You MUST approve a preview before generating 4K.**

From `generateService.ts:483-484`:
```typescript
if (version.qualityTier !== 'final' && version.status !== 'approved' && version.status !== 'hq_ready') {
  throw new Error('Version must be approved or HQ ready before generating final')
}
```

### Why This Exists:
- Prevents accidental expensive 4K generations
- Ensures you've reviewed the preview first
- Maintains workflow: Preview → Approve → 4K

### The Problem:
- You can't generate 4K directly from the original image
- You must approve a preview (even if it's wrong) to unlock 4K generation
- The 4K might be different from the approved preview anyway

---

## Proposed Solutions

### Option 1: Remove Approval Requirement (Simplest)
**Allow 4K generation directly from original image without approval.**

**Pros:**
- Skip preview if you're confident in your settings
- Faster workflow for experienced users
- No need to approve "wrong" previews just to unlock 4K

**Cons:**
- Risk of expensive 4K generations without preview check
- Users might waste credits on bad prompts

**Implementation:**
```typescript
// Remove this check:
if (version.status !== 'approved' && version.status !== 'hq_ready') {
  throw new Error('Version must be approved or HQ ready before generating final')
}
```

### Option 2: Add "Generate 4K from Original" Button
**Add a separate workflow that creates a 4K version directly from original.**

**Pros:**
- Explicit user choice
- Maintains safety of approval workflow
- Clear what source image is being used

**Cons:**
- More UI complexity
- Two different 4K generation paths

### Option 3: Show Source Image in UI
**Display which image will be used for 4K generation.**

**Pros:**
- User knows what to expect
- No workflow changes needed
- Educational

**Cons:**
- Doesn't solve the inconsistency problem
- Still requires approval

---

## Recommendation

**Remove the approval requirement for 4K generation** with these safeguards:

1. **Add confirmation dialog** before 4K generation showing:
   - Source image (original)
   - Estimated cost
   - Prompt preview
   - "Are you sure?" confirmation

2. **Keep approval workflow optional** for users who want to preview first

3. **Add "Regenerate 4K" button** on approved versions for re-rolls

This gives you control while maintaining safety through confirmation dialogs.

---

## Furniture Positioning Issue

The bed centering issue is separate from the 4K workflow. It's caused by:

1. **AI not following custom instructions** at preview resolution
2. **Weak positioning language** in the prompt (now fixed)
3. **Inconsistent AI behavior** between preview and 4K resolutions

### What's Been Fixed:

The base prompt now includes **much stronger** positioning instructions:

```
FURNITURE POSITIONING GUIDANCE:
- CRITICAL: When specific wall placement is requested in custom instructions 
  (e.g., "bed against right wall"), you MUST follow those instructions exactly. 
  This is a mandatory requirement.
- For bedrooms: If a wall is specified for the bed (e.g., "bed against RIGHT WALL"), 
  the bed headboard MUST be placed flush against that wall. 
  Do NOT place the bed in the center of the room. 
  Do NOT float the bed away from the wall.
```

### How to Use:

In **Custom Instructions**, write:
```
Place bed headboard against RIGHT WALL (not centered in room)
```

The strengthened language should improve compliance, but AI behavior can still vary.

---

## Summary

**Current State:**
- 4K uses original image + approved version's prompt/seed
- Approval required before 4K generation
- Results can differ from preview due to resolution/input differences
- Furniture positioning instructions have been strengthened

**Your Experience:**
- Preview ignored "right wall" instruction → bed centered
- 4K generation followed instruction → bed on right wall
- This inconsistency is due to AI variability, not workflow design

**Next Steps:**
1. Test with strengthened positioning instructions
2. Consider removing approval requirement for more control
3. Add UI clarity about source images and workflow
