export const KIE_IMAGE_MODELS = [
  { id: 'nano-banana-pro', label: 'Nano Banana Pro (Kie.ai) — best quality', family: 'nano-banana', maxImages: 8 },
  { id: 'nano-banana-2', label: 'Nano Banana 2 (Kie.ai)', family: 'nano-banana', maxImages: 14 },
  { id: 'gpt-image-2-5-flare', label: 'ChatGPT Images 2.5 Flare (Kie.ai)', family: 'gpt-image', maxImages: 16 },
  { id: 'gpt-image-2-5-sunburst', label: 'ChatGPT Images 2.5 Sunburst (Kie.ai)', family: 'gpt-image', maxImages: 16 }
] as const

export type KieImageModel = typeof KIE_IMAGE_MODELS[number]

export function getKieImageModel(model: string): KieImageModel | undefined {
  return KIE_IMAGE_MODELS.find(option => option.id === model)
}

export function isKieImageModel(model: string): boolean {
  return Boolean(getKieImageModel(model))
}
