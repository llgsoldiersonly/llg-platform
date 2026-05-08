'use client'

import { useEffect, useState } from 'react'
import './customer-portal-rocket-flyover.css'

const SESSION_KEY = 'customerPortalRocketFlyoverPlayed_v2'

type Props = {
  /** Default true: play once per browser session. Set false to play
   *  on every navigation. */
  oncePerSession?: boolean
}

// Rocket flyover for the client portal overview. Plays one diagonal
// flight from bottom-left to top-right with a purple-core / white-halo
// trail emerging from the rocket's tail, then unmounts itself once the
// CSS animation completes (animationend on the flight group).
//
// Triggers:
// - Once per browser session by default (sessionStorage gate).
// - URL override `?rocket=1` plays it regardless of the gate, so the
//   flyover can be re-triggered from the address bar without DevTools.
export default function CustomerPortalRocketFlyover({
  oncePerSession = true,
}: Props) {
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    // Read `?rocket=1` from window.location instead of useSearchParams
    // so this component doesn't require a Suspense boundary in its
    // server-rendered parent.
    const force =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('rocket') === '1'
    if (force || !oncePerSession) return
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === 'true') {
        setRemoved(true)
        return
      }
      window.sessionStorage.setItem(SESSION_KEY, 'true')
    } catch {
      // sessionStorage can throw in private/sandboxed contexts — safe
      // to ignore and just play the flyover.
    }
  }, [oncePerSession])

  if (removed) return null

  return (
    <div className="cp-rocket-flyover" aria-hidden="true">
      <div
        className="cp-rocket-flyover__group"
        onAnimationEnd={() => setRemoved(true)}
      >
        <div className="cp-rocket-flyover__halo" />
        <div className="cp-rocket-flyover__trail" />
        {/* Plain <img> with explicit pixel dimensions on both axes —
         *  no aspect-ratio dependency, so the box is sized correctly
         *  before the bytes arrive (avoids the "trail glows but
         *  rocket is invisible" failure mode). */}
        <img
          src="/customer-portal/rocket.png"
          alt=""
          width={180}
          height={90}
          className="cp-rocket-flyover__rocket"
          draggable={false}
        />
      </div>
    </div>
  )
}
