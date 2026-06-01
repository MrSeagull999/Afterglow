/* global require */
const { app, core } = require('photoshop')
const { storage } = require('uxp')

const AFTERGLOW_URL = 'http://localhost:3737'
const POLL_INTERVAL_MS = 2500
const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

const sendBtn = document.getElementById('sendBtn')
const statusEl = document.getElementById('status')
const progressEl = document.getElementById('progress')
const progressBarEl = document.getElementById('progressBar')
const moduleSelect = document.getElementById('moduleSelect')
const tierSelect = document.getElementById('tierSelect')

// Chat elements
const chatSection = document.getElementById('chatSection')
const chatMessages = document.getElementById('chatMessages')
const chatInput = document.getElementById('chatInput')
const chatSendBtn = document.getElementById('chatSendBtn')
const chatStatus = document.getElementById('chatStatus')
const promptSection = document.getElementById('promptSection')
const craftedPromptEl = document.getElementById('craftedPrompt')
const usePromptBtn = document.getElementById('usePromptBtn')

// Chat state
let chatSessionId = null
let chatJobId = null
let chatAssetId = null
let pendingSuggestedPrompt = null

function setStatus(msg, type) {
  statusEl.textContent = msg
  statusEl.className = type || ''
}

function setProgress(pct) {
  if (pct == null) {
    progressEl.style.display = 'none'
    progressBarEl.style.width = '0%'
  } else {
    progressEl.style.display = 'block'
    progressBarEl.style.width = `${Math.min(100, pct)}%`
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build a multipart/form-data body as a Uint8Array without using FormData
 * (not available in the UXP sandbox).
 */
function buildMultipart(fields, imageBytes, boundary) {
  const encoder = new TextEncoder()

  const textPart = (name, value) =>
    encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)

  const textParts = [
    textPart('module', fields.module),
    textPart('tier', fields.tier),
    textPart('settings', fields.settings),
  ]

  const imageHeader = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="export.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
  )
  const imageBuf = new Uint8Array(imageBytes)
  const closing = encoder.encode(`\r\n--${boundary}--\r\n`)

  const totalLen =
    textParts.reduce((sum, p) => sum + p.byteLength, 0) +
    imageHeader.byteLength +
    imageBuf.byteLength +
    closing.byteLength

  const body = new Uint8Array(totalLen)
  let offset = 0

  for (const part of textParts) {
    body.set(part, offset)
    offset += part.byteLength
  }
  body.set(imageHeader, offset)
  offset += imageHeader.byteLength
  body.set(imageBuf, offset)
  offset += imageBuf.byteLength
  body.set(closing, offset)

  return body
}

async function pollForCompletion(versionId) {
  const start = Date.now()

  while (true) {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error('Timed out waiting for Afterglow (5 min limit)')
    }

    await delay(POLL_INTERVAL_MS)

    const res = await fetch(`${AFTERGLOW_URL}/api/status/${versionId}`)
    if (!res.ok) throw new Error(`Status check failed: HTTP ${res.status}`)

    const { status, outputPath, error } = await res.json()

    if (status === 'hq_ready' || status === 'final_ready') {
      return outputPath
    }

    if (status === 'error') {
      throw new Error(error || 'Afterglow generation failed')
    }

    // Show friendly status while waiting
    const labels = {
      generating: 'Generating preview...',
      hq_generating: 'Generating HQ image...',
      final_generating: 'Generating final image...',
      pending: 'Queued...',
    }
    setStatus(labels[status] || `Working (${status})...`)
    setProgress(50) // indeterminate-style mid-point
  }
}

// ─── Module selection: show/hide chat section ────────────────────────────────

moduleSelect.addEventListener('change', () => {
  const isFreeform = moduleSelect.value === 'freeform'
  chatSection.style.display = isFreeform ? 'block' : 'none'

  if (isFreeform) {
    promptSection.style.display = 'block'
    // Auto-start chat session if we have a document open
    if (!chatSessionId && app.activeDocument) {
      startChatSession()
    }
  }
})

// ─── Chat functions ──────────────────────────────────────────────────────────

async function exportDocumentAsJpeg() {
  const doc = app.activeDocument
  if (!doc) throw new Error('No active document')

  const tempFolder = await storage.localFileSystem.getTemporaryFolder()
  const exportFile = await tempFolder.createFile('afterglow_chat_export.jpg', { overwrite: true })
  await doc.saveAs.jpg(exportFile, { quality: 12 }, true)
  return await exportFile.read({ format: storage.formats.binary })
}

async function startChatSession() {
  if (chatSessionId) return // already have a session

  chatStatus.textContent = 'Starting chat session...'
  chatSendBtn.disabled = true

  try {
    const imageBytes = await exportDocumentAsJpeg()

    // Send image via multipart to chat/start
    const boundary = `----AfterglowChatBoundary${Date.now().toString(36)}`
    const encoder = new TextEncoder()

    const imageHeader = encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="export.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    )
    const imageBuf = new Uint8Array(imageBytes)
    const closing = encoder.encode(`\r\n--${boundary}--\r\n`)

    const totalLen = imageHeader.byteLength + imageBuf.byteLength + closing.byteLength
    const body = new Uint8Array(totalLen)
    let offset = 0
    body.set(imageHeader, offset); offset += imageHeader.byteLength
    body.set(imageBuf, offset); offset += imageBuf.byteLength
    body.set(closing, offset)

    const res = await fetch(`${AFTERGLOW_URL}/api/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body.buffer,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Chat start failed: ${errText}`)
    }

    const data = await res.json()
    chatSessionId = data.sessionId
    chatJobId = data.jobId
    chatAssetId = data.assetId
    chatStatus.textContent = 'Ready — describe what you want to do with this image.'
    chatSendBtn.disabled = false
    chatInput.focus()
  } catch (err) {
    chatStatus.textContent = `Error: ${err.message}`
    chatSendBtn.disabled = false
  }
}

