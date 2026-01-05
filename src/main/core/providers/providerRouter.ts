import type { IImageProvider } from './IImageProvider'
import { GoogleGeminiProvider } from './GoogleGeminiProvider'
import { OpenRouterProvider } from './OpenRouterProvider'
import { getSettings } from '../settings'

/**
 * Get the configured image provider
 * 
 * API Keys are read from environment variables only (.env file):
 * - GEMINI_API_KEY for Google provider
 * - OPENROUTER_API_KEY for OpenRouter provider
 * 
 * Environment variables:
 * - IMAGE_PROVIDER: 'google' | 'openrouter' (default: 'google')
 * - OPENROUTER_BASE_URL: Base URL for OpenRouter (default: https://openrouter.ai/api/v1)
 * 
 * This ensures API keys are never stored in settings files or git.
 */
export async function getImageProvider(): Promise<IImageProvider> {
  const settings = await getSettings()
  
  // Check env var first, then settings
  const provider = (process.env.IMAGE_PROVIDER as 'google' | 'openrouter') || settings.imageProvider || 'google'
  
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    return new OpenRouterProvider(apiKey, baseUrl)
  }
  
  // Default to Google Gemini
  const apiKey = process.env.GEMINI_API_KEY || ''
  return new GoogleGeminiProvider(apiKey)
}
