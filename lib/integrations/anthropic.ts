// Anthropic SDK wrapper — singleton client + helper for the monthly-report
// executive summary. Other Claude API usage in the platform should compose on
// top of this rather than re-instantiating the SDK.

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}
