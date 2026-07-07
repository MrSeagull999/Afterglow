# Afterglow Inspector Flow – Phased Build Plan

**Purpose**
This document defines a structured, gated phase process to rebuild Afterglow’s generation UI into a reliable, inspector‑driven workflow. Each phase is designed to be executed in a *separate chat/prompt*, with clear success criteria and test requirements.

This file is the **single reference source** for scope, order, and acceptance.

---

## Core Principles (Do Not Violate)

1. **UI truth beats backend intent**  
   If a user cannot see it in the UI, it does not exist.

2. **Preview = Payload**  
   The prompt shown must be the exact prompt sent.

3. **Selection drives behavior**  
   Single‑image and batch flows are determined by selection, not mode toggles.

4. **Each phase has a gate**  
   A phase is not complete until its tests pass and output is shown.

5. **No silent completion**  
   Each phase must be verifiable visually and via tests.

---

## Target End State (North Star)

- Left: Library / asset list
- Center: Grid + MainStage preview (single) or batch banner (multi)
- Right: Inspector panel containing:
  - Module controls
  - Extra Instructions (custom prompt)
  - Final Prompt (Live)
  - Provider + model + prompt hash
  - Apply button reflecting selection count

Inspector is present in **all generation modules**:
- Staging
- Clean Slate
- Renovate
- Twilight

---

# Phase Breakdown

---

## Phase 0 — Baseline & Safety Net

**Goal**  
Freeze current behavior and prevent regressions.

**Work**
- Create feature branch (e.g. `inspector-flow`)
- Identify:
  - Module entry points
  - Selection logic
  - Generation service
  - Provider selection logic
- Establish current test baseline

**Tests**
- Run existing test suite
- If no tests exist, add a minimal sanity test

**Gate (Required)**
- Tests run via terminal
- Terminal output pasted into chat

---

## Phase 1 — Selection Model + Inspector Skeleton

**Goal**  
Prove the Inspector can render reliably before wiring logic.

**Work**
- Implement or formalize shared selection store:
  - select
  - multi‑select
  - toggle
  - clear
- Create Inspector shell rendered on the **right side** for all generation modules
- Inspector must show obvious placeholders:
  - “INSPECTOR ACTIVE” label
  - Dummy Extra Instructions textarea
  - Dummy Final Prompt preview box

**Tests**
- Unit tests for selection store
- Component test:
  - Inspector renders
  - Switches between single and batch mode

**Gate**
- Inspector visible in all target modules
- Tests run + output shown

---

## Phase 2 — Prompt Truth Surface (Preview + Custom Instructions)

**Goal**  
Make the prompt visible, live, and trustworthy.

**Work**
- Implement `PromptAssembler` (single source of truth)
- Inputs:
  - Module preset template
  - Options / guardrails
  - Style modifiers
  - Extra Instructions
- Outputs:
  - `finalPrompt`
  - `promptHash`
- Wire Inspector:
  - Extra Instructions textarea (editable)
  - Final Prompt (Live) preview (monospace, read‑only)
  - Footer shows preset id/name + provider + model + promptHash
- Preview and generation payload must use the same assembler call

**Tests**
- Unit:
  - Prompt section ordering
  - Extra Instructions included last
  - Hash changes when inputs change
- Component:
  - Typing updates preview instantly

**Gate**
- User can see exact prompt before generation
- Tests run + output shown

---

## Phase 3 — Provider Routing Verification

**Goal**  
Eliminate ambiguity about where requests go.

**Work**
- Implement `getActiveProvider()` as single source of truth
- Ensure OpenRouter and Gemini are mutually exclusive
- Log per request:
  - provider
  - model
  - endpoint
  - requestId
  - promptHash
- Inspector must echo resolved provider + model

**Tests**
- Unit:
  - Provider selection logic
- Integration‑style:
  - Mock request
  - Assert OpenRouter base URL + headers when selected

**Gate**
- Provider visible in Inspector
- Tests run + output shown

---

## Phase 4 — Job Progress in Module View

**Goal**  
Same progress truth everywhere.

**Work**
- Unify job progress store
- Module grid tiles show:
  - queued
  - processing
  - complete
  - error
- Progress persists on reload

**Tests**
- Unit:
  - Job state transitions
- Component:
  - Tile renders correct overlay

**Gate**
- Progress visible without leaving module
- Tests run + output shown

---

## Phase 5 — Batch Mode Apply

**Goal**  
Batch behavior is explicit and safe.

**Work**
- Inspector shows “Batch Mode: N selected”
- Apply triggers generation for all selected
- Same prompt/settings applied
- Prompt hash stored per job

**Tests**
- Unit:
  - Batch request builder
- Integration‑style:
  - Generation service called N times

**Gate**
- Batch works deterministically
- Tests run + output shown

---

## Phase 6 — Cleanup & Lock‑In

**Goal**  
Stabilize and prevent regressions.

**Work**
- Remove unused left‑panel wiring
- Ensure Inspector is the only control surface
- Add fast “smoke test” script

**Tests**
- Full suite

**Gate**
- All tests green
- Terminal output shown

---

## How to Use This Document

- Each phase = **new chat + new prompt**
- Reference this file at the top of each prompt
- Do not advance phases without meeting the gate
- If a phase fails, fix before proceeding

This document defines *done*.

