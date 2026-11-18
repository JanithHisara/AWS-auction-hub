import { Suspense } from 'react'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-white">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
