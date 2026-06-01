import { create } from 'zustand'
import { useModuleStore } from './useModuleStore'

/**
 * Chat store for freeform module.
 * Manages multi-turn conversation state with Gemini Flash.
 */

export interface ChatImageAttachment {
  base64: string
  mimeType: string
  name?: string
}

// Pending image (before send — carries dataUrl for preview display)
export interface PendingImage {
  dataUrl: string  // full data URL for display
  base64: string   // raw base64 for API
  mimeType: string
  name: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  images?: ChatImageAttachment[]  // reference images attached to this message
}

export interface ChatSession {
  sessionId: string
  assetId: string
  messages: ChatMessage[]
  suggestedPrompt: string | null
  craftedPrompt: string
}

interface ChatState {
  // Chat sessions keyed by assetId
  sessions: Map<string, ChatSession>

  // Images staged for the next message
  pendingImages: PendingImage[]

  // UI state
  isSending: boolean
  isDragging: boolean
  chatError: string | null

  // Actions
  startChat: (jobId: string, assetId: string) => Promise<void>
  sendMessage: (assetId: string, message: string) => Promise<void>
  acceptPrompt: (assetId: string, prompt: string) => void
  setCraftedPrompt: (assetId: string, prompt: string) => void
  getCraftedPrompt: (assetId: string) => string
  clearChat: (assetId: string) => void
  clearAllChats: () => void
  addPendingImage: (image: PendingImage) => void
  removePendingImage: (index: number) => void
  clearPendingImages: () => void
  setIsDragging: (dragging: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: new Map(),
  pendingImages: [],
  isSending: false,
  isDragging: false,
  chatError: null,

  startChat: async (jobId: string, assetId: string) => {
    try {
      set({ chatError: null })

      // Check if session already exists
      const existingSession = get().sessions.get(assetId)
      if (existingSession) {
        return
      }

      // Create new chat session via IPC
      const response = await window.api.invoke('chat:startSession', jobId, assetId)

      if (!response) {
        throw new Error('Failed to create chat session')
      }

      const session: ChatSession = {
        sessionId: response.id,
        assetId,
        messages: [],
        suggestedPrompt: null,
        craftedPrompt: ''
      }

      const newSessions = new Map(get().sessions)
      newSessions.set(assetId, session)
      set({ sessions: newSessions })
    } catch (error) {
      console.error('[ChatStore] Failed to start chat:', error)
      set({ chatError: error instanceof Error ? error.message : 'Failed to start chat' })
    }
  },

  sendMessage: async (assetId: string, message: string) => {
    try {
      set({ isSending: true, chatError: null })

      const session = get().sessions.get(assetId)
      if (!session) {
        throw new Error('Chat session not found')
      }

      // Snapshot pending images and clear them before async op
      const pendingImages = get().pendingImages
      const attachedImages: ChatImageAttachment[] = pendingImages.map(img => ({
        base64: img.base64,
        mimeType: img.mimeType,
        name: img.name
      }))

      // Add user message optimistically (with image previews for display)
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        ...(attachedImages.length > 0 ? { images: attachedImages } : {})
      }

      const updatedSession = {
        ...session,
        messages: [...session.messages, userMessage]
      }

      const newSessions = new Map(get().sessions)
      newSessions.set(assetId, updatedSession)
      set({ sessions: newSessions, pendingImages: [] })

      // Send to backend (include reference images if any)
      const response = await window.api.invoke(
        'chat:sendMessage',
        session.sessionId,
        message,
        attachedImages.length > 0 ? attachedImages : undefined
      )

      if (!response.success) {
        throw new Error(response.error || 'Failed to send message')
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message || '',
        timestamp: new Date().toISOString()
      }

      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, assistantMessage],
        suggestedPrompt: response.suggestedPrompt || null
      }

      const finalSessions = new Map(get().sessions)
      finalSessions.set(assetId, finalSession)
      set({ sessions: finalSessions, isSending: false })
    } catch (error) {
      console.error('[ChatStore] Failed to send message:', error)
      set({
        isSending: false,
        chatError: error instanceof Error ? error.message : 'Failed to send message'
      })
    }
  },

  acceptPrompt: (assetId: string, prompt: string) => {
    const session = get().sessions.get(assetId)
    if (!session) return

    const updatedSession = { ...session, craftedPrompt: prompt }
    const newSessions = new Map(get().sessions)
    newSessions.set(assetId, updatedSession)
    set({ sessions: newSessions })

    // Also update module store
    useModuleStore.getState().setFreeformCraftedPrompt(prompt)
  },

  setCraftedPrompt: (assetId: string, prompt: string) => {
    const session = get().sessions.get(assetId)
    if (!session) return

    const updatedSession = { ...session, craftedPrompt: prompt }
    const newSessions = new Map(get().sessions)
    newSessions.set(assetId, updatedSession)
    set({ sessions: newSessions })

    // Also update module store
    useModuleStore.getState().setFreeformCraftedPrompt(prompt)
  },

  getCraftedPrompt: (assetId: string) => {
    const session = get().sessions.get(assetId)
    return session?.craftedPrompt || ''
  },

  clearChat: (assetId: string) => {
    const session = get().sessions.get(assetId)
    if (session?.sessionId) {
      window.api.invoke('chat:clearSession', session.sessionId).catch(console.error)
    }

    const newSessions = new Map(get().sessions)
    newSessions.delete(assetId)
    set({ sessions: newSessions, chatError: null })
  },

  clearAllChats: () => {
    // Clear all backend sessions
    const sessions = get().sessions
    sessions.forEach(session => {
      window.api.invoke('chat:clearSession', session.sessionId).catch(console.error)
    })

    set({ sessions: new Map(), chatError: null })
  },

  addPendingImage: (image: PendingImage) => {
    set(state => ({ pendingImages: [...state.pendingImages, image] }))
  },

  removePendingImage: (index: number) => {
    set(state => ({
      pendingImages: state.pendingImages.filter((_, i) => i !== index)
    }))
  },

  clearPendingImages: () => {
    set({ pendingImages: [] })
  },

  setIsDragging: (dragging: boolean) => {
    set({ isDragging: dragging })
  }
}))
