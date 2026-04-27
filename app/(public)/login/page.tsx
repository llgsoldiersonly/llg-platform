'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

function LoginForm() {
  const params = useSearchParams()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(
    params.get('error') === 'forbidden'
      ? "You don't have access to this surface."
      : null
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()
    const next = params.get('next') ?? '/'
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      setServerError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to LLG Platform</CardTitle>
        <CardDescription>
          We'll email you a magic link. No password to remember.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900">
            Check your email for the sign-in link. You can close this tab.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@firm.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
