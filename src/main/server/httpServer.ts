import http from 'http'
import fs from 'fs'
import { promises as fsAsync } from 'fs'
import { join } from 'path'
import { createJob } from '../core/store/jobStore'
import { createAsset } from '../core/store/assetStore'
import { getVersion, createFinalFromApprovedVersion } from '../core/store/versionStore'
import { getJobOriginalsPath } from '../core/paths'
import { generateVersionHQPreview, generateVersionFinal } from '../core/modules/shared/generateService'
import { generateStagingPreview } from '../core/modules/interior/staging/stagingModule'
import { generateCleanSlatePreview } from '../core/modules/interior/cleanSlate/cleanSlateModule'
import { generateTwilightPreview } from '../core/modules/twilight/twilightModule'
import { generateRelightPreview } from '../core/modules/relight/relightModule'
import { generateRenovatePreview } from '../core/modules/interior/renovate/renovateModule'
import { generateFreeformPreview } from '../core/modules/freeform/freeformModule'
import { getPreset, getRelightPreset } from '../core/promptBank'
import {
  createChatSession,
  sendChatMessage,
  getChatSession,
  getChatReferenceImagesForAsset
} from '../core/services/chat/chatService'
import type { ModuleType, Version } from '../../shared/types'

// In-memory map: versionId → jobId (active PS sessions only, process-lifetime)
const activeJobs = new Map<string, string>()

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
  res.end(body)
}

function collectBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Parse a multipart/form-data body into a map of field name → raw bytes.
 * Works in binary so it correctly handles image data alongside text fields.
 */
function parseMultipart(body: Buffer, boundary: string): Map<string, Buffer> {
  const fields = new Map<string, Buffer>()
  const boundaryBuf = Buffer.from(`--${boundary}`)
  const crlf2 = Buffer.from('\r\n\r\n')
  const nextBoundaryBuf = Buffer.from(`\r\n--${boundary}`)

  // Find the start of the first part (skip initial boundary + CRLF)
  let pos = body.indexOf(boundaryBuf)
  if (pos === -1) return fields
  pos += boundaryBuf.length + 2 // skip '--boundary\r\n'

  while (pos < body.length) {
    // Find where headers end
    const headerEnd = body.indexOf(crlf2, pos)
    if (headerEnd === -1) break

    const headers = body.slice(pos, headerEnd).toString('utf-8')
    pos = headerEnd + 4 // skip \r\n\r\n

    // Find next boundary (preceded by \r\n)
    const nextBoundary = body.indexOf(nextBoundaryBuf, pos)
    if (nextBoundary === -1) break

    const fieldBody = body.slice(pos, nextBoundary)
    pos = nextBoundary + nextBoundaryBuf.length

    // Extract field name from Content-Disposition header
    const nameMatch = headers.match(/Content-Disposition:[^\r]*name="([^"]+)"/i)
    if (nameMatch) {
      fields.set(nameMatch[1], fieldBody)
    }

    // Check what follows: '--' means final boundary, '\r\n' means more parts
    if (pos + 2 <= body.length) {
      const next2 = body.slice(pos, pos + 2).toString('ascii')
      if (next2 === '--') break     // closing boundary
      if (next2 === '\r\n') pos += 2 // advance past CRLF to next part's headers
    }
  }

  return fields
}

