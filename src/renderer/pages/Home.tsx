import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ListingPicker } from '../components/ListingPicker'
import { RunsTable } from '../components/RunsTable'
import { PresetSelector } from '../components/PresetPicker'
import { Loader2 } from 'lucide-react'

export function Home() {
  const { 
    setCurrentRun, 
    setCurrentRunId, 
    setView, 
    selectedPresetId,
    addToast,
    setRuns
  } = useAppStore()
  
  const [isCreating, setIsCreating] = useState(false)

  const handleSelectListing = async (path: string, name: string) => {
    setIsCreating(true)
    
    try {
      const images = await window.electronAPI.scanDirectory(path)
      
      if (images.length === 0) {
        addToast('No images found in selected folder', 'error')
        setIsCreating(false)
        return
      }

      const imageEntries = images.map((img: any) => ({
        path: img.path,
        name: img.name,
        status: 'pending',
        presetId: selectedPresetId
      }))

      const run = await window.electronAPI.createRun({
        inputDir: path,
        listingName: name,
        images: imageEntries,
        defaultPresetId: selectedPresetId
      })

      const runs = await window.electronAPI.listRuns()
      setRuns(runs)
      
      setCurrentRun(run)
      setCurrentRunId(run.id)
      setView('run')
      
      addToast(`Created run with ${images.length} images`, 'success')
    } catch (error) {
      console.error('Failed to create run:', error)
      addToast('Failed to create run', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-slate-700 p-4 space-y-4 overflow-auto">
        <PresetSelector />
      </aside>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">New Run</h2>
            {isCreating ? (
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 border border-slate-600 rounded-lg">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="text-slate-300">Scanning folder...</span>
              </div>
            ) : (
              <ListingPicker onSelect={handleSelectListing} />
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Recent Runs</h2>
            <RunsTable />
          </section>
        </div>
      </div>
    </div>
  )
}
