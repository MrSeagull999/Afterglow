import React, { useState } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import type { Scene } from '../../../shared/types'
import {
  Plus,
  ChevronRight,
  FolderOpen,
  Image,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2
} from 'lucide-react'

export function ScenePanel() {
  const {
    currentJob,
    scenes,
    currentScene,
    setCurrentScene,
    createScene,
    deleteScene,
    loadAssetsForScene
  } = useJobStore()
  const { addToast } = useAppStore()

  const [isCreating, setIsCreating] = useState(false)
  const [newSceneName, setNewSceneName] = useState('')
  const [showNewSceneInput, setShowNewSceneInput] = useState(false)

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

  return (
    <div className="h-full flex flex-col">
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
            <p className="text-xs mt-1">Create a scene to organize your images</p>
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
  onDelete
}: {
  scene: Scene
  isSelected: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
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
