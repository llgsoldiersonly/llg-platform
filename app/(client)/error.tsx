'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function ClientPortalError({
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
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600">
        This page failed to load. Please try again, or contact your account manager
        if it keeps happening.
        {error.digest && (
          <span className="mt-2 block font-mono text-[10px] text-slate-500">
            ref: {error.digest}
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
        <Button onClick={() => (window.location.href = '/overview')} variant="outline">
          Back to overview
        </Button>
      </div>
    </div>
  )
}
