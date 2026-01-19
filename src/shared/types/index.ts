// Phase 2 Core Types
// Central type definitions shared between main and renderer processes

// ─────────────────────────────────────────────────────────────
// ENUMS & LITERALS
// ─────────────────────────────────────────────────────────────

export type ModuleType = 'twilight' | 'clean' | 'stage' | 'renovate'

export type VersionStatus =
  | 'generating'
  | 'preview_ready'
  | 'approved'
  | 'hq_generating'
  | 'hq_ready'
  | 'native_4k_generating'
  | 'native_4k_ready'
  | 'final_generating'
  | 'final_ready'
  | 'error'

export type QualityTier = 'preview' | 'hq_preview' | 'native_4k' | 'final'

export type GenerationStatus = 'idle' | 'pending' | 'completed' | 'failed'

// ─────────────────────────────────────────────────────────────
// JOB
// ─────────────────────────────────────────────────────────────

export interface JobMetadata {
  address?: string
  agent?: string
  notes?: string
}

export interface Job {
  id: string
  name: string
  metadata: JobMetadata
  sceneIds: string[]
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────────────

export interface Scene {
  id: string
  jobId: string
  name: string
  assetIds: string[]
  masterAssetId?: string
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// ASSET
// ─────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  jobId: string
  sceneId?: string  // Optional - assets can exist without scene assignment
  name: string
  originalPath: string
  originalThumbnailPath?: string
  versionIds: string[]
  createdAt: string
  updatedAt: string
  
  // Filename sanitization (privacy protection)
  displayName?: string        // Original filename for UI display
  originalName?: string        // Original filename for reference (never sent to providers)
  sanitizedName?: string       // Safe filename used for storage and API calls
  legacySanitized?: boolean    // True if sanitizedName was set from existing filename during migration
  
  // Working source override - allows using a generated output (e.g., 4K declutter) as the new base
  // When set, subsequent modules will use this path instead of originalPath
  workingSourcePath?: string
  workingSourceVersionId?: string  // The version ID that produced the working source
}

// ─────────────────────────────────────────────────────────────
// VERSION (immutable output)
// ─────────────────────────────────────────────────────────────

export interface VersionRecipe {
  basePrompt: string
  injectors: string[]
  guardrails: string[]
  settings: Record<string, unknown>
}

export interface Version {
  id: string
  assetId: string
  jobId: string

  module: ModuleType
  qualityTier: QualityTier
  status: VersionStatus

  outputPath?: string
  thumbnailPath?: string
  error?: string

  generationStatus?: GenerationStatus
  generationError?: string
  startedAt?: number
  completedAt?: number

  recipe: VersionRecipe
  sourceVersionIds: string[]
  parentVersionId?: string

  seed?: number | null
  model?: string

  createdAt: string
  lifecycleStatus?: 'draft' | 'approved'
  approvedAt?: number
  approvedBy?: string
  finalGeneratedAt?: string
}

// ─────────────────────────────────────────────────────────────
// RUN (generation attempt - for history/analytics)
// ─────────────────────────────────────────────────────────────

export interface Run {
  id: string
  jobId: string
  module: ModuleType
  qualityTier: QualityTier
  versionIds: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
}

// ─────────────────────────────────────────────────────────────
// INJECTORS (data-driven, extensible)
// ─────────────────────────────────────────────────────────────

export interface Injector {
  id: string
  module: ModuleType
  label: string
  promptFragment: string
  category?: string
}

// ─────────────────────────────────────────────────────────────
// FURNITURE SPEC (multi-angle staging)
// ─────────────────────────────────────────────────────────────

export interface FurnitureSpec {
  id: string
  sceneId: string
  masterVersionId: string
  description: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// DELIVERABLES
// ─────────────────────────────────────────────────────────────

export interface Deliverable {
  id: string
  jobId: string
  versionId: string
  exportedAt: string
  exportPath: string
}
