import React, { useState, useEffect, useCallback } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import { useModuleStore } from '../../store/useModuleStore'
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  X,
  Zap,
  Bot,
  RefreshCw,
  Square,
  Send,
  ThumbsUp,
  User,
  MessageSquare,
  Maximize2,
  ArrowLeftRight
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

type Step = 'instruction' | 'analyzing' | 'first_image' | 'agent' | 'human_review'
type BatchMode = 'auto' | 'human'

interface HumanChatEntry {
  type: 'attempt' | 'feedback' | 'correction'
  imageSrc?: string
  text?: string
}

interface PerImagePromptState {
  assetId: string
  assetName: string
  prompt: string
  notes?: string
}

interface AgentAssetStatus {
  assetId: string
  status: 'queued' | 'generating' | 'evaluating' | 'refining' | 'done' | 'flagged' | 'error'
  attempt: number
  versionId?: string
  score?: number
  referenceMatch?: number
  issues?: string[]
  error?: string
}

export function BatchFreeformPanel() {
  const { currentJob, selectedAssetIds, assets, setLastAppliedVersionId, setViewedVersionId } = useJobStore()
  const { addToast } = useAppStore()
  const { selectedInjectorIds, selectedGuardrailIds } = useModuleStore()

  const [step, setStep] = useState<Step>('instruction')
  const [batchMode, setBatchMode] = useState<BatchMode>('auto')
  const [instruction, setInstruction] = useState('')
  const [consistencyBrief, setConsistencyBrief] = useState('')
  const [perImagePrompts, setPerImagePrompts] = useState<PerImagePromptState[]>([])

  // ── Style guide (optional, used during analysis) ─────────────
  const [refImagePath, setRefImagePath] = useState<string | null>(null)
  const [refImageSrc, setRefImageSrc] = useState<string | null>(null)
  const [refVisualBrief, setRefVisualBrief] = useState<string | null>(null)
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // ── Anchor — set when first image is approved ─────────────────
  const [anchorImagePath, setAnchorImagePath] = useState<string | null>(null)
  const [anchorThumbnailSrc, setAnchorThumbnailSrc] = useState<string | null>(null)

  // ── Agent state ───────────────────────────────────────────────
  const [batchId, setBatchId] = useState<string | null>(null)
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentAssetStatus>>({})
  const [agentComplete, setAgentComplete] = useState(false)
  const [agentStopping, setAgentStopping] = useState(false)

  // ── Human review / first image shared state ───────────────────
  const [humanAssetIndex, setHumanAssetIndex] = useState(0)
  const [humanCurrentPrompt, setHumanCurrentPrompt] = useState('')
  const [humanVersionId, setHumanVersionId] = useState<string | null>(null)
  const [humanOutputPath, setHumanOutputPath] = useState<string | null>(null)
  const [humanProgress, setHumanProgress] = useState(0)
  const [humanIsGenerating, setHumanIsGenerating] = useState(false)
  const [humanImageSrc, setHumanImageSrc] = useState<string | null>(null)
  const [humanFeedback, setHumanFeedback] = useState('')
  const [humanIsRefining, setHumanIsRefining] = useState(false)
  const [humanChat, setHumanChat] = useState<HumanChatEntry[]>([])
  const [humanApproved, setHumanApproved] = useState<Record<string, string>>({})
  const [humanIsApproving, setHumanIsApproving] = useState(false)

  // ── Compare modal (first image step) ─────────────────────────
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareShowOriginal, setCompareShowOriginal] = useState(false)
  const [compareOriginalSrc, setCompareOriginalSrc] = useState<string | null>(null)
  const [compareOriginalLoading, setCompareOriginalLoading] = useState(false)

  const selectedAssetList = assets.filter(a => selectedAssetIds.has(a.id))
  const jobId = currentJob?.id

  // ── Agent status subscription ─────────────────────────────────
  useEffect(() => {
    if (!batchId) return
    const unsubStatus = window.api.onAgentBatchStatus((data: AgentAssetStatus & { batchId: string }) => {
      if (data.batchId !== batchId) return
      setAgentStatuses(prev => ({ ...prev, [data.assetId]: data }))
      if (data.versionId && (data.status === 'done' || data.status === 'flagged')) {
        setLastAppliedVersionId(data.assetId, data.versionId)
        setViewedVersionId(data.assetId, data.versionId)
      }
    })
    const unsubComplete = window.api.onAgentBatchComplete((data) => {
      if (data.batchId !== batchId) return
      setAgentComplete(true)
      setAgentStopping(false)
      const msg = `Agent done — ${data.done} matched${data.flagged ? `, ${data.flagged} flagged for review` : ''}${data.errors ? `, ${data.errors} errors` : ''}`
      addToast(msg, data.flagged || data.errors ? 'error' : 'success')
    })
    return () => { unsubStatus(); unsubComplete() }
  }, [batchId])

  // ── Human review / first image progress subscription ──────────
  useEffect(() => {
    if (!humanVersionId || !jobId) return
    const unsub = window.api.onVersionProgress(async (data) => {
      if (data.versionId !== humanVersionId) return
      setHumanProgress(data.progress)
      if (data.progress >= 100) {
        try {
          const version = await window.api.invoke('version:get', jobId, humanVersionId)
          if (version?.outputPath) {
            const src = await window.electronAPI.readImageAsDataURL(version.outputPath)
            setHumanImageSrc(src ?? null)
            setHumanOutputPath(version.outputPath)
            setHumanChat(prev => [...prev, { type: 'attempt', imageSrc: src ?? undefined }])
            const assetId = perImagePrompts[humanAssetIndex]?.assetId
            if (assetId) {
              setLastAppliedVersionId(assetId, humanVersionId)
              setViewedVersionId(assetId, humanVersionId)
            }
          }
        } catch {
          addToast('Failed to load generated image', 'error')
        } finally {
          setHumanIsGenerating(false)
          setHumanIsRefining(false)
        }
      }
    })
    return unsub
  }, [humanVersionId, jobId, humanAssetIndex, perImagePrompts])

  // ── Style guide handlers ──────────────────────────────────────

  const applyRefImage = useCallback(async (path: string, src: string | null) => {
    setRefImagePath(path)
    setRefImageSrc(src)
    setRefVisualBrief(null)
    setIsAnalyzingRef(true)
    try {
      const brief = await window.api.invoke('module:freeform:analyzeReferenceImage', path)
      setRefVisualBrief(brief)
    } catch {
      // Non-fatal
    } finally {
      setIsAnalyzingRef(false)
    }
  }, [])

  const handleRefDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    if (!jobId) return
    const appPath = e.dataTransfer.getData('application/x-afterglow-path')
    if (appPath) {
      const src = await window.electronAPI.readImageAsDataURL(appPath)
      await applyRefImage(appPath, src ?? null)
      return
    }
    const file = e.dataTransfer.files[0]
    if (file && (file as any).path && file.type.startsWith('image/')) {
      const src = await window.electronAPI.readImageAsDataURL((file as any).path)
      await applyRefImage((file as any).path, src ?? null)
    }
  }

  const handleRefFilePick = async () => {
    const path = await window.api.invoke('references:selectFile')
    if (!path) return
    const src = await window.electronAPI.readImageAsDataURL(path)
    await applyRefImage(path, src ?? null)
  }

  // ── Compare modal ─────────────────────────────────────────────

  const handleOpenCompare = async () => {
    if (!humanImageSrc) return
    setCompareShowOriginal(false)
    setCompareOpen(true)
    // Load original if not already loaded
    if (!compareOriginalSrc) {
      const firstAsset = assets.find(a => a.id === perImagePrompts[0]?.assetId)
      if (!firstAsset) return
      const srcPath = firstAsset.workingSourcePath ?? firstAsset.originalPath
      setCompareOriginalLoading(true)
      try {
        const src = await window.electronAPI.readImageAsDataURL(srcPath)
        setCompareOriginalSrc(src ?? null)
      } catch {
        // Non-fatal
      } finally {
        setCompareOriginalLoading(false)
      }
    }
  }

  const handleCloseCompare = () => {
    setCompareOpen(false)
    setCompareShowOriginal(false)
  }

  // ── Analyze → go straight to first image ─────────────────────

  const handleAnalyze = async () => {
    if (!jobId || !instruction.trim() || selectedAssetList.length === 0) return
    setStep('analyzing')
    try {
      const result = await window.api.invoke('module:freeform:batchAnalyze', {
        jobId,
        assetIds: selectedAssetList.map(a => a.id),
        instruction: instruction.trim(),
        referenceVisualBrief: refVisualBrief ?? undefined
      })
      const prompts: PerImagePromptState[] = result.perImagePrompts.map(
        (p: { assetId: string; prompt: string; notes?: string }) => {
          const asset = assets.find(a => a.id === p.assetId)
          return { assetId: p.assetId, assetName: asset?.name || p.assetId, prompt: p.prompt, notes: p.notes }
        }
      )
      setConsistencyBrief(result.consistencyBrief)
      setPerImagePrompts(prompts)
      // Jump directly to first image — no anchor selection step
      setStep('first_image')
      setHumanAssetIndex(0)
      setHumanChat([])
      setHumanFeedback('')
      await startGenerate(0, prompts[0].prompt, null, prompts)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Analysis failed', 'error')
      setStep('instruction')
    }
  }

  // ── Core generate helper (anchor optional) ────────────────────

  const startGenerate = async (
    index: number,
    prompt: string,
    anchor: string | null,
    prompts?: PerImagePromptState[]
  ) => {
    if (!jobId) return
    const list = prompts ?? perImagePrompts
    const asset = list[index]
    if (!asset) return
    setHumanCurrentPrompt(prompt)
    setHumanVersionId(null)
    setHumanOutputPath(null)
    setHumanProgress(0)
    setHumanImageSrc(null)
    setHumanIsGenerating(true)
    try {
      const result = await window.api.invoke('module:freeform:humanGenerate', {
        jobId,
        assetId: asset.assetId,
        craftedPrompt: prompt,
        anchorImagePath: anchor ?? undefined,
        injectorIds: Array.from(selectedInjectorIds),
        guardrailIds: Array.from(selectedGuardrailIds)
      })
      setHumanVersionId(result.versionId)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Generation failed', 'error')
      setHumanIsGenerating(false)
    }
  }

  // ── Agent batch for images 2..N ───────────────────────────────

  const startAgentBatch = async (anchor: string) => {
    if (!jobId || perImagePrompts.length <= 1) return
    const remaining = perImagePrompts.slice(1)
    const id = uuidv4()
    setBatchId(id)
    setAgentStatuses({})
    setAgentComplete(false)
    setAgentStopping(false)
    const promptByAssetId: Record<string, string> = {}
    for (const p of remaining) promptByAssetId[p.assetId] = p.prompt
    setStep('agent')
    try {
      await window.api.invoke('module:freeform:runAgentBatch', {
        batchId: id,
        jobId,
        assetIds: remaining.map(p => p.assetId),
        anchorImagePath: anchor,
        promptByAssetId,
        injectorIds: Array.from(selectedInjectorIds),
        guardrailIds: Array.from(selectedGuardrailIds),
        referenceBrief: refVisualBrief ?? undefined
      })
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Agent batch failed to start', 'error')
    }
  }

  const handleStopAgent = async () => {
    if (!batchId) return
    setAgentStopping(true)
    await window.api.invoke('module:freeform:stopAgentBatch', batchId)
  }

  // ── First image: feedback ─────────────────────────────────────

  const handleFirstImageFeedback = async () => {
    if (!jobId || !humanFeedback.trim() || humanIsGenerating || humanIsRefining) return
    const asset = perImagePrompts[0]
    if (!asset) return
    const feedbackText = humanFeedback.trim()
    setHumanFeedback('')
    setHumanIsRefining(true)
    setHumanChat(prev => [...prev, { type: 'feedback', text: feedbackText }])
    try {
      const result = await window.api.invoke('module:freeform:humanRefine', {
        jobId,
        assetId: asset.assetId,
        currentPrompt: humanCurrentPrompt,
        anchorImagePath: undefined,
        userFeedback: feedbackText,
        injectorIds: Array.from(selectedInjectorIds),
        guardrailIds: Array.from(selectedGuardrailIds)
      })
      setHumanCurrentPrompt(result.correctedPrompt)
      setHumanVersionId(result.versionId)
      setHumanOutputPath(null)
      setHumanProgress(0)
      setHumanImageSrc(null)
      if (result.refinedInstruction !== feedbackText) {
        setHumanChat(prev => [...prev, { type: 'correction', text: result.refinedInstruction }])
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Refinement failed', 'error')
      setHumanIsRefining(false)
    }
  }

  // ── First image: approve → becomes anchor → continue batch ───

  const handleFirstImageApprove = async () => {
    if (!jobId || !humanVersionId || !humanOutputPath || humanIsGenerating || humanIsRefining) return
    const asset = perImagePrompts[0]
    if (!asset) return
    setHumanIsApproving(true)
    try {
      await window.api.invoke('module:freeform:humanApprove', { jobId, versionId: humanVersionId })

      const approvedPath = humanOutputPath
      const approvedSrc = humanImageSrc
      setAnchorImagePath(approvedPath)
      setAnchorThumbnailSrc(approvedSrc)

      if (perImagePrompts.length <= 1) {
        addToast('Image approved — batch complete', 'success')
        handleReset()
        return
      }

      if (batchMode === 'auto') {
        await startAgentBatch(approvedPath)
      } else {
        setHumanApproved({ [asset.assetId]: humanVersionId })
        setHumanAssetIndex(1)
        setHumanChat([])
        setHumanFeedback('')
        setHumanVersionId(null)
        setHumanOutputPath(null)
        setHumanProgress(0)
        setHumanImageSrc(null)
        setStep('human_review')
        await startGenerate(1, perImagePrompts[1].prompt, approvedPath)
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Approve failed', 'error')
    } finally {
      setHumanIsApproving(false)
    }
  }

  // ── Human review feedback (images 2..N, with anchor) ─────────

  const handleHumanSendFeedback = async () => {
    if (!jobId || !anchorImagePath || !humanFeedback.trim() || humanIsGenerating || humanIsRefining) return
    const asset = perImagePrompts[humanAssetIndex]
    if (!asset) return
    const feedbackText = humanFeedback.trim()
    setHumanFeedback('')
    setHumanIsRefining(true)
    setHumanChat(prev => [...prev, { type: 'feedback', text: feedbackText }])
    try {
      const result = await window.api.invoke('module:freeform:humanRefine', {
        jobId,
        assetId: asset.assetId,
        currentPrompt: humanCurrentPrompt,
        anchorImagePath,
        userFeedback: feedbackText,
        injectorIds: Array.from(selectedInjectorIds),
        guardrailIds: Array.from(selectedGuardrailIds)
      })
      setHumanCurrentPrompt(result.correctedPrompt)
      setHumanVersionId(result.versionId)
      setHumanOutputPath(null)
      setHumanProgress(0)
      setHumanImageSrc(null)
      if (result.refinedInstruction !== feedbackText) {
        setHumanChat(prev => [...prev, { type: 'correction', text: result.refinedInstruction }])
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Refinement failed', 'error')
      setHumanIsRefining(false)
    }
  }

  // ── Human review approve (images 2..N) ───────────────────────

  const handleHumanApprove = async () => {
    if (!jobId || !humanVersionId || humanIsGenerating || humanIsRefining) return
    const asset = perImagePrompts[humanAssetIndex]
    if (!asset) return
    setHumanIsApproving(true)
    try {
      await window.api.invoke('module:freeform:humanApprove', { jobId, versionId: humanVersionId })
      setHumanApproved(prev => ({ ...prev, [asset.assetId]: humanVersionId! }))
      const nextIndex = humanAssetIndex + 1
      if (nextIndex >= perImagePrompts.length) {
        addToast(`All ${perImagePrompts.length} images approved`, 'success')
        handleReset()
        return
      }
      setHumanAssetIndex(nextIndex)
      setHumanChat([])
      setHumanFeedback('')
      setHumanVersionId(null)
      setHumanOutputPath(null)
      setHumanProgress(0)
      setHumanImageSrc(null)
      await startGenerate(nextIndex, perImagePrompts[nextIndex].prompt, anchorImagePath)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Approve failed', 'error')
    } finally {
      setHumanIsApproving(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────

  const handleReset = () => {
    setStep('instruction')
    setInstruction('')
    setPerImagePrompts([])
    setConsistencyBrief('')
    setRefImagePath(null)
    setRefImageSrc(null)
    setRefVisualBrief(null)
    setIsAnalyzingRef(false)
    setAnchorImagePath(null)
    setAnchorThumbnailSrc(null)
    setBatchId(null)
    setAgentStatuses({})
    setAgentComplete(false)
    setAgentStopping(false)
    setHumanAssetIndex(0)
    setHumanCurrentPrompt('')
    setHumanVersionId(null)
    setHumanOutputPath(null)
    setHumanProgress(0)
    setHumanIsGenerating(false)
    setHumanImageSrc(null)
    setHumanFeedback('')
    setHumanIsRefining(false)
    setHumanChat([])
    setHumanApproved({})
    setHumanIsApproving(false)
    setCompareOpen(false)
    setCompareShowOriginal(false)
    setCompareOriginalSrc(null)
    setCompareOriginalLoading(false)
  }

  // ── Shared image display block ────────────────────────────────

  const renderImageArea = (isLoading: boolean) => (
    <div className="relative rounded-lg overflow-hidden bg-slate-800 min-h-32 flex items-center justify-center">
      {humanImageSrc ? (
        <img src={humanImageSrc} alt="Generated result" className="w-full object-contain max-h-56 rounded-lg" />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="text-xs text-slate-400">
            {humanProgress > 0 ? `Generating… ${humanProgress}%` : 'Starting…'}
          </span>
        </div>
      )}
      {isLoading && humanImageSrc && (
        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-xs text-slate-300">
              {humanIsRefining ? 'Refining…' : `Generating… ${humanProgress}%`}
            </span>
          </div>
        </div>
      )}
      {isLoading && humanProgress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50">
          <div className="h-1 bg-cyan-500 transition-all duration-300" style={{ width: `${humanProgress}%` }} />
        </div>
      )}
    </div>
  )

  const renderChatHistory = () => (
    <>
      {humanChat.filter(e => e.type !== 'attempt').length > 0 && (
        <div className="space-y-1.5 max-h-28 overflow-y-auto">
          {humanChat.map((entry, i) => (
            <div key={i}>
              {entry.type === 'feedback' && (
                <div className="flex items-start gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 bg-slate-800 rounded px-2 py-1">{entry.text}</span>
                </div>
              )}
              {entry.type === 'correction' && (
                <div className="flex items-start gap-2 pl-5">
                  <Bot className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-purple-300/80 italic">{entry.text}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )

  // ── Render: Instruction ───────────────────────────────────────

  if (step === 'instruction') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
          <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <strong className="text-white">{selectedAssetList.length} images selected.</strong>{' '}
            Describe what you want — AI analyzes all images and creates per-image prompts. You review and approve the first result, which becomes the style anchor for the rest.
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">What do you want to do?</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Replace the sky with a twilight blue-hour scene with warm building lighting on all exterior images"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Style Guide <span className="text-slate-500 font-normal">(Optional — used during analysis)</span>
          </label>
          {refImagePath ? (
            <div className="space-y-2">
              <div className="relative">
                {refImageSrc && (
                  <img src={refImageSrc} alt="Style guide" className="w-full h-24 object-cover rounded-lg" />
                )}
                <button
                  onClick={() => { setRefImagePath(null); setRefImageSrc(null); setRefVisualBrief(null) }}
                  className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 hover:bg-red-900/80 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-300" />
                </button>
              </div>
              {isAnalyzingRef ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  Extracting style parameters…
                </div>
              ) : refVisualBrief ? (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 px-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Style parameters extracted — injected into analysis prompts
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                isDraggingOver ? 'border-cyan-500 bg-cyan-900/10' : 'border-slate-600 hover:border-slate-500'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleRefDrop}
              onClick={handleRefFilePick}
            >
              <ImageIcon className="w-4 h-4 text-slate-500 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Drop an image or click to browse</p>
              <p className="text-xs text-slate-600 mt-0.5">Used by AI to guide per-image prompt creation</p>
            </div>
          )}
        </div>

        {/* Mode picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">After first image approved</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setBatchMode('auto')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                batchMode === 'auto'
                  ? 'bg-cyan-900/30 border-cyan-600 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Bot className="w-4 h-4 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium leading-tight">Auto Agent</div>
                <div className="text-xs opacity-70 leading-tight">AI runs remaining images</div>
              </div>
            </button>
            <button
              onClick={() => setBatchMode('human')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                batchMode === 'human'
                  ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium leading-tight">Human Review</div>
                <div className="text-xs opacity-70 leading-tight">You approve each image</div>
              </div>
            </button>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzingRef || !instruction.trim() || selectedAssetList.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Analyze {selectedAssetList.length} images
        </button>
      </div>
    )
  }

  // ── Render: Analyzing ─────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
          <div className="text-sm text-slate-300">
            Analyzing {selectedAssetList.length} images and creating per-image prompts…
          </div>
        </div>
      </div>
    )
  }

  // ── Render: First Image ───────────────────────────────────────

  if (step === 'first_image') {
    const isLoading = humanIsGenerating || humanIsRefining
    const canSend = !!humanFeedback.trim() && !isLoading && !!humanImageSrc
    const canApprove = !!humanImageSrc && !!humanOutputPath && !isLoading && !humanIsApproving
    const remainingCount = perImagePrompts.length - 1

    return (
      <>
        {/* ── Fullscreen compare modal ── */}
        {compareOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/96 flex flex-col"
            onKeyDown={e => { if (e.key === 'Escape') handleCloseCompare() }}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">
                  {compareShowOriginal ? 'Original' : 'Generated'}
                </span>
                <span className="text-xs text-slate-500">{perImagePrompts[0]?.assetName}</span>
              </div>
              <button
                onClick={handleCloseCompare}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image area */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0 relative">
              {compareShowOriginal ? (
                compareOriginalLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    <span className="text-xs text-slate-400">Loading original…</span>
                  </div>
                ) : compareOriginalSrc ? (
                  <img
                    src={compareOriginalSrc}
                    alt="Original"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: 'calc(100vh - 140px)' }}
                  />
                ) : (
                  <span className="text-sm text-slate-500">Original not available</span>
                )
              ) : (
                humanImageSrc && (
                  <img
                    src={humanImageSrc}
                    alt="Generated"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: 'calc(100vh - 140px)' }}
                  />
                )
              )}
            </div>

            {/* Toggle bar */}
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/10 flex-shrink-0">
              <button
                onClick={() => setCompareShowOriginal(false)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !compareShowOriginal
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generated
              </button>
              <button
                onClick={() => {
                  setCompareShowOriginal(true)
                  // Load original lazily if not yet loaded
                  if (!compareOriginalSrc && !compareOriginalLoading) {
                    const firstAsset = assets.find(a => a.id === perImagePrompts[0]?.assetId)
                    if (firstAsset) {
                      const srcPath = firstAsset.workingSourcePath ?? firstAsset.originalPath
                      setCompareOriginalLoading(true)
                      window.electronAPI.readImageAsDataURL(srcPath).then(src => {
                        setCompareOriginalSrc(src ?? null)
                      }).catch(() => {}).finally(() => setCompareOriginalLoading(false))
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  compareShowOriginal
                    ? 'bg-slate-500 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Original
              </button>
            </div>
          </div>
        )}

        {/* ── Panel UI ── */}
        <div className="flex flex-col h-full p-4 gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">Image 1 — Style Anchor</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Approve to set the style for {remainingCount} remaining image{remainingCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Cancel
            </button>
          </div>

          <div className="text-xs text-slate-500 truncate">{perImagePrompts[0]?.assetName}</div>

          {consistencyBrief && (
            <div className="px-2 py-1.5 bg-slate-800/50 rounded text-xs text-slate-400 line-clamp-2">
              <span className="text-slate-500">Brief: </span>{consistencyBrief}
            </div>
          )}

          {/* Image with compare overlay */}
          <div className="relative rounded-lg overflow-hidden bg-slate-800 min-h-32 flex items-center justify-center">
            {humanImageSrc ? (
              <>
                <img
                  src={humanImageSrc}
                  alt="Generated result"
                  className="w-full object-contain max-h-56 rounded-lg cursor-pointer"
                  onClick={handleOpenCompare}
                />
                {/* Compare button overlay */}
                <button
                  onClick={handleOpenCompare}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-medium transition-colors backdrop-blur-sm"
                >
                  <Maximize2 className="w-3 h-3" />
                  Compare
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-400">
                  {humanProgress > 0 ? `Generating… ${humanProgress}%` : 'Starting…'}
                </span>
              </div>
            )}
            {isLoading && humanImageSrc && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="text-xs text-slate-300">
                    {humanIsRefining ? 'Refining…' : `Generating… ${humanProgress}%`}
                  </span>
                </div>
              </div>
            )}
            {isLoading && humanProgress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50">
                <div className="h-1 bg-cyan-500 transition-all duration-300" style={{ width: `${humanProgress}%` }} />
              </div>
            )}
          </div>

          {renderChatHistory()}

          <div className="flex gap-2">
            <input
              type="text"
              value={humanFeedback}
              onChange={e => setHumanFeedback(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) handleFirstImageFeedback() } }}
              placeholder={humanImageSrc ? 'What needs fixing? e.g. "sky too warm"' : 'Waiting for image…'}
              disabled={isLoading || !humanImageSrc}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
            />
            <button
              onClick={handleFirstImageFeedback}
              disabled={!canSend}
              className="p-2 bg-slate-700 hover:bg-cyan-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleFirstImageApprove}
            disabled={!canApprove}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {humanIsApproving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
            ) : (
              <>
                <ThumbsUp className="w-4 h-4" />
                Approve as anchor &amp;{' '}
                {batchMode === 'auto'
                  ? `run ${remainingCount} remaining`
                  : `review ${remainingCount} remaining`}
              </>
            )}
          </button>
        </div>
      </>
    )
  }

  // ── Render: Human Review (images 2..N) ────────────────────────

  if (step === 'human_review') {
    const currentAsset = perImagePrompts[humanAssetIndex]
    const isLoading = humanIsGenerating || humanIsRefining
    const approvedCount = Object.keys(humanApproved).length
    const canSend = !!humanFeedback.trim() && !isLoading && !!humanImageSrc
    const canApprove = !!humanImageSrc && !isLoading && !humanIsApproving

    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">
              Image {humanAssetIndex + 1} of {perImagePrompts.length}
            </span>
            {approvedCount > 0 && (
              <span className="text-xs text-emerald-400">({approvedCount} approved)</span>
            )}
          </div>
          <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Cancel
          </button>
        </div>

        <div className="text-xs text-slate-500 truncate">{currentAsset?.assetName}</div>

        {anchorThumbnailSrc && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded">
            <img src={anchorThumbnailSrc} alt="Anchor" className="w-8 h-6 object-cover rounded ring-1 ring-cyan-500 flex-shrink-0" />
            <span className="text-xs text-slate-500">Matching anchor style</span>
          </div>
        )}

        {renderImageArea(isLoading)}
        {renderChatHistory()}

        <div className="flex gap-2">
          <input
            type="text"
            value={humanFeedback}
            onChange={e => setHumanFeedback(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) handleHumanSendFeedback() } }}
            placeholder={humanImageSrc ? 'What needs fixing? e.g. "sky too warm"' : 'Waiting for image…'}
            disabled={isLoading || !humanImageSrc}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleHumanSendFeedback}
            disabled={!canSend}
            className="p-2 bg-slate-700 hover:bg-purple-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleHumanApprove}
          disabled={!canApprove}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {humanIsApproving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</>
          ) : (
            <><ThumbsUp className="w-4 h-4" /> Approve &amp; {humanAssetIndex + 1 < perImagePrompts.length ? `next (${humanAssetIndex + 2}/${perImagePrompts.length})` : 'finish'}</>
          )}
        </button>
      </div>
    )
  }

  // ── Render: Agent (images 2..N running) ───────────────────────

  const agentPrompts = perImagePrompts.slice(1)
  const statusList = agentPrompts.map(p => agentStatuses[p.assetId] ?? { assetId: p.assetId, status: 'queued' as const, attempt: 0 })
  const doneCount = statusList.filter(s => s.status === 'done').length
  const flaggedCount = statusList.filter(s => s.status === 'flagged').length
  const errorCount = statusList.filter(s => s.status === 'error').length
  const totalCount = agentPrompts.length

  const statusIcon = (s: AgentAssetStatus) => {
    switch (s.status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      case 'flagged': return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      case 'error': return <X className="w-4 h-4 text-red-400 flex-shrink-0" />
      case 'generating': return <Zap className="w-4 h-4 text-cyan-400 animate-pulse flex-shrink-0" />
      case 'evaluating': return <Sparkles className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
      case 'refining': return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
      default: return <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
    }
  }

  const statusLabel = (s: AgentAssetStatus) => {
    switch (s.status) {
      case 'done': return <span className="text-emerald-400">{s.score?.toFixed(1)} ✓</span>
      case 'flagged': return <span className="text-amber-400">review • {s.score?.toFixed(1)}</span>
      case 'error': return <span className="text-red-400 truncate max-w-24">{s.error?.slice(0, 24)}</span>
      case 'generating': return <span className="text-cyan-400">generating…</span>
      case 'evaluating': return <span className="text-purple-400">evaluating…</span>
      case 'refining': return <span className="text-amber-400">refining #{s.attempt}</span>
      default: return <span className="text-slate-600">queued</span>
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className={`w-5 h-5 ${agentComplete ? 'text-slate-400' : 'text-cyan-400 animate-pulse'}`} />
          <div className="text-sm">
            {agentComplete ? (
              <span className="text-slate-300 font-medium">
                Done — {doneCount} matched{flaggedCount > 0 ? `, ${flaggedCount} flagged` : ''}{errorCount > 0 ? `, ${errorCount} errors` : ''}
              </span>
            ) : (
              <span className="text-white font-medium">
                Agent running — {doneCount + flaggedCount + errorCount}/{totalCount}
                {agentStopping ? ' (stopping…)' : ''}
              </span>
            )}
          </div>
        </div>
        {!agentComplete && (
          <button
            onClick={handleStopAgent}
            disabled={agentStopping}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-red-900/50 text-slate-300 rounded transition-colors"
          >
            <Square className="w-3 h-3" />
            {agentStopping ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>

      {/* Anchor — the approved first image */}
      {anchorThumbnailSrc && (
        <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
          <img src={anchorThumbnailSrc} alt="Anchor" className="w-12 h-8 object-cover rounded ring-1 ring-cyan-500" />
          <div className="text-xs text-slate-400">
            <span className="text-cyan-400 font-medium">Style anchor</span> — your approved first image
          </div>
        </div>
      )}

      {/* Image 1 — anchor row */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-900/10 border border-emerald-800/30">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span className="flex-1 text-slate-300 truncate text-xs">{perImagePrompts[0]?.assetName}</span>
        <span className="text-xs text-emerald-400">anchor ✓</span>
      </div>

      {/* Images 2..N status */}
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {agentPrompts.map((item) => {
          const s = agentStatuses[item.assetId] ?? { assetId: item.assetId, status: 'queued' as const, attempt: 0 }
          return (
            <div
              key={item.assetId}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                s.status === 'done' ? 'bg-emerald-900/10 border border-emerald-800/30' :
                s.status === 'flagged' ? 'bg-amber-900/10 border border-amber-800/30' :
                s.status === 'error' ? 'bg-red-900/10 border border-red-800/30' :
                s.status === 'queued' ? 'bg-slate-800/30' :
                'bg-slate-800/60 border border-slate-700/50'
              }`}
            >
              {statusIcon(s)}
              <span className="flex-1 text-slate-300 truncate text-xs">{item.assetName}</span>
              <span className="text-xs">{statusLabel(s)}</span>
            </div>
          )
        })}
      </div>

      {agentComplete && (
        <button
          onClick={handleReset}
          className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
        >
          Start New Batch
        </button>
      )}
    </div>
  )
}
