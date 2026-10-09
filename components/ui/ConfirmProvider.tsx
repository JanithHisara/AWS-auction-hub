'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  isAlert?: boolean
}

interface ConfirmContextType {
  confirm: (message: string | ReactNode, options?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    message: string | ReactNode
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((message: string | ReactNode, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        isOpen: true,
        message,
        options,
        resolve
      })
    })
  }, [])

  const handleConfirm = () => {
    modalState?.resolve(true)
    setModalState(null)
  }

  const handleCancel = () => {
    modalState?.resolve(false)
    setModalState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {modalState?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCancel}
          />
          <div className="bg-[#1a1a24] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full relative z-10 shadow-2xl animate-bounce-in">
            <h3 className="text-xl font-bold text-white mb-2">
              {modalState.options.title || 'Confirm Action'}
            </h3>
            <p className="text-[var(--text-muted)] mb-6 text-sm whitespace-pre-wrap">
              {modalState.message}
            </p>
            
            <div className="flex gap-3 justify-end">
              {!modalState.options.isAlert && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-white font-medium hover:bg-white/5 transition-colors border border-transparent"
                >
                  {modalState.options.cancelText || 'Cancel'}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  modalState.options.isDestructive 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30'
                    : 'bg-[var(--gold)] text-black hover:bg-[var(--gold-accent)]'
                }`}
              >
                {modalState.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}
