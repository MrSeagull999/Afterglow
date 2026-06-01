import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Wand2,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  Send,
  ImagePlus,
  X,
  CheckCircle2,
  Trash2,
  Info,
  MessageSquare
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingImage {
  dataUrl: string
  base64: string
  mimeType: string
  name: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: PendingImage[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { label: '16:9  Landscape', value: '16:9' },
  { label: '9:16  Portrait', value: '9:16' },
  { label: '1:1   Square', value: '1:1' },
  { label: '4:3   Standard', value: '4:3' },
  { label: '3:2   Classic', value: '3:2' },
  { label: '3:4   Portrait', value: '3:4' },
  { label: '21:9  Ultrawide', value: '21:9' }
]

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageGenPanel() {
  // Chat state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null)

  // All reference images accumulated across the session (for generation)
  const [allRefImages, setAllRefImages] = useState<PendingImage[]>([])

  // Prompt + generation state
  const [craftedPrompt, setCraftedPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  // ── Init chat session ──────────────────────────────────────────────────────

  useEffect(() => {
    const startSession = async () => {
      try {
        const session = await window.api.invoke('imagegen:chat:start')
        setSessionId(session.id)
      } catch (err) {
        setChatError('Failed to start chat session')
      }
    }
    startSession()
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // ── Image handling ─────────────────────────────────────────────────────────

  const processImageFile = useCallback((file: File): Promise<void> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) { resolve(); return }

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) { resolve(); return }

        const commaIdx = dataUrl.indexOf(',')
        const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl

        setPendingImages(prev => [...prev, {
          dataUrl, base64, mimeType: file.type, name: file.name
        }])
        resolve()
      }
      reader.readAsDataURL(file)
    })
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    for (const file of files) await processImageFile(file)
  }, [processImageFile])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
    for (const file of files) await processImageFile(file)
    e.target.value = ''
  }, [processImageFile])

  // ── Chat ───────────────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!userInput.trim() || !sessionId || isSending) return

    const message = userInput.trim()
    const attached = [...pendingImages]
    setUserInput('')
    setPendingImages([])
    setIsSending(true)
    setChatError(null)

    // Optimistic user message
    setMessages(prev => [...prev, { role: 'user', content: message, images: attached.length > 0 ? attached : undefined }])

    // Accumulate all ref images for generation later
    if (attached.length > 0) {
      setAllRefImages(prev => [...prev, ...attached])
    }

    try {
      const attachedForApi = attached.map(img => ({
        base64: img.base64,
        mimeType: img.mimeType,
        name: img.name
      }))

      const res = await window.api.invoke(
        'imagegen:chat:sendMessage',
        sessionId,
        message,
        attachedForApi.length > 0 ? attachedForApi : undefined
      )

      if (!res.success) throw new Error(res.error || 'Failed')

      setMessages(prev => [...prev, { role: 'assistant', content: res.message || '' }])

      if (res.suggestedPrompt) {
        setSuggestedPrompt(res.suggestedPrompt)
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleAcceptPrompt = () => {
    if (suggestedPrompt) {
      setCraftedPrompt(suggestedPrompt)
    }
  }

  const handleClearChat = async () => {
    if (sessionId) {
      await window.api.invoke('imagegen:chat:clear', sessionId)
    }
    // Start fresh session
    try {
      const session = await window.api.invoke('imagegen:chat:start')
      setSessionId(session.id)
    } catch {}
    setMessages([])
    setSuggestedPrompt(null)
    setCraftedPrompt('')
    setPendingImages([])
    setAllRefImages([])
    setChatError(null)
    setResultImage(null)
    setSavedPath(null)
    setGenError(null)
  }

  // ── Generation ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!craftedPrompt.trim() || isGenerating) return

    setIsGenerating(true)
    setGenError(null)
    setResultImage(null)
    setSavedPath(null)

    try {
      // Pull the latest reference images from the session
      const refImages = sessionId
        ? await window.api.invoke('imagegen:chat:getReferenceImages', sessionId)
        : []

      const result = await window.api.invoke('module:imagegen:generate', {
        prompt: craftedPrompt.trim(),
        aspectRatio,
        referenceImages: refImages
      })

      if (result.success && result.imageData) {
        setResultImage(`data:${result.mimeType || 'image/png'};base64,${result.imageData}`)
        setSavedPath(result.outputPath || null)
      } else {
        setGenError(result.error || 'Generation failed — check your API key in Settings.')
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReveal = () => {
    if (savedPath) window.api.invoke('shell:showInFinder', savedPath)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-3 gap-3">

      {/* Info banner */}
      <div className="flex items-start gap-2 p-2.5 bg-violet-900/20 border border-violet-700/40 rounded-lg">
        <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          Drop reference photos into the chat — a person, a bag, a room — then describe what to create. The AI will help craft your prompt.
        </p>
      </div>

      {/* ── Chat Area ── */}
      <div
        ref={chatAreaRef}
        className={`relative bg-slate-800 rounded-lg overflow-hidden transition-all ${
          isDragging ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 rounded-lg pointer-events-none">
            <ImagePlus className="w-8 h-8 text-violet-400 mb-2" />
            <div className="text-sm font-medium text-violet-300">Drop as reference</div>
            <div className="text-xs text-slate-400 mt-0.5">Attached to your next message</div>
          </div>
        )}

        {/* Messages */}
        <div className="h-56 overflow-y-auto p-3 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-6">
              <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <div>Drop reference images and describe what you want</div>
              <div className="text-xs mt-1 text-slate-600">e.g. "take the person from image 1 and add the bag from image 2"</div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 space-y-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-700 text-slate-200'
              }`}>
                {/* Attached images */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.images.map((img, i) => (
                      <div key={i} className="relative group" title={img.name}>
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="h-14 w-14 object-cover rounded border border-white/20"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded-b truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {img.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-slate-700 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}

          {chatError && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-2 text-xs text-red-300">
              {chatError}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending images row */}
        {pendingImages.length > 0 && (
          <div className="border-t border-slate-700 px-3 pt-2 pb-1 flex gap-2 flex-wrap items-center">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group flex-shrink-0">
                <img src={img.dataUrl} alt={img.name} className="h-12 w-12 object-cover rounded border border-slate-600" />
                <button
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900"
                >
                  <X className="w-2.5 h-2.5 text-slate-300" />
                </button>
              </div>
            ))}
            <span className="text-xs text-slate-500">Attaches to next message</span>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-slate-700 p-2">
          <div className="flex gap-2 items-end">
            {/* File input button */}
            <label className="flex-shrink-0 cursor-pointer p-2 rounded-lg text-slate-400 hover:text-violet-300 hover:bg-slate-700 transition-colors" title="Attach image">
              <ImagePlus className="w-4 h-4" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
            </label>

            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pendingImages.length > 0
                  ? `Describe what you want (${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''} attached)…`
                  : 'Describe what you want, or drop reference images…'
              }
              disabled={isSending || !sessionId}
              rows={2}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
            />

            <button
              onClick={handleSendMessage}
              disabled={isSending || !userInput.trim() || !sessionId}
              className="flex-shrink-0 p-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Clear chat */}
      {messages.length > 0 && (
        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors self-end"
        >
          <Trash2 className="w-3 h-3" />
          Clear chat &amp; start over
        </button>
      )}

      {/* ── Suggested Prompt ── */}
      {suggestedPrompt && (
        <div className="bg-emerald-900/20 border border-emerald-700/60 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-medium text-emerald-300">Suggested Prompt</span>
            </div>
            <button
              onClick={handleAcceptPrompt}
              className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
            >
              Use this
            </button>
          </div>
          <p className="text-xs text-emerald-200 whitespace-pre-wrap">{suggestedPrompt}</p>
        </div>
      )}

      {/* ── Crafted Prompt ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Generation Prompt
          </label>
          {craftedPrompt && (
            <button onClick={() => setCraftedPrompt('')} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <textarea
          value={craftedPrompt}
          onChange={e => setCraftedPrompt(e.target.value)}
          placeholder="Your prompt will appear here after chatting, or type one directly…"
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {/* ── Aspect ratio ── */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Aspect Ratio</label>
        <div className="relative">
          <select
            value={aspectRatio}
            onChange={e => setAspectRatio(e.target.value)}
            className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 pr-8"
          >
            {ASPECT_RATIOS.map(ar => (
              <option key={ar.value} value={ar.value}>{ar.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Reference image count indicator ── */}
      {allRefImages.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="flex -space-x-2">
            {allRefImages.slice(0, 4).map((img, i) => (
              <img
                key={i}
                src={img.dataUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover border-2 border-slate-800"
              />
            ))}
          </div>
          <span>{allRefImages.length} reference image{allRefImages.length > 1 ? 's' : ''} will be used in generation</span>
        </div>
      )}

      {/* ── Generate button ── */}
      <button
        onClick={handleGenerate}
        disabled={!craftedPrompt.trim() || isGenerating}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate Image
          </>
        )}
      </button>

      {/* Generation error */}
      {genError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
          {genError}
        </div>
      )}

      {/* ── Result ── */}
      {resultImage && (
        <div className="flex flex-col gap-2">
          <img
            src={resultImage}
            alt="Generated"
            className="w-full rounded-lg border border-slate-700 object-contain"
          />
          <div className="flex gap-2">
            {savedPath && (
              <button
                onClick={handleReveal}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Show in Finder
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
          {savedPath && (
            <p className="text-[10px] text-slate-500 truncate">Saved to: {savedPath}</p>
          )}
        </div>
      )}
    </div>
  )
}
