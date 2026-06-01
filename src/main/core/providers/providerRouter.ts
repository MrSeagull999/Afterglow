import type { IImageProvider } from './IImageProvider'
import { GoogleGeminiProvider } from './GoogleGeminiProvider'
import { OpenRouterProvider } from './OpenRouterProvider'
import { getSettings } from '../settings'
import { getResolvedProviderConfig } from '../../../shared/services/provider/resolvedProviderConfig'

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
export async function getResolvedImageProvider(intendedModel: string): Promise<{ provider: IImageProvider; resolved: ReturnType<typeof getResolvedProviderConfig> }> {
  const settings = await getSettings()

  const resolved = getResolvedProviderConfig({
    uiProvider: settings.imageProvider,
    intendedModel,
    env: process.env
  })

  if (resolved.provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    return {
      resolved,
      provider: new OpenRouterProvider(apiKey, resolved.endpointBaseUrl)
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || ''
  return {
    resolved,
    provider: new GoogleGeminiProvider(apiKey)
  }
}

export async function getImageProvider(): Promise<IImageProvider> {
  const settings = await getSettings()
  const { provider } = await getResolvedImageProvider(settings.previewImageModel || settings.previewModel)
  return provider
}
