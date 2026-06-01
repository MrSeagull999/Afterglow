import React, { useEffect, useState } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useAppStore } from '../store/useAppStore'
import type { Job } from '../../shared/types'
import {
  Plus,
  FolderOpen,
  Search,
  MoreVertical,
  Trash2,
  Edit2,
  Calendar,
  Image,
  Loader2
} from 'lucide-react'

export function JobsHome() {
  const { jobs, loadJobs, createJob, deleteJob, setCurrentJob, isLoadingJobs } = useJobStore()
  const { setView, addToast } = useAppStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadJobs()
  }, [])

  const filteredJobs = jobs.filter(
    (job) =>
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.metadata.address?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateJob = async (name: string, address?: string) => {
    try {
      const job = await createJob(name, { address })
      setCurrentJob(job)
      setView('job')
      addToast(`Created job: ${name}`, 'success')
    } catch (error) {
      addToast('Failed to create job', 'error')
    }
  }

  const handleOpenJob = (job: Job) => {
    setCurrentJob(job)
    setView('job')
  }

  const handleDeleteJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Delete "${job.name}"? This cannot be undone.`)) {
      try {
        await deleteJob(job.id)
        addToast(`Deleted: ${job.name}`, 'success')
      } catch (error) {
        addToast('Failed to delete job', 'error')
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 p-6 border-b border-slate-700">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Jobs</h1>
              <p className="text-slate-400 mt-1">Manage your property transformation projects</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Job
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </header>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="max-w-6xl mx-auto">
          {isLoadingJobs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              {searchQuery ? (
                <>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No jobs found</h3>
                  <p className="text-slate-500">Try a different search term</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No jobs yet</h3>
                  <p className="text-slate-500 mb-4">Create your first job to get started</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Create Job
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => handleOpenJob(job)}
                  onDelete={(e) => handleDeleteJob(job, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateJob}
        />
      )}
    </div>
  )
}

function JobCard({
  job,
  onClick,
  onDelete
}: {
  job: Job
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      onClick={onClick}
      className="group relative bg-slate-800 rounded-xl p-4 cursor-pointer hover:bg-slate-750 border border-slate-700 hover:border-slate-600 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{job.name}</h3>
          {job.metadata.address && (
            <p className="text-sm text-slate-400 truncate mt-0.5">{job.metadata.address}</p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded-lg transition-all"
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
            <div className="absolute right-4 top-12 z-20 bg-slate-700 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[120px]">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  // TODO: Implement edit
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  setShowMenu(false)
                  onDelete(e)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-600"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-1.5">
          <Image className="w-4 h-4" />
          <span>{job.sceneIds.length} scenes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}

function CreateJobModal({
  onClose,
  onCreate
}: {
  onClose: () => void
  onCreate: (name: string, address?: string) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsCreating(true)
    await onCreate(name.trim(), address.trim() || undefined)
    setIsCreating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Create New Job</h2>
          <p className="text-sm text-slate-400 mt-1">Start a new property transformation project</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Job Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 123 Main Street"
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Address (optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full property address"
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              {isCreating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
