import { readFile, writeFile } from 'fs/promises'
import type { ImageModel } from './geminiClient'

export interface JsonlRequest {
  customId: string
  request: {
    model: string
    contents: Array<{
      role?: string
      parts: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }>
    generationConfig?: {
      responseModalities?: string[]
      imagenConfig?: {
        outputOptions?: {
          aspectRatio?: string
        }
      }
      seed?: number
    }
  }
}

export interface JsonlResponse {
  customId: string
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
          inline_data?: {
            mime_type: string
            data: string
          }
        }>
      }
    }>
    error?: {
      code: number
      message: string
    }
  }
  error?: {
    code: number
    message: string
  }
}

export function createJsonlRequest(
  customId: string,
  prompt: string,
  imageBase64: string,
  mimeType: string,
  model: ImageModel = 'gemini-3-pro-image-preview',
  seed: number | null = null
): JsonlRequest {
  const generationConfig: JsonlRequest['request']['generationConfig'] = {
    responseModalities: ['IMAGE'],
    imagenConfig: {
      outputOptions: {
        aspectRatio: '1:1'
      }
    }
  }
  
  if (seed !== null) {
    generationConfig.seed = seed
  }
  
  return {
    customId,
    request: {
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig
    }
  }
}

export function serializeJsonl(requests: JsonlRequest[]): string {
  return requests.map(r => JSON.stringify(r)).join('\n')
}

export function parseJsonlResponse(content: string): JsonlResponse[] {
  const lines = content.trim().split('\n').filter(line => line.trim())
  return lines.map(line => JSON.parse(line))
}

export async function writeJsonlFile(path: string, requests: JsonlRequest[]): Promise<void> {
  const content = serializeJsonl(requests)
  await writeFile(path, content, 'utf-8')
}

export async function readJsonlFile(path: string): Promise<JsonlResponse[]> {
  const content = await readFile(path, 'utf-8')
  return parseJsonlResponse(content)
}

export function extractImageFromResponse(response: JsonlResponse): {
  success: boolean
  imageData?: string
  mimeType?: string
  error?: string
} {
  if (response.error) {
    return { success: false, error: response.error.message }
  }
  
  if (response.response?.error) {
    return { success: false, error: response.response.error.message }
  }
  
  const candidates = response.response?.candidates
  if (!candidates || candidates.length === 0) {
    return { success: false, error: 'No candidates in response' }
  }
  
  const parts = candidates[0].content?.parts
  if (!parts) {
    return { success: false, error: 'No parts in response' }
  }
  
  for (const part of parts) {
    if (part.inline_data) {
      return {
        success: true,
        imageData: part.inline_data.data,
        mimeType: part.inline_data.mime_type
      }
    }
  }
  
  return { success: false, error: 'No image data in response' }
}