function appendChatMessage(role, text) {
  const div = document.createElement('div')
  div.className = `chat-msg ${role}`

  const roleEl = document.createElement('div')
  roleEl.className = 'role'
  roleEl.textContent = role === 'user' ? 'You' : 'AI'

  const textEl = document.createElement('div')
  textEl.className = 'text'
  textEl.textContent = text

  div.appendChild(roleEl)
  div.appendChild(textEl)
  chatMessages.appendChild(div)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

async function sendChatMessageToServer() {
  const message = chatInput.value.trim()
  if (!message || !chatSessionId) return

  chatInput.value = ''
  chatSendBtn.disabled = true
  chatStatus.textContent = 'AI is thinking...'

  appendChatMessage('user', message)

  try {
    const res = await fetch(`${AFTERGLOW_URL}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: chatSessionId, message }),
    })

    if (!res.ok) {
      throw new Error(`Chat send failed: HTTP ${res.status}`)
    }

    const data = await res.json()

    if (!data.success) {
      throw new Error(data.error || 'Chat failed')
    }

    // Strip prompt markers from displayed message
    let displayText = data.message || ''
    displayText = displayText.replace(/\[PROMPT_START\]/g, '').replace(/\[PROMPT_END\]/g, '').trim()
    appendChatMessage('assistant', displayText)

    if (data.suggestedPrompt) {
      pendingSuggestedPrompt = data.suggestedPrompt
      craftedPromptEl.value = data.suggestedPrompt
      usePromptBtn.style.display = 'block'
      chatStatus.textContent = 'Prompt suggested — review it below, then click Send to Afterglow.'
    } else {
      chatStatus.textContent = 'Continue the conversation or ask for a prompt.'
    }
  } catch (err) {
    chatStatus.textContent = `Error: ${err.message}`
  } finally {
    chatSendBtn.disabled = false
    chatInput.focus()
  }
}

chatSendBtn.addEventListener('click', sendChatMessageToServer)
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChatMessageToServer()
  }
})

usePromptBtn.addEventListener('click', () => {
  if (pendingSuggestedPrompt) {
    craftedPromptEl.value = pendingSuggestedPrompt
    usePromptBtn.style.display = 'none'
    chatStatus.textContent = 'Prompt applied. Click Send to Afterglow to generate.'
  }
})

// ─── Main send button ───────────────────────────────────────────────────────

sendBtn.addEventListener('click', async () => {
  const doc = app.activeDocument
  if (!doc) {
    setStatus('No active document. Please open an image in Photoshop first.', 'error')
    return
  }

  const isFreeform = moduleSelect.value === 'freeform'

  // For freeform, require a crafted prompt
  if (isFreeform) {
    const prompt = craftedPromptEl.value.trim()
    if (!prompt) {
      setStatus('Please chat with AI first to craft a prompt, or type one manually.', 'error')
      return
    }
  }

  sendBtn.disabled = true
  setProgress(10)
  setStatus('Exporting document as JPEG...')

  const originalDoc = doc

  try {
    // 1. Export current document as JPEG to a UXP temp file
    const tempFolder = await storage.localFileSystem.getTemporaryFolder()
    const exportFile = await tempFolder.createFile('afterglow_export.jpg', { overwrite: true })

    // saveAs.jpg: quality 1–12 in PS UXP (12 = maximum quality)
    await originalDoc.saveAs.jpg(exportFile, { quality: 12 }, true)

    // 2. Read the exported JPEG bytes
    const fileData = await exportFile.read({ format: storage.formats.binary })

    setProgress(20)
    setStatus('Sending to Afterglow...')

    // 3. Build settings based on module
    const settings = {}
    if (isFreeform) {
      settings.prompt = craftedPromptEl.value.trim()
    }

    // 4. Build and POST multipart body
    const boundary = `----AfterglowBoundary${Date.now().toString(36)}`
    const body = buildMultipart(
      {
        module: moduleSelect.value,
        tier: tierSelect.value,
        settings: JSON.stringify(settings),
      },
      fileData,
      boundary
    )

    const response = await fetch(`${AFTERGLOW_URL}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body.buffer,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Server error ${response.status}: ${errText}`)
    }

    const { versionId } = await response.json()
    setProgress(30)
    setStatus('Processing...')

    // 5. Poll until generation completes
    const outputPath = await pollForCompletion(versionId)

    setProgress(90)
    setStatus('Placing result as new layer...')

    // 6. Open result as a temporary document, duplicate its layer into the original, then close
    const resultFile = await storage.localFileSystem.getEntryWithUrl(`file://${outputPath}`)
    const tempDoc = await app.open(resultFile)

    await core.executeAsModal(
      async () => {
        // Duplicate the result layer onto the original document
        const resultLayer = tempDoc.layers[0]
        await resultLayer.duplicate(originalDoc)

        // Name the new layer for easy identification
        const newLayer = originalDoc.layers[0]
        newLayer.name = `Afterglow \u2013 ${moduleSelect.value}`

        // Close the temporary result document without saving
        await tempDoc.closeWithoutSaving()

        // Bring the original document back into focus
        app.activeDocument = originalDoc
      },
      { commandName: 'Place Afterglow Result' }
    )

    setProgress(null)
    setStatus(`Done. Layer "Afterglow \u2013 ${moduleSelect.value}" added. Cmd+S to save back to Lightroom.`, 'success')
  } catch (err) {
    setProgress(null)
    const msg = err && err.message ? err.message : String(err)
    setStatus(`Error: ${msg}`, 'error')
    console.error('[Afterglow Plugin]', err)
  } finally {
    sendBtn.disabled = false
  }
})
