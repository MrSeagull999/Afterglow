# Afterglow Studio — Preview vs Final Split (Truth-Preserving Pipeline)

Status: Draft (active work tracker)  
Owner: Greg  
Principle: **Final output must be boring by design.**

---

## Why we’re doing this

Afterglow’s twilight pipeline currently risks late-stage hallucinations:
- Interior furniture/silhouettes invented through glowing windows
- Garden/path/uplight fixtures invented because “twilight implies lighting”
- Preview → Final amplification where the final pass reinterprets instead of refining

This creates a **trust gap**: users assume Final is safest, but it can currently be more creative than Preview.

The fix is architectural, not just prompting:
- **Preview** can be creative (within strict constraints)
- **Final** must be a fidelity pass (no creativity, no interpretation)

---

## Definitions

### Preview (Creative, constrained)
**Purpose:** Produce a usable twilight look quickly.  
**Allowed:** sky replacement, warmth adjustments, light glow as *light only*.  
**Forbidden:** adding new objects, fixtures, inferred light sources, interior content through windows.

Preview is where “what exists” gets decided.

### Final (Fidelity pass, boring by design)
**Purpose:** Increase resolution/clarity only.  
**Allowed:** upscaling, denoise, mild sharpening/restoration.  
**Forbidden:** reinterpretation, new objects, new fixtures, “explaining” light sources, completing occlusions.

Final is not “better twilight”. It’s “same pixels, clearer”.

---

## Non-negotiable Contracts

### Contract 1 — Window Truth
- Windows are **light planes**, not viewports.
- Interior lighting = glow only.
- No furniture, lamps, silhouettes, room layouts, or “visible interiors” may be invented.

### Contract 2 — Exterior Lighting Truth
- No new exterior light sources.
- No path lights, uplights, landscape glow unless the fixture is clearly visible in the original.
- If the source of light is unclear → **reduce intensity, do not invent**.

### Contract 3 — Ambiguity Rules
- Ambiguity must remain ambiguous.
- Occluded areas remain occluded.
- Darkness is acceptable.
- Do not resolve ambiguity introduced by upscaling.

### Contract 4 — Timing / Gating
- All “what exists” constraints must be applied at **Preview time**.
- Final must not reinterpret structure decided by Preview.
- Anything not constrained in Preview cannot be reliably constrained later.

---

## Architecture Decision: Split Providers by Function

### Preview Provider
- Any image generator capable of twilight transformation
- Prompt-driven
- Still constrained, but allowed limited stylistic latitude

### Final Provider (Separate service/class)
Must be one of:
- Super-resolution / restoration model (preferred)
- Pixel-preserving image-conditioned refinement (acceptable only with very low creativity / denoise)

Must NOT be:
- general image generator
- cinematic enhancement model
- “creative upscaler”
- anything marketed as “adds realism/detail”

---

## UI/Workflow Semantics (locked compatibility)

We keep locked app layout/mental model:
- Selection is asset-based
- MainStage displays a specific version
- Applying a tool creates a new version from the viewed one
- Batch Run Summary tracks multi-asset operations
- generationStatus is the single source of truth for UI pending/failed/completed

Final should integrate as:
- a dedicated action (e.g., “Finalize 4K” / “Final Pass”)
- producing a new version tier: `final`
- ideally from **approved** sources by default

---

## Version Tiering

We use tiers for clarity:
- `preview` (default generated)
- `hq` (optional higher quality generation, still preview class)
- `final` (fidelity pass, boring by design)

Notes:
- Approval is optional for HQ generation (existing rule)
- Strongly recommended: Final defaults to approved sources to reduce risk

---

## Work Plan (Multi-Phase)

### Phase A — Contract doc + decisions (this doc)
Exit Gate:
- Preview vs Final definitions locked
- Non-negotiable contracts approved
- “Final must be boring by design” adopted

### Phase B — Plumbing: Final pipeline (minimal UI)
Tasks:
- Add Final provider integration (separate from Preview provider)
- Create new versions with tier `final`
- Ensure generationStatus drives tile overlays
- Batch Run Summary supports Final runs
Exit Gate:
- Can run Final pass on selected/approved assets
- Final versions appear as new versions without changing selection
- Pending/failed states visible

### Phase C — Guardrails (hard fail if Final becomes creative)
Tasks:
- Final prompt is preservation-only (no stylistic instructions)
- Add validation to block creative language in Final requests
- Ensure Final settings are low/zero creativity where applicable
Exit Gate:
- Final requests cannot include “add”, “invent”, “enhance lighting”, etc
- Final pass remains geometry-locked

### Phase D — Preview prompting upgrades
Tasks:
- Rewrite Preview prompt templates to explicitly enforce:
  - window light-plane rule
  - no inferred fixtures
  - ambiguity permitted
  - “if unsure, do nothing”
- Ensure these rules are present at Preview generation time
Exit Gate:
- Preview outputs stop inventing window interiors and garden lighting in common cases

### Phase E — Tests + QA harness
Tasks:
- Tests for Preview vs Final routing
- Tests for Final guardrail validation
- Tests for tier creation and UI overlays
Exit Gate:
- All tests green
- Regression-resistant split

---

## Windsurf Prompting Style (MANDATORY)

Every Windsurf prompt must include:
- Goal
- Constraints
- Implementation Notes
- Files to Modify / Create (explicit)
- Tests (names + assertions)
- Exit Gate (observable UI + green tests)

No drive-by edits.

---

## Open Questions (to decide before coding Phase B)

1) Final provider choice:
- Candidate: Stability AI (boring upscale/restoration) or similar
- Requirement: image-conditioned, low hallucination, predictable

2) Final trigger policy:
- Approved-only by default? (recommended)
- Allow “Finalize Selected” with warning? (optional)

3) Output resolution targets:
- 2K / 4K / custom?

4) Cost model:
- Preview vs Final cost separation
- Estimate UI hooks (optional)

---

## Notes / Reminder

This is a truth-preserving twilight conversion, not a cinematic reinterpretation.
Light may be adjusted, but no new objects, fixtures, or inferred sources may be introduced.