async function dispatchModule(
  jobId: string,
  assetId: string,
  module: ModuleType,
  settings: Record<string, unknown>
): Promise<Version> {
  const sourceVersionId = `original:${assetId}`

  switch (module) {
    case 'clean':
      return generateCleanSlatePreview({ jobId, assetId })

    case 'stage':
      return generateStagingPreview({
        jobId,
        assetId,
        sourceVersionId,
        roomType: (settings.roomType as string) || 'living room',
        style: (settings.style as string) || 'modern contemporary',
      })

    case 'twilight': {
      const presetId = (settings.presetId as string) || 'twilight_exterior_classic'
      const preset = await getPreset(presetId)
      const promptTemplate = (settings.promptTemplate as string) || preset?.promptTemplate || ''
      return generateTwilightPreview({
        jobId,
        assetId,
        sourceVersionId,
        presetId,
        promptTemplate,
        lightingCondition: (settings.lightingCondition as 'overcast' | 'sunny') || 'overcast',
      })
    }

    case 'relight': {
      const presetId = (settings.presetId as string) || 'relight_blue_hour'
      const preset = await getRelightPreset(presetId)
      const promptTemplate = (settings.promptTemplate as string) || preset?.promptTemplate || ''
      return generateRelightPreview({
        jobId,
        assetId,
        sourceVersionId,
        presetId,
        promptTemplate,
      })
    }

    case 'renovate':
      return generateRenovatePreview({
        jobId,
        assetId,
        sourceVersionId,
        changes: (settings.changes as Record<string, unknown>) || {},
      })

    case 'freeform': {
      const prompt = settings.prompt as string
      if (!prompt) throw new Error('Freeform module requires a prompt in settings.prompt')
      const refImages = getChatReferenceImagesForAsset(assetId)
      return generateFreeformPreview({
        jobId,
        assetId,
        craftedPrompt: prompt,
        injectorIds: (settings.injectorIds as string[]) || [],
        customInstructions: (settings.customInstructions as string) || '',
        referenceImagePaths: refImages.length > 0 ? refImages : undefined,
      })
    }

    default:
      throw new Error(`Unsupported module: ${module}`)
  }
}

async function handleProcess(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
  if (!boundaryMatch) {
    sendJson(res, 400, { error: 'Missing multipart boundary in Content-Type' })
    return
  }
  const boundary = boundaryMatch[1].replace(/^"(.*)"$/, '$1')

  const body = await collectBody(req)
  const fields = parseMultipart(body, boundary)

  const imageBytes = fields.get('image')
  if (!imageBytes || imageBytes.length === 0) {
    sendJson(res, 400, { error: 'Missing or empty image field' })
    return
  }

  const module = (fields.get('module')?.toString('utf-8') ?? 'twilight') as ModuleType
  const tier = fields.get('tier')?.toString('utf-8') ?? 'hq'
  const settingsStr = fields.get('settings')?.toString('utf-8') ?? '{}'
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(settingsStr)
  } catch {
    // ignore malformed settings, use defaults
  }

  // Create job + save uploaded image into originals folder
  const job = await createJob({ name: 'Photoshop Import' })
  const savedPath = join(getJobOriginalsPath(job.id), `ps_import_${Date.now()}.jpg`)
  await fsAsync.writeFile(savedPath, imageBytes)

  // Create asset pointing directly at the saved file (no extra copy)
  const asset = await createAsset({ jobId: job.id, name: 'PS Export', originalPath: savedPath })

  // Build version via module builder
  const version = await dispatchModule(job.id, asset.id, module, settings)

  // Start generation fire-and-forget, track versionId → jobId for status polling
  let targetVersionId: string

  if (tier === 'final') {
    const finalVersion = await createFinalFromApprovedVersion({
      jobId: job.id,
      approvedVersionId: version.id,
    })
    generateVersionFinal(job.id, finalVersion.id).catch((err) =>
      console.error('[HttpServer] Final generation error:', err)
    )
    activeJobs.set(finalVersion.id, job.id)
    targetVersionId = finalVersion.id
  } else {
    generateVersionHQPreview(job.id, version.id).catch((err) =>
      console.error('[HttpServer] HQ generation error:', err)
    )
    activeJobs.set(version.id, job.id)
    targetVersionId = version.id
  }

  sendJson(res, 200, { versionId: targetVersionId, jobId: job.id, status: 'pending' })
}

async function handleStatus(res: http.ServerResponse, versionId: string): Promise<void> {
  const jobId = activeJobs.get(versionId)
  if (!jobId) {
    sendJson(res, 404, { error: 'Version not found' })
    return
  }

  const version = await getVersion(jobId, versionId)
  if (!version) {
    sendJson(res, 404, { error: 'Version not found in store' })
    return
  }

  sendJson(res, 200, {
    status: version.status,
    outputPath: version.outputPath ?? null,
    error: version.generationError ?? null,
  })
}

