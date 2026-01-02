import React from 'react'
import { useAppStore, getFilteredImages } from '../store/useAppStore'
import { ImageCard } from './ImageCard'

export function Gallery() {
  const { currentRun, filter, selectedImages, selectAllImages, deselectAllImages } = useAppStore()

  if (!currentRun) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No run selected
      </div>
    )
  }

  const filteredImages = getFilteredImages(currentRun.images, filter)
  const allSelected = filteredImages.length > 0 && 
    filteredImages.every(img => selectedImages.has(img.path))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            {filteredImages.length} images
            {selectedImages.size > 0 && ` • ${selectedImages.size} selected`}
          </span>
          <button
            onClick={allSelected ? deselectAllImages : selectAllImages}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <FilterTabs />
      </div>
      
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        {filteredImages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            No images match the current filter
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredImages.map(image => (
              <ImageCard key={image.path} image={image} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterTabs() {
  const { filter, setFilter, currentRun } = useAppStore()
  
  if (!currentRun) return null

  const counts = {
    all: currentRun.images.length,
    pending: currentRun.images.filter(i => i.status === 'pending').length,
    preview_ready: currentRun.images.filter(i => i.status === 'preview_ready').length,
    approved: currentRun.images.filter(i => i.status === 'approved').length,
    final_ready: currentRun.images.filter(i => i.status === 'final_ready').length,
    error: currentRun.images.filter(i => i.status === 'error').length,
    rejected: currentRun.images.filter(i => i.status === 'rejected').length,
  }

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'preview_ready', label: 'Previewed', count: counts.preview_ready },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'final_ready', label: 'Final', count: counts.final_ready },
    { id: 'error', label: 'Errors', count: counts.error },
  ] as const

  return (
    <div className="flex items-center gap-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setFilter(tab.id)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === tab.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span className="ml-1 opacity-70">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
