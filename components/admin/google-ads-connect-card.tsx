import Link from 'next/link'
import { Megaphone, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = {
  /** Whether platform_settings already has a refresh token saved. */
  isConnected: boolean
  /** Optional flash from the OAuth callback redirect. */
  flash?: { kind: 'success' | 'error'; detail?: string } | null
}

// One-time agency setup. Super-admin clicks "Connect" -> Google OAuth ->
// callback writes the refresh token to platform_settings. After that
// every per-client API call reuses the same token.
export function GoogleAdsConnectCard({ isConnected, flash }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-body-subtle" />
          Google Ads connection
          {isConnected && (
            <Badge variant="success" className="ml-1">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-body">
          Authorize the LLG portal to read campaign data from your Google Ads MCC.
          One-time agency setup — applies to every linked client account.
        </p>

        {flash?.kind === 'success' && (
          <p className="rounded-card border border-border-success-subtle bg-success-soft px-3 py-2 text-xs text-fg-success-strong">
            Connected. Refresh token saved — campaign data will start flowing on
            the next cron run.
          </p>
        )}
        {flash?.kind === 'error' && (
          <p className="rounded-card border border-border-danger-subtle bg-danger-soft px-3 py-2 text-xs text-fg-danger-strong">
            Connection failed{flash.detail ? `: ${flash.detail}` : ''}. Try again.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Link href="/api/auth/google-ads/start">
            <Button>{isConnected ? 'Re-connect Google Ads' : 'Connect Google Ads'}</Button>
          </Link>
          {isConnected && (
            <span className="text-xs text-body-subtle">
              Re-connecting issues a fresh refresh token.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
