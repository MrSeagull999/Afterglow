import React from 'react'
import { CustomInstructions } from './CustomInstructions'
import { PromptPreview } from './PromptPreview'
import type { ModuleType } from '../../../shared/types'

interface GenerationControlFooterProps {
  module: ModuleType
}

/**
 * GenerationControlFooter - MANDATORY component for all generation modules
 * 
 * This component MUST be rendered in every module's left panel that performs generation.
 * It provides:
 * 1. CustomInstructions - User-editable extra instructions (highest priority)
 * 2. PromptPreview - Live preview of the exact prompt that will be sent
 * 
 * The prompt preview shows:
 * - The exact final prompt text
 * - Provider (Gemini or OpenRouter)
 * - Model name
 * - Prompt hash for verification
 * 
 * NO MODULE MAY BYPASS THIS COMPONENT.
 */
export function GenerationControlFooter({ module }: GenerationControlFooterProps) {
  console.log(`[GenerationControlFooter] Rendering for module: ${module}`)
  
  return (
    <div className="space-y-6 border-t-4 border-amber-500 pt-6 mt-6 bg-slate-800/30">
      {/* DEBUG: Visible marker */}
      <div className="text-xs text-amber-400 font-mono">
        ⚠️ GENERATION CONTROL FOOTER - Module: {module}
      </div>
      
      {/* Custom Instructions - Always visible, always editable */}
      <CustomInstructions module={module} />
      
      {/* Live Prompt Preview - Always visible, shows exact payload */}
      <PromptPreview module={module} />
    </div>
  )
}
