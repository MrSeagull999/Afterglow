export type ResolvedProvider = 'openrouter' | 'gemini'
export type ProviderResolvedBy = 'ui' | 'env_override'

export interface ResolvedProviderConfig {
  provider: ResolvedProvider
  model: string
  endpointBaseUrl: string
  resolvedBy: ProviderResolvedBy
  envOverride?: { key: string; value: string }
}

export function getResolvedProviderConfig(params: {
  uiProvider?: 'google' | 'openrouter' | 'gemini'
  intendedModel: string
  env?: Record<string, string | undefined>
}): ResolvedProviderConfig {
  const env = params.env || {}

  const uiProviderRaw = params.uiProvider || 'google'
  const uiProvider: ResolvedProvider = uiProviderRaw === 'openrouter' ? 'openrouter' : 'gemini'

  const envProviderRaw = env.IMAGE_PROVIDER

  let provider: ResolvedProvider = uiProvider
  let resolvedBy: ProviderResolvedBy = 'ui'
  let envOverride: { key: string; value: string } | undefined

  if (envProviderRaw) {
    const normalized = envProviderRaw.toLowerCase()
    if (normalized === 'openrouter' || normalized === 'gemini' || normalized === 'google') {
      provider = normalized === 'openrouter' ? 'openrouter' : 'gemini'
      resolvedBy = 'env_override'
      envOverride = { key: 'IMAGE_PROVIDER', value: envProviderRaw }
    }
  }

  const endpointBaseUrl = provider === 'openrouter'
    ? (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1')
    : 'https://generativelanguage.googleapis.com/v1beta'

  return {
    provider,
    model: params.intendedModel,
    endpointBaseUrl,
    resolvedBy,
    ...(envOverride ? { envOverride } : {})
  }
}
