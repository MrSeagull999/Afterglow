import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cloud,
  Loader2,
  X,
  FolderOpen,
  RefreshCw,
  ImagePlus,
  Send,
  Sliders,
  MessageSquare,
  Trash2,
  Crosshair
} from 'lucide-react'
import { useJobStore } from '../../store/useJobStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferenceImage {
  dataUrl: string
  base64: string
  mimeType: string
  name: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SKY_PRESETS = [
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    promptModifier: 'Golden hour sky, warm orange and amber tones, the sun low on the horizon casting long rays of light, soft wispy clouds catching the warm light, rich gradient from deep blue at zenith to warm gold at horizon.'
  },
  {
    id: 'blue_hour',
    label: 'Blue Hour',
    promptModifier: 'Blue hour sky immediately after sunset, deep cobalt and indigo tones, residual warm glow at the horizon fading into deep blue overhead, possibly a single bright planet or early star visible, calm and serene atmosphere.'
  },
  {
    id: 'dramatic_storm',
    label: 'Dramatic Storm',
    promptModifier: 'Dramatic stormy sky, towering cumulonimbus clouds in dark grey and charcoal, visible light breaking through gaps in the clouds creating volumetric rays, moody and powerful atmosphere with visible texture and depth in the clouds.'
  },
  {
    id: 'bright_midday',
    label: 'Bright Midday',
    promptModifier: 'Bright midday sky, clean bright blue, small scattered white cumulus clouds with crisp edges, strong overhead light, clear and vibrant colours, summery and energetic mood.'
  },
  {
    id: 'overcast',
    label: 'Overcast',
    promptModifier: 'Overcast sky, soft even layer of high grey cloud, diffused light with no harsh shadows, subtle variation in cloud density creating gentle tonal gradients, calm and neutral mood suitable for clean compositing.'
  },
  {
    id: 'sunrise',
    label: 'Sunrise',
    promptModifier: 'Sunrise sky, the sun just cresting the horizon, gradient from deep rose and magenta at the horizon through coral and peach to pale blue overhead, streaks of high cirrus cloud catching the first light, fresh and hopeful mood.'
  }
]

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '4:3',  value: '4:3' },
  { label: '3:2',  value: '3:2' },
  { label: '1:1',  value: '1:1' }
]

const BASE_PROMPT = 'Photorealistic full-frame sky photograph. The entire image is sky — no ground, no horizon line with land or buildings, no structures, no terrain. Fill the complete frame edge-to-edge with sky. High resolution, sharp detail, suitable for professional Photoshop compositing. The sky must look like a genuine photograph taken with a professional camera.'

// ─── Component ────────────────────────────────────────────────────────────────

