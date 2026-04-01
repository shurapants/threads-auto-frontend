import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, wide = false, full = false }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full flex flex-col
          ${full
            ? 'max-w-[80vw] h-[90vh]'
            : wide
              ? 'max-w-2xl max-h-[90vh]'
              : 'max-w-md max-h-[90vh]'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="font-semibold text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
