'use client'

import { useEffect, useState } from 'react'
import './customer-portal-rocket-flyover.css'

const SESSION_KEY = 'customerPortalRocketFlyoverPlayed_v1'

type Props = {
  /** Set to false to play on every navigation; default true plays the
   *  flyover one time per browser session. */
  oncePerSession?: boolean
}

// Rocket flyover for the client portal overview. Renders one diagonal
// flight from bottom-left to top-right with a purple-core / white-halo
// trail emanating from the rocket's tail, then unmounts itself once the
// CSS animation finishes (animationend on the flight element).
export default function CustomerPortalRocketFlyover({
  oncePerSession = true,
}: Props) {
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!oncePerSession) return
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
        className="cp-rocket-flyover__flight"
        onAnimationEnd={() => setRemoved(true)}
      >
        <div className="cp-rocket-flyover__halo" />
        <div className="cp-rocket-flyover__trail" />
        {/* Plain <img>: Next/Image's responsive sizing fights the
         *  centering transform. Intrinsic dimensions are pinned so the
         *  rocket has a known box before its bytes arrive. */}
        <img
          src="/customer-portal/rocket.png"
          alt=""
          width={631}
          height={318}
          className="cp-rocket-flyover__rocket"
          draggable={false}
        />
      </div>
    </div>
  )
}