export function SkyPanel() {
  // Tab
  const [tab, setTab] = useState<'quick' | 'chat'>('quick')

  // Current job context (for "Use current image" feature)
  const { currentAsset, versions, selectedVersionId } = useJobStore()
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false)

  // Shared state (reference image, aspect ratio, result)
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Quick tab state
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [customDescription, setCustomDescription] = useState('')

  // Chat tab state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatPrompt, setChatPrompt] = useState<string | null>(null)  // prompt crafted by AI

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Chat session init ──────────────────────────────────────────────────────

  useEffect(() => {
    const startSession = async () => {
      try {
        const session = await window.api.invoke('sky:chat:start')
        setSessionId(session.id)
      } catch {
        setChatError('Failed to start chat session')
      }
    }
    startSession()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // ── Image handling ─────────────────────────────────────────────────────────

  const processImageFile = useCallback((file: File): void => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return
      const commaIdx = dataUrl.indexOf(',')
      const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl
      setReferenceImage({ dataUrl, base64, mimeType: file.type, name: file.name })
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) processImageFile(files[0])
  }, [processImageFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) processImageFile(files[0])
    e.target.value = ''
  }, [processImageFile])

  // ── Use current image ──────────────────────────────────────────────────────

  const currentImagePath = (() => {
    if (!currentAsset) return null
    const assetVersions = versions.filter(v => v.assetId === currentAsset.id)
    // Prefer selected version, then latest with output
    const selected = selectedVersionId ? assetVersions.find(v => v.id === selectedVersionId) : null
    const version = selected || assetVersions.find(v => v.outputPath) || null
    return version?.outputPath || currentAsset.originalPath || null
  })()

  const handleUseCurrentImage = async () => {
    if (!currentImagePath) return
    setIsLoadingCurrent(true)
    try {
      const result = await window.api.invoke('file:readAsBase64', currentImagePath)
      if (!result.success) return
      const dataUrl = `data:${result.mimeType};base64,${result.base64}`
      const name = currentImagePath.split('/').pop() || 'current-image'
      setReferenceImage({ dataUrl, base64: result.base64, mimeType: result.mimeType, name })
    } catch {
      // silently ignore
    } finally {
      setIsLoadingCurrent(false)
    }
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  function buildQuickPrompt(): string {
    const parts: string[] = [BASE_PROMPT]
    const preset = SKY_PRESETS.find(p => p.id === selectedPreset)
    if (preset) parts.push(preset.promptModifier)
    if (customDescription.trim()) parts.push(customDescription.trim())
    return parts.join(' ')
  }

  const handleGenerate = async (promptOverride?: string) => {
    setError(null)
    setResultImage(null)
    setSavedPath(null)
    setIsGenerating(true)

    const prompt = promptOverride ?? buildQuickPrompt()

    try {
      const result = await window.api.invoke('module:sky:generate', {
        prompt,
        aspectRatio,
        referenceImage: referenceImage
          ? { base64: referenceImage.base64, mimeType: referenceImage.mimeType, name: referenceImage.name }
          : undefined
      })

      if (!result.success) {
        setError(result.error || 'Generation failed')
        return
      }

      setResultImage(`data:${result.mimeType || 'image/png'};base64,${result.imageData}`)
      setSavedPath(result.outputPath || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleShowInFinder = () => {
    if (savedPath) window.api.invoke('file:showInFinder', savedPath)
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  const handleSendChat = async () => {
    if (!chatInput.trim() || !sessionId || isSending) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatError(null)
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsSending(true)

    try {
      const result = await window.api.invoke('sky:chat:sendMessage', sessionId, msg)
      if (!result.success) {
        setChatError(result.error || 'Failed to get response')
        return
      }
      setMessages(prev => [...prev, { role: 'assistant', content: result.message || '' }])
      if (result.suggestedPrompt) {
        setChatPrompt(result.suggestedPrompt)
      }
    } catch {
      setChatError('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleClearChat = async () => {
    if (sessionId) await window.api.invoke('sky:chat:clear', sessionId)
    const newSession = await window.api.invoke('sky:chat:start')
    setSessionId(newSession.id)
    setMessages([])
    setChatPrompt(null)
    setChatError(null)
  }

  // Strip [PROMPT_START]...[PROMPT_END] tags from displayed message
  function formatAssistantMessage(content: string): string {
    return content
      .replace(/\[PROMPT_START\][\s\S]*?\[PROMPT_END\]/g, '')
      .trim()
  }

  // ── Shared result block ────────────────────────────────────────────────────

  const ResultBlock = () => (
    <div className="flex flex-col gap-2 mt-1">
      <img src={resultImage!} alt="Generated sky" className="w-full rounded-lg border border-slate-700 object-cover" />
      <div className="flex gap-2">
        <button
          onClick={handleShowInFinder}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-medium transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Show in Finder
        </button>
        <button
          onClick={() => handleGenerate(tab === 'chat' && chatPrompt ? `${BASE_PROMPT} ${chatPrompt}` : undefined)}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-xs text-slate-200 font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>
      {savedPath && (
        <p className="text-[10px] text-slate-600 truncate" title={savedPath}>
          Saved to: {savedPath}
        </p>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-lg bg-sky-900/20 border border-sky-700/40 px-3 py-2.5">
        <Cloud className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
        <p className="text-xs text-sky-300/80 leading-relaxed">
          Generate a photorealistic full-frame sky for Photoshop compositing.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg bg-slate-800 p-0.5 gap-0.5">
        <button
          onClick={() => setTab('quick')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'quick' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Quick
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'chat' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>
      </div>

      {/* Reference image drop zone — shared across both tabs */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Reference Image (optional)</label>
          {currentImagePath && !referenceImage && (
            <button
              onClick={handleUseCurrentImage}
              disabled={isLoadingCurrent}
              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
            >
              {isLoadingCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
              Use current image
            </button>
          )}
        </div>
        {referenceImage ? (
          <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-slate-800">
            <img src={referenceImage.dataUrl} alt={referenceImage.name} className="w-full h-28 object-cover" />
            <button
              onClick={() => setReferenceImage(null)}
              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="px-2 py-1 bg-slate-900/80 text-xs text-slate-400 truncate">{referenceImage.name}</div>
          </div>
        ) : (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              isDragging
                ? 'border-sky-400 bg-sky-900/20'
                : 'border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/60'
            }`}
          >
            <ImagePlus className="w-5 h-5 text-slate-500" />
            <p className="text-xs text-slate-500 text-center">
              Drop an image or <span className="text-sky-400">click to browse</span>
            </p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
      </div>

      {/* Aspect ratio — shared */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Aspect Ratio</label>
        <div className="flex gap-1.5">
          {ASPECT_RATIOS.map(ratio => (
            <button
              key={ratio.value}
              onClick={() => setAspectRatio(ratio.value)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                aspectRatio === ratio.value
                  ? 'bg-slate-700 border-slate-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick tab ── */}
      {tab === 'quick' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {SKY_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(prev => prev === preset.id ? '' : preset.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors text-left ${
                    selectedPreset === preset.id
                      ? 'bg-sky-700 border-sky-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Additional Details <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={customDescription}
              onChange={e => setCustomDescription(e.target.value)}
              rows={3}
              placeholder="Describe cloud types, colour temperature, mood, time of day…"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
            ) : (
              <><Cloud className="w-4 h-4" />Generate Sky</>
            )}
          </button>
        </>
      )}

      {/* ── Chat tab ── */}
      {tab === 'chat' && (
        <>
          {/* Message thread */}
          <div className="flex flex-col gap-2 min-h-[120px] max-h-64 overflow-y-auto scrollbar-thin">
            {messages.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                Describe the sky you want and I'll craft the perfect prompt.
              </p>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              const displayContent = isUser ? msg.content : formatAssistantMessage(msg.content)
              if (!displayContent) return null
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-sky-700/60 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}>
                    {displayContent}
                  </div>
                </div>
              )
            })}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-slate-700 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Crafted prompt badge */}
          {chatPrompt && (
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/40 px-3 py-2">
              <p className="text-[10px] font-semibold text-emerald-400 mb-1">Prompt ready</p>
              <p className="text-xs text-emerald-200/80 leading-relaxed line-clamp-3">{chatPrompt}</p>
            </div>
          )}

          {chatError && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2 text-xs text-red-300">
              {chatError}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
              placeholder="Describe the sky you want…"
              disabled={isSending}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || isSending}
              className="px-3 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Generate + clear row */}
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerate(chatPrompt ? `${BASE_PROMPT} ${chatPrompt}` : buildQuickPrompt())}
              disabled={isGenerating || (!chatPrompt && messages.length === 0)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
              ) : (
                <><Cloud className="w-4 h-4" />Generate Sky</>
              )}
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {resultImage && <ResultBlock />}

    </div>
  )
}
