import React from 'react'
import { FolderOpen } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface ListingPickerProps {
  onSelect: (path: string, name: string) => void
}

export function ListingPicker({ onSelect }: ListingPickerProps) {
  const { addToast } = useAppStore()

  const handleSelectFolder = async () => {
    try {
      const path = await window.electronAPI.openDirectory()
      if (path) {
        const name = path.split('/').pop() || 'Untitled'
        onSelect(path, name)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
      addToast('Failed to select folder', 'error')
    }
  }

  return (
    <button
      onClick={handleSelectFolder}
      className="flex items-center gap-3 px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-500 rounded-lg transition-all group"
    >
      <div className="p-3 bg-slate-700 group-hover:bg-blue-600 rounded-lg transition-colors">
        <FolderOpen className="w-6 h-6 text-slate-300 group-hover:text-white" />
      </div>
      <div className="text-left">
        <div className="font-medium text-white">Select Listing Folder</div>
        <div className="text-sm text-slate-400">Choose a folder containing property photos</div>
      </div>
    </button>
  )
}
