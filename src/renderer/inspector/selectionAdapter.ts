export interface InspectorSelection {
  selectedAssetIds: string[]
  isBatch: boolean
}

export function makeInspectorSelection(selectedAssetIds: Iterable<string>): InspectorSelection {
  const ids = Array.from(selectedAssetIds)
  return {
    selectedAssetIds: ids,
    isBatch: ids.length > 1
  }
}
