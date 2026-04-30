'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-12 text-center">
      <AlertTriangle className="h-10 w-10 text-fg-warning-subtle" />
      <h1 className="text-xl font-semibold text-heading">Something went wrong</h1>
      <p className="text-sm text-body">
        This page failed to load. Our team has been notified.
        {error.digest && (
          <span className="mt-2 block font-mono text-[10px] text-body-subtle">
            ref: {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
        <Button onClick={() => (window.location.href = '/admin/dashboard')} variant="outline">
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
