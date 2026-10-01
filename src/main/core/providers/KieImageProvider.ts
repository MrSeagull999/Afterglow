import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import type { IImageProvider, ImageGenerationRequest, ImageGenerationResponse } from './IImageProvider'
import { getKieImageModel } from '../../../shared/services/provider/kieModels'

const API = 'https://api.kie.ai/api/v1/jobs'
const UPLOAD = 'https://kieai.redpandaai.co/api/file-stream-upload'
const RATIOS = {
  'gpt-image': ['auto', '1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9', '27:16', '16:27', '9:8', '8:9'],
  'nano-banana': ['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']
}

// Desktop clients poll because they do not expose a public callback server.
export class KieImageProvider implements IImageProvider {
  name = 'kie'
  constructor(
    private apiKey: string,
    private fetcher: typeof fetch = fetch,
    private pollIntervalMs = 3000,
    private timeoutMs = 10 * 60 * 1000
  ) {}

  isConfigured(): boolean { return Boolean(this.apiKey.trim()) && this.apiKey !== 'your_kie_api_key_here' }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    let taskId: string | undefined
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const signal = controller.signal
    try {
      if (!this.isConfigured()) throw new Error('Add KIE_API_KEY to your .env file and restart AfterGlow to use Kie.ai image models.')
      const kieModel = getKieImageModel(request.model)
      if (!kieModel) throw new Error('Unsupported Kie image model')
      const isGpt = kieModel.family === 'gpt-image'
      const resolution = request.imageSize === '4K' ? '4K' : request.imageSize === '1024x1024' ? '1K' : '2K'
      const aspectRatio = request.aspectRatio || 'auto'
      if (!(RATIOS[kieModel.family] as readonly string[]).includes(aspectRatio)) throw new Error(`Kie does not support aspect ratio ${aspectRatio}`)
      if (isGpt && resolution !== '1K' && ['27:16', '16:27', '9:8', '8:9'].includes(aspectRatio)) {
        throw new Error(`Aspect ratio ${aspectRatio} is only supported at 1K on Kie`)
      }
      const images = [
        ...(request.imageData ? [{ imageData: request.imageData, mimeType: request.mimeType || 'image/png', role: 'source image to edit' }] : []),
        ...(request.referenceImages || []).map(image => ({ ...image }))
      ]
      if (images.length > kieModel.maxImages) throw new Error(`${kieModel.label} supports at most ${kieModel.maxImages} images, including the source image.`)
      // Validate all inputs before uploading anything.
      for (const image of images) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
          image.imageData = (await sharp(Buffer.from(image.imageData, 'base64')).png().toBuffer()).toString('base64')
          image.mimeType = 'image/png'
        }
        if (Buffer.byteLength(image.imageData, 'base64') > 30 * 1024 * 1024) throw new Error('Kie input images must be 30 MB or smaller.')
      }
      const headers = { Authorization: `Bearer ${this.apiKey}` }
      const json = async (url: string, init: RequestInit = {}) => {
        const response = await this.fetcher(url, { ...init, signal, headers: { ...headers, ...init.headers } })
        if (!response.ok) throw new Error(`Kie request failed (HTTP ${response.status})`)
        const body = await response.json()
        if (body.code !== 200 || body.success === false) throw new Error(body.msg || `Kie request failed (${body.code})`)
        if (!body.data) throw new Error('Kie returned an empty response')
        return body.data
      }
      const urls: string[] = []
      for (const image of images) {
        const form = new FormData()
        const ext = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType.split('/')[1]
        form.append('file', new Blob([new Uint8Array(Buffer.from(image.imageData, 'base64'))], { type: image.mimeType }), `${randomUUID()}.${ext}`)
        form.append('uploadPath', 'afterglow/images')
        const uploaded = await json(UPLOAD, { method: 'POST', body: form })
        if (typeof uploaded.downloadUrl !== 'string' || !uploaded.downloadUrl.startsWith('https://')) throw new Error('Kie upload did not return an image URL')
        urls.push(uploaded.downloadUrl)
      }
      // GPT Image splits into text-to-image / image-to-image endpoints; Nano Banana uses one model ID.
      const model = isGpt ? `${request.model}-${urls.length ? 'image-to-image' : 'text-to-image'}` : request.model
      const roles = images.map((image, index) => `Image ${index + 1}: ${image.role}`).join('\n')
      const prompt = roles ? `${request.prompt}\n\nInput image roles:\n${roles}` : request.prompt
      const input = isGpt
        ? { prompt, ...(urls.length ? { input_urls: urls } : {}), aspect_ratio: aspectRatio, resolution, background: 'opaque' }
        : { prompt, image_input: urls, aspect_ratio: aspectRatio, resolution, output_format: 'png' }
      const created = await json(`${API}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input })
      })
      if (typeof created.taskId !== 'string' || !created.taskId) throw new Error('Kie did not return a task ID')
      taskId = created.taskId
      for (;;) {
        if (signal.aborted) throw new Error('Kie generation timed out')
        const task = await json(`${API}/recordInfo?taskId=${encodeURIComponent(taskId!)}`)
        if (task.state === 'fail') throw new Error(task.failMsg || 'Kie image generation failed')
        if (task.state === 'success') {
          let result: { resultUrls?: string[] }
          try { result = JSON.parse(task.resultJson) } catch { throw new Error('Kie returned invalid image results') }
          const url = result?.resultUrls?.[0]
          if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Kie returned no image URL')
          // Never send the API key to the result storage host.
          const response = await this.fetcher(url, { signal })
          if (!response.ok) throw new Error(`Kie image download failed (HTTP ${response.status})`)
          const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/png'
          if (!mimeType.startsWith('image/')) throw new Error('Kie download was not an image')
          const bytes = Buffer.from(await response.arrayBuffer())
          if (!bytes.length) throw new Error('Kie returned an empty image')
          return { success: true, imageData: bytes.toString('base64'), mimeType,
            providerMeta: { provider: 'kie', model, taskId, resolution, seedSupported: false } }
        }
        if (!['waiting', 'queuing', 'generating'].includes(task.state)) throw new Error(`Unexpected Kie task state: ${task.state}`)
        await new Promise<void>(resolve => setTimeout(resolve, this.pollIntervalMs))
      }
    } catch (error) {
      const message = signal.aborted ? 'Kie generation timed out' : error instanceof Error ? error.message : 'Kie generation failed'
      return { success: false, error: `${message}${taskId ? ` (task ${taskId})` : ''}`.replaceAll(this.apiKey || '\0', '[redacted]') }
    } finally { clearTimeout(timer) }
  }
}
