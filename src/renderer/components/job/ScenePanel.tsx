import React, { useState, useEffect } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import type { Scene, Asset } from '../../../shared/types'
import {
  Plus,
  ChevronRight,
  FolderOpen,
  Image,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  Library,
  Check,
  X
} from 'lucide-react'

export function ScenePanel() {
  const {
    currentJob,
    scenes,
    assets,
    currentScene,
    setCurrentScene,
    createScene,
    deleteScene,
    loadAssetsForScene,
    loadAssetsForJob
  } = useJobStore()
  const { addToast } = useAppStore()

  const [isCreating, setIsCreating] = useState(false)
  const [newSceneName, setNewSceneName] = useState('')
  const [showNewSceneInput, setShowNewSceneInput] = useState(false)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [pickerTargetSceneId, setPickerTargetSceneId] = useState<string | null>(null)

  const handleCreateScene = async () => {
    if (!currentJob || !newSceneName.trim()) return

    setIsCreating(true)
    try {
      const scene = await createScene(currentJob.id, newSceneName.trim())
      setNewSceneName('')
      setShowNewSceneInput(false)
      setCurrentScene(scene)
      addToast(`Created scene: ${scene.name}`, 'success')
    } catch (error) {
      addToast('Failed to create scene', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectScene = async (scene: Scene) => {
    if (!currentJob) return
    setCurrentScene(scene)
    await loadAssetsForScene(currentJob.id, scene.id)
  }

  const handleAddFromLibrary = (sceneId: string) => {
    if (!currentJob) return
    setPickerTargetSceneId(sceneId)
    loadAssetsForJob(currentJob.id) // Load all assets for the picker
    setShowLibraryPicker(true)
  }

  const handleAssignAssets = async (assetIds: string[]) => {
    if (!currentJob || !pickerTargetSceneId) return
    
    try {
      for (const assetId of assetIds) {
        await window.api.invoke('asset:assignToScene', currentJob.id, assetId, pickerTargetSceneId)
      }
      addToast(`Added ${assetIds.length} asset(s) to scene`, 'success')
      
      // Reload scene assets if this is the current scene
      if (currentScene?.id === pickerTargetSceneId) {
        await loadAssetsForScene(currentJob.id, pickerTargetSceneId)
      }
    } catch (error) {
      addToast('Failed to add assets to scene', 'error')
    }
    
    setShowLibraryPicker(false)
    setPickerTargetSceneId(null)
  }

  const handleDeleteScene = async (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentJob) return

    if (confirm(`Delete scene "${scene.name}"? This will remove all assets in this scene.`)) {
      try {
        await deleteScene(currentJob.id, scene.id)
        if (currentScene?.id === scene.id) {
          setCurrentScene(null)
        }
        addToast(`Deleted scene: ${scene.name}`, 'success')
      } catch (error) {
        addToast('Failed to delete scene', 'error')
      }
    }
  }

  // Get unassigned assets (assets not in any scene)
  const unassignedAssets = assets.filter(a => !a.sceneId)

  return (
    <div className="h-full flex flex-col">
      {/* Library Picker Modal */}
      {showLibraryPicker && (
        <LibraryAssetPicker
          assets={unassignedAssets}
          onSelect={handleAssignAssets}
          onClose={() => {
            setShowLibraryPicker(false)
            setPickerTargetSceneId(null)
          }}
        />
      )}

      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-300">Scenes</h3>
          <button
            onClick={() => setShowNewSceneInput(true)}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Add scene"
          >
            <Plus className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {showNewSceneInput && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateScene()}
              placeholder="Scene name..."
              className="flex-1 px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreateScene}
              disabled={isCreating || !newSceneName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded transition-colors"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
            <button
              onClick={() => {
                setShowNewSceneInput(false)
                setNewSceneName('')
              }}
              className="px-2 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Scene List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {scenes.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No scenes yet</p>
            <p className="text-xs mt-1">Scenes group images for multi-angle consistency</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {scenes.map((scene) => (
              <SceneItem
                key={scene.id}
                scene={scene}
                isSelected={currentScene?.id === scene.id}
                onSelect={() => handleSelectScene(scene)}
                onDelete={(e) => handleDeleteScene(scene, e)}
                onAddFromLibrary={() => handleAddFromLibrary(scene.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SceneItem({
  scene,
  isSelected,
  onSelect,
  onDelete,
  onAddFromLibrary
}: {
  scene: Scene
  isSelected: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onAddFromLibrary: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600/20 border border-blue-500/50'
          : 'hover:bg-slate-700/50 border border-transparent'
      }`}
    >
      <div className={`p-1.5 rounded ${isSelected ? 'bg-blue-600/30' : 'bg-slate-700'}`}>
        <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
            {scene.name}
          </span>
          {scene.masterAssetId && (
            <span title="Has master view">
              <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Image className="w-3 h-3" />
          <span>{scene.assetIds.length} assets</span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-600 rounded transition-all"
      >
        <MoreVertical className="w-4 h-4 text-slate-400" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(false)
            }}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onAddFromLibrary()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              <Library className="w-4 h-4" />
              Add from Library
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                // TODO: Implement rename
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              <Edit2 className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={(e) => {
                setShowMenu(false)
                onDelete(e)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Modal picker for selecting Library assets to add to a scene
function LibraryAssetPicker({
  assets,
  onSelect,
  onClose
}: {
  assets: Asset[]
  onSelect: (assetIds: string[]) => void
  onClose: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadThumbnails() {
      const thumbs: Record<string, string> = {}
      for (const asset of assets) {
        try {
          const dataUrl = await window.electronAPI.readImageAsDataURL(asset.originalPath)
          if (dataUrl) thumbs[asset.id] = dataUrl
        } catch (error) {
          console.error('Failed to load thumbnail:', error)
        }
      }
      setThumbnails(thumbs)
    }
    loadThumbnails()
  }, [assets])

  const toggleSelection = (assetId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-medium text-white">Add from Library</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {assets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Library className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No unassigned assets in Library</p>
              <p className="text-xs mt-1">Import photos to Library first</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map(asset => (
                <div
                  key={asset.id}
                  onClick={() => toggleSelection(asset.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    selectedIds.has(asset.id)
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-transparent hover:border-slate-600'
                  }`}
                >
                  {thumbnails[asset.id] ? (
                    <img
                      src={thumbnails[asset.id]}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <Image className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Selection indicator */}
                  {selectedIds.has(asset.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{asset.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <span className="text-sm text-slate-400">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              Add to Scene
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
