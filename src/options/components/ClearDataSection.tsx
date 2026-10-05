import React, { useState } from 'react'
import { clearAll } from '../../shared/storage'
import { AlertTriangle } from 'lucide-react'

export function ClearDataSection({ onCleared }: { onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false)

  const handleClear = async () => {
    if (confirming) {
      await clearAll()
      onCleared()
      setConfirming(false)
    } else {
      setConfirming(true)
    }
  }

  return (
    <section className="section" style={{ borderColor: 'var(--bg-danger)' }}>
      <div className="flex-gap mb-4">
        <AlertTriangle className="text-danger" size={24} />
        <h2 style={{ margin: 0, border: 'none', padding: 0, color: 'var(--text-danger)' }}>Danger Zone</h2>
      </div>
      
      <p className="text-sm">
        Clearing data removes your profile and API key from this browser. This action cannot be undone.
      </p>
      
      <div className="mt-4">
        <button 
          type="button" 
          className="btn btn-danger" 
          onClick={() => {
            void handleClear()
          }}
        >
          {confirming ? 'Are you sure? Click again to delete' : 'Clear All Data'}
        </button>
        {confirming && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ marginLeft: '1rem' }}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  )
}