async function handleResult(res: http.ServerResponse, versionId: string): Promise<void> {
  const jobId = activeJobs.get(versionId)
  if (!jobId) {
    sendJson(res, 404, { error: 'Version not found' })
    return
  }

  const version = await getVersion(jobId, versionId)
  if (!version?.outputPath) {
    sendJson(res, 404, { error: 'Output not ready' })
    return
  }

  if (!fs.existsSync(version.outputPath)) {
    sendJson(res, 404, { error: 'Output file missing on disk' })
    return
  }

  const stat = fs.statSync(version.outputPath)
  const mimeType = version.outputPath.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png'

  res.writeHead(200, {
    ...CORS_HEADERS,
    'Content-Type': mimeType,
    'Content-Length': stat.size,
  })
  fs.createReadStream(version.outputPath).pipe(res)
}

async function collectJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const body = await collectBody(req)
  return JSON.parse(body.toString('utf-8'))
}

async function handleChatStart(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || ''

  // Chat start can come as JSON or multipart (with image)
  if (contentType.includes('multipart/form-data')) {
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
    if (!boundaryMatch) {
      sendJson(res, 400, { error: 'Missing multipart boundary' })
      return
    }
    const boundary = boundaryMatch[1].replace(/^"(.*)"$/, '$1')
    const body = await collectBody(req)
    const fields = parseMultipart(body, boundary)

    const imageBytes = fields.get('image')
    if (!imageBytes || imageBytes.length === 0) {
      sendJson(res, 400, { error: 'Missing image field' })
      return
    }

    // Create job + asset for this image
    const job = await createJob({ name: 'Plugin Chat' })
    const savedPath = join(getJobOriginalsPath(job.id), `ps_import_${Date.now()}.jpg`)
    await fsAsync.writeFile(savedPath, imageBytes)
    const asset = await createAsset({ jobId: job.id, name: 'PS Export', originalPath: savedPath })

    const session = await createChatSession(job.id, asset.id)
    activeJobs.set(`chat:${session.id}`, job.id)

    sendJson(res, 200, { sessionId: session.id, jobId: job.id, assetId: asset.id })
  } else {
    // JSON body with existing assetId (not used by PS plugin but available)
    const data = await collectJsonBody(req)
    const jobId = data.jobId as string
    const assetId = data.assetId as string
    if (!jobId || !assetId) {
      sendJson(res, 400, { error: 'jobId and assetId are required' })
      return
    }

    const session = await createChatSession(jobId, assetId)
    sendJson(res, 200, { sessionId: session.id, jobId, assetId })
  }
}

async function handleChatSend(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const data = await collectJsonBody(req)
  const sessionId = data.sessionId as string
  const message = data.message as string

  if (!sessionId || !message) {
    sendJson(res, 400, { error: 'sessionId and message are required' })
    return
  }

  const result = await sendChatMessage(sessionId, message)
  sendJson(res, 200, result)
}

async function handleChatSession(res: http.ServerResponse, sessionId: string): Promise<void> {
  const session = getChatSession(sessionId)
  if (!session) {
    sendJson(res, 404, { error: 'Session not found' })
    return
  }

  sendJson(res, 200, {
    id: session.id,
    messages: session.messages,
    suggestedPrompt: session.suggestedPrompt,
  })
}

async function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = req.url ?? ''
  const method = req.method ?? ''

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS)
    res.end()
    return
  }

  try {
    if (method === 'POST' && url === '/api/process') {
      await handleProcess(req, res)
    } else if (method === 'GET' && url.startsWith('/api/status/')) {
      await handleStatus(res, url.slice('/api/status/'.length))
    } else if (method === 'GET' && url.startsWith('/api/result/')) {
      await handleResult(res, url.slice('/api/result/'.length))
    } else if (method === 'POST' && url === '/api/chat/start') {
      await handleChatStart(req, res)
    } else if (method === 'POST' && url === '/api/chat/send') {
      await handleChatSend(req, res)
    } else if (method === 'GET' && url.startsWith('/api/chat/session/')) {
      await handleChatSession(res, url.slice('/api/chat/session/'.length))
    } else {
      sendJson(res, 404, { error: 'Not found' })
    }
  } catch (err) {
    console.error('[HttpServer] Unhandled error:', err)
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal server error' })
  }
}

export function startHttpServer(port = 3737): void {
  const server = http.createServer(requestHandler)

  server.listen(port, '127.0.0.1', () => {
    console.log(`[HttpServer] Listening on http://127.0.0.1:${port}`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[HttpServer] Port ${port} already in use — Photoshop plugin will not connect`)
    } else {
      console.error('[HttpServer] Server error:', err)
    }
  })
}
