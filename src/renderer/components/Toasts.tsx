import React, { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export function Toasts() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

interface ToastProps {
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' }
  onDismiss: () => void
}

function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />
  }

  const colors = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30'
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-slate-800 border ${colors[toast.type]} rounded-lg shadow-lg animate-in slide-in-from-right`}>
      {icons[toast.type]}
      <span className="text-sm text-white">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 p-1 text-slate-400 hover:text-white rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
