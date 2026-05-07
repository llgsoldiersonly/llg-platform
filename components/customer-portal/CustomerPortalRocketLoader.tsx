'use client'

import { useEffect, useState } from 'react'
import './customer-portal-rocket-loader.css'

type Props = {
  /** Minimum visible time in ms — keeps the animation feeling intentional even
   *  when the page loads instantly. */
  minimumLoadTime?: number
  /** Maximum time to wait for window load before hiding regardless. Hard floor
   *  so the loader can't trap a user on a slow request. */
  maxLoadTime?: number
  /** When true (default) the loader only shows once per browser session
   *  (sessionStorage). Returning users to other portal routes don't see it. */
  oncePerSession?: boolean
}

// Versioned: existing browsers may have the v1 flag set from when the
// loader was mounted globally in the (client) layout. Bumping the key
// invalidates those stale flags so the overview-only flyover is seen
// fresh by every returning user.
const SESSION_KEY = 'customerPortalRocketLoaderShown_v2'

// Branded rocket loader for the client portal. Mounted from the (client)
// layout — never global, never admin. Respects prefers-reduced-motion via
// the CSS file (rocket renders centered + static instead of flying).
export default function CustomerPortalRocketLoader({
  minimumLoadTime = 1400,
  maxLoadTime = 5000,
  oncePerSession = true,
}: Props) {
  const [hidden, setHidden] = useState(false)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    // If we've already shown it this session, skip entirely.
    if (oncePerSession && typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY) === 'true') {
          setRemoved(true)
          return
        }
        window.sessionStorage.setItem(SESSION_KEY, 'true')
      } catch {
        // sessionStorage can throw in private mode / sandboxed contexts —
        // safe to ignore and just show the loader.
      }
    }

    const startTime = Date.now()
    let hasFinished = false

    const finishLoading = () => {
      if (hasFinished) return
      hasFinished = true

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minimumLoadTime - elapsed)

      window.setTimeout(() => {
        setHidden(true)
        // Remove from DOM after the fade-out transition completes.
        window.setTimeout(() => setRemoved(true), 600)
      }, remaining)
    }

    if (document.readyState === 'complete') {
      finishLoading()
    } else {
      window.addEventListener('load', finishLoading)
    }

    const fallbackTimer = window.setTimeout(finishLoading, maxLoadTime)

    return () => {
      window.removeEventListener('load', finishLoading)
      window.clearTimeout(fallbackTimer)
    }
  }, [minimumLoadTime, maxLoadTime, oncePerSession])

  if (removed) return null

  return (
    <div
      className={`customer-portal-rocket-loader ${
        hidden ? 'customer-portal-rocket-loader--hidden' : ''
      }`}
      aria-hidden="true"
    >
      {/* The flight wrapper is the single element that carries the
       *  animation — halo, trail, and rocket all live inside it as
       *  static-positioned children, anchored to a common reference
       *  point so they stay perfectly aligned regardless of the
       *  rocket image's intrinsic aspect ratio. */}
      <div className="customer-portal-rocket-loader__flight">
        <div className="customer-portal-rocket-loader__halo" />
        <div className="customer-portal-rocket-loader__trail" />
        {/* Plain <img> — Next/Image's responsive sizing fights the
         *  static centering transform; we want raw position control.
         *  Intrinsic width/height attributes pin the aspect ratio so the
         *  CSS auto-height resolves before the bytes arrive (otherwise
         *  the box can render at 0 height and only the glow shows). */}
        <img
          src="/customer-portal/rocket.png"
          alt=""
          width={631}
          height={318}
          className="customer-portal-rocket-loader__rocket"
          draggable={false}
        />
      </div>
    </div>
  )
}
