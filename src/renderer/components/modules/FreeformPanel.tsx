import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useChatStore } from '../../store/useChatStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import { BatchFreeformPanel } from './BatchFreeformPanel'
import {
  CheckCircle2,
  ImagePlus,
  Info,
  Loader2,
  MessageSquare,
  Send,
  X
} from 'lucide-react'

interface FreeformPanelProps {
  assetId?: string
  jobId?: string
}

export function FreeformPanel(props: FreeformPanelProps = {}) {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    freeformSettings,
    setFreeformSourceVersion,
    setFreeformCraftedPrompt
  } = useModuleStore()

  const {
    sessions,
    isSending,
    isDragging,
    chatError,
    pendingImages,
    startChat,
    sendMessage,
    acceptPrompt,
    setCraftedPrompt,
    getCraftedPrompt,
    clearChat,
    addPendingImage,
    removePendingImage,
    setIsDragging
  } = useChatStore()

  const { currentJob: storeJob, selectedAssetIds } = useJobStore()
  const { selectedSourceVersionId } = useLibraryStore()
  const { addToast } = useAppStore()

  const [userInput, setUserInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  // Use props if provided, otherwise fall back to store
  const jobId = props.jobId || storeJob?.id
  const assetId = props.assetId

  const currentSession = assetId ? sessions.get(assetId) : null

  // Auto-start chat when asset is selected
  useEffect(() => {
    if (jobId && assetId && !sessions.has(assetId)) {
      startChat(jobId, assetId)
    }
  }, [jobId, assetId])

  // Sync source version
  useEffect(() => {
    if (selectedSourceVersionId) {
      setFreeformSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  // Sync crafted prompt from current session to module store when switching assets
  useEffect(() => {
    if (assetId) {
      const craftedPrompt = getCraftedPrompt(assetId)
      setFreeformCraftedPrompt(craftedPrompt)
    }
  }, [assetId, currentSession])

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  const handleSendMessage = async () => {
    if (!userInput.trim() || !assetId) return

    const message = userInput.trim()
    setUserInput('')

    try {
      await sendMessage(assetId, message)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleAcceptPrompt = () => {
    if (currentSession?.suggestedPrompt && assetId) {
      acceptPrompt(assetId, currentSession.suggestedPrompt)
      addToast('✓ Prompt ready! Edit below if needed, then use Preview or HQ Preview to generate.', 'success')
    }
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const processImageFile = useCallback((file: File): Promise<void> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve()
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) { resolve(); return }

        // Strip "data:image/jpeg;base64," prefix to get raw base64
        const commaIdx = dataUrl.indexOf(',')
        const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl

        addPendingImage({
          dataUrl,
          base64,
          mimeType: file.type,
          name: file.name
        })
        resolve()
      }
      reader.readAsDataURL(file)
    })
  }, [addPendingImage])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [setIsDragging])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [setIsDragging])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    // App-internal drag from a tile (output path set via onDragStart)
    const appPath = e.dataTransfer.getData('application/x-afterglow-path')
    if (appPath) {
      const dataUrl = await window.electronAPI.readImageAsDataURL(appPath)
      if (dataUrl) {
        const commaIdx = dataUrl.indexOf(',')
        const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl
        const mimeMatch = dataUrl.match(/data:(image\/\w+);/)
        addPendingImage({
          dataUrl,
          base64,
          mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
          name: appPath.split('/').pop() || 'reference'
        })
      }
      return
    }

    // Filesystem file drop
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    for (const file of files) {
      await processImageFile(file)
    }
  }, [processImageFile, setIsDragging, addPendingImage])

  // ── Multi-select: delegate to batch panel ────────────────────────────────
  if (selectedAssetIds.size > 1) {
    return <BatchFreeformPanel />
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const groupedInjectors = injectors.reduce((acc, inj) => {
    const cat = inj.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(inj)
    return acc
  }, {} as Record<string, typeof injectors>)

  return (
    <div className="p-4 space-y-6">
      {/* Description */}
      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
        <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Chat with AI to craft a custom editing prompt. Drag &amp; drop reference images into the chat to give context — great for multi-angle shots.
        </div>
      </div>

      {/* Source Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-800 rounded-lg text-sm">
          {freeformSettings.sourceVersionId ? (
            <div className="flex items-center justify-between">
              <span className="text-white">Using selected version</span>
              <button
                onClick={() => setFreeformSourceVersion(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-slate-400">Original image (or select from Library)</span>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Prompt Builder Chat
        </label>

        {/* Drop zone wrapper */}
        <div
          ref={chatAreaRef}
          className={`bg-slate-800 rounded-lg overflow-hidden relative transition-all ${
            isDragging ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900' : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 rounded-lg pointer-events-none">
              <ImagePlus className="w-10 h-10 text-cyan-400 mb-2" />
              <div className="text-sm font-medium text-cyan-300">Drop image as reference</div>
              <div className="text-xs text-slate-400 mt-1">Attach to your next message</div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="h-64 overflow-y-auto p-3 space-y-3"
            style={{ scrollBehavior: 'smooth' }}
          >
            {currentSession?.messages.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div>Start chatting to craft your prompt</div>
                <div className="text-xs mt-1 text-slate-600">Drag &amp; drop images for context</div>
              </div>
            )}

            {currentSession?.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {/* Attached reference images (shown on user messages) */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.images.map((img, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="relative group"
                          title={img.name || 'Reference image'}
                        >
                          <img
                            src={`data:${img.mimeType};base64,${img.base64}`}
                            alt={img.name || `Reference ${imgIdx + 1}`}
                            className="h-16 w-16 object-cover rounded border border-white/20"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded-b truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.name || 'ref'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-slate-200 rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}

            {chatError && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-sm text-red-300">
                {chatError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pending images row */}
          {pendingImages.length > 0 && (
            <div className="border-t border-slate-700 px-3 pt-2 pb-1 flex gap-2 flex-wrap">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative group flex-shrink-0">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-14 w-14 object-cover rounded border border-slate-600"
                  />
                  <button
                    onClick={() => removePendingImage(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900"
                    title="Remove image"
                  >
                    <X className="w-3 h-3 text-slate-300" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded-b truncate">
                    {img.name}
                  </div>
                </div>
              ))}
              <div className="flex items-center self-center text-xs text-slate-500 pl-1">
                Will be attached to next message
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className={`border-t border-slate-700 p-3 ${pendingImages.length > 0 ? '' : ''}`}>
            <div className="flex gap-2">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={
                  pendingImages.length > 0
                    ? `Describe what you want (${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''} attached)...`
                    : 'Describe what you want to change, or drag & drop an image...'
                }
                disabled={isSending || !assetId}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                rows={2}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || !userInput.trim() || !assetId}
                className="px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white rounded flex items-center justify-center transition-colors"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Prompt */}
      {currentSession?.suggestedPrompt && (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-300">Suggested Prompt</span>
            </div>
            <button
              onClick={handleAcceptPrompt}
              className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
            >
              Use This
            </button>
          </div>
          <div className="text-sm text-emerald-200 whitespace-pre-wrap">
            {currentSession.suggestedPrompt}
          </div>
        </div>
      )}

      {/* Crafted Prompt (Editable) */}
      {currentSession?.craftedPrompt && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">Crafted Prompt</label>
            <button
              onClick={() => {
                if (assetId) {
                  setCraftedPrompt(assetId, '')
                  setFreeformCraftedPrompt('')
                }
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
          <textarea
            value={currentSession.craftedPrompt}
            onChange={(e) => {
              if (assetId) {
                setCraftedPrompt(assetId, e.target.value)
                setFreeformCraftedPrompt(e.target.value)
              }
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            rows={4}
            placeholder="Your crafted prompt will appear here..."
          />
        </div>
      )}

      {/* Injectors */}
      {Object.keys(groupedInjectors).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Options</label>
          <div className="space-y-3">
            {Object.entries(groupedInjectors).map(([category, items]) => (
              <div key={category}>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  {category.replace(/_/g, ' ')}
                </div>
                <div className="space-y-1">
                  {items.map((injector) => (
                    <label
                      key={injector.id}
                      className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInjectorIds.has(injector.id)}
                        onChange={() => toggleInjector(injector.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                      />
                      <span className="text-sm text-slate-200">{injector.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Instructions */}
      {currentSession?.craftedPrompt && (
        <div className="flex items-start gap-3 p-3 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
          <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-cyan-300">
            Your prompt is ready! Use <strong>Preview</strong> or <strong>HQ Preview</strong> buttons below to generate your custom edit.
          </div>
        </div>
      )}
    </div>
  )
}
