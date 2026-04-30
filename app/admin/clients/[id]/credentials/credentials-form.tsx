'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { saveCredentials, type CredentialFields } from '@/lib/actions/credentials'

type Initial = Partial<CredentialFields>

export function CredentialsForm({
  clientId,
  initial,
}: {
  clientId: string
  initial: Initial
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMessage(null)
    const input: CredentialFields = {
      client_id: clientId,
      wp_username: formData.get('wp_username') as string | null,
      wp_app_password: formData.get('wp_app_password') as string | null,
      wp_language_method: (formData.get('wp_language_method') as CredentialFields['wp_language_method']) ?? 'none',
      wp_language_en_value: formData.get('wp_language_en_value') as string | null,
      wp_language_es_value: formData.get('wp_language_es_value') as string | null,
      callrail_account_id: formData.get('callrail_account_id') as string | null,
      callrail_company_id: formData.get('callrail_company_id') as string | null,
      metricool_user_id: formData.get('metricool_user_id') as string | null,
      metricool_blog_id: formData.get('metricool_blog_id') as string | null,
      brightlocal_client_id: formData.get('brightlocal_client_id') as string | null,
      ga4_property_url: formData.get('ga4_property_url') as string | null,
      ga4_property_id: formData.get('ga4_property_id') as string | null,
      google_ads_account_url: formData.get('google_ads_account_url') as string | null,
      google_ads_customer_id: formData.get('google_ads_customer_id') as string | null,
      lsa_account_url: formData.get('lsa_account_url') as string | null,
      gsc_property_url: formData.get('gsc_property_url') as string | null,
      gsc_resource_id: formData.get('gsc_resource_id') as string | null,
    }
    startTransition(async () => {
      const result = await saveCredentials(input)
      if (result.ok) {
        setMessage({ kind: 'success', text: 'Saved.' })
      } else {
        setMessage({ kind: 'error', text: result.error.message })
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-8">
      <Section title="WordPress">
        <Field label="Username" name="wp_username" defaultValue={initial.wp_username ?? ''} />
        <Field
          label="App password"
          name="wp_app_password"
          defaultValue={initial.wp_app_password ?? ''}
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          help="Generate from WP Admin → Users → Profile → Application Passwords"
        />
        <div className="space-y-2">
          <Label htmlFor="wp_language_method">Language detection method</Label>
          <Select id="wp_language_method" name="wp_language_method" defaultValue={initial.wp_language_method ?? 'none'}>
            <option value="none">None (manual marking)</option>
            <option value="polylang">Polylang plugin</option>
            <option value="wpml">WPML plugin</option>
            <option value="category">Category slug</option>
            <option value="tag">Tag slug</option>
            <option value="path">URL path prefix (/es/, etc.)</option>
          </Select>
          <p className="text-xs text-slate-600">
            How EN vs ES posts get identified for BLOG_EN / BLOG_ES auto-tracking.
          </p>
        </div>
        <Field label="EN value" name="wp_language_en_value" defaultValue={initial.wp_language_en_value ?? ''} placeholder="en, english, /en/" />
        <Field label="ES value" name="wp_language_es_value" defaultValue={initial.wp_language_es_value ?? ''} placeholder="es, spanish, /es/" />
      </Section>

      <Section title="CallRail">
        <Field
          label="Account ID"
          name="callrail_account_id"
          defaultValue={initial.callrail_account_id ?? ''}
          help="Leave blank to use the shared LLG account (CALLRAIL_DEFAULT_ACCOUNT_ID env var)."
        />
        <Field
          label="Company ID *"
          name="callrail_company_id"
          defaultValue={initial.callrail_company_id ?? ''}
          help="Required — scopes calls to this client within the shared account."
        />
      </Section>

      <Section title="Metricool">
        <Field label="User ID" name="metricool_user_id" defaultValue={initial.metricool_user_id ?? ''} />
        <Field label="Blog ID" name="metricool_blog_id" defaultValue={initial.metricool_blog_id ?? ''} />
      </Section>

      <Section title="BrightLocal">
        <Field
          label="Client ID"
          name="brightlocal_client_id"
          defaultValue={initial.brightlocal_client_id ?? ''}
          help="Set automatically by scripts/setup-brightlocal.ts in Phase 8"
        />
      </Section>

      <Section title="External tool URLs (admin click-outs only — clients never see these)">
        <Field label="GA4 property URL" name="ga4_property_url" defaultValue={initial.ga4_property_url ?? ''} placeholder="https://analytics.google.com/..." />
        <Field label="GA4 property ID" name="ga4_property_id" defaultValue={initial.ga4_property_id ?? ''} />
        <Field label="Google Ads account URL" name="google_ads_account_url" defaultValue={initial.google_ads_account_url ?? ''} />
        <Field label="Google Ads customer ID" name="google_ads_customer_id" defaultValue={initial.google_ads_customer_id ?? ''} />
        <Field label="LSA account URL" name="lsa_account_url" defaultValue={initial.lsa_account_url ?? ''} />
        <Field label="Search Console property URL" name="gsc_property_url" defaultValue={initial.gsc_property_url ?? ''} />
        <Field label="Search Console resource ID" name="gsc_resource_id" defaultValue={initial.gsc_resource_id ?? ''} />
      </Section>

      <div className="flex items-center justify-between border-t border-slate-200 pt-6">
        <div>
          {message && (
            <p
              className={
                message.kind === 'success'
                  ? 'text-sm text-emerald-700'
                  : 'text-sm text-red-700'
              }
            >
              {message.text}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save credentials'}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-slate-900">{title}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  help,
}: {
  label: string
  name: string
  defaultValue: string
  placeholder?: string
  help?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
      {help && <p className="text-xs text-slate-600">{help}</p>}
    </div>
  )
}
