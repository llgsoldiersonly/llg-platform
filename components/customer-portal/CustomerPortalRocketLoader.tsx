'use client'

import './customer-portal-rocket-loader.css'

type Props = {
  /** Minimum visible time in ms — currently unused while in always-render
   *  troubleshooting mode. */
  minimumLoadTime?: number
  /** Max time to wait before hiding — currently unused. */
  maxLoadTime?: number
  /** Once-per-session flag — currently unused. */
  oncePerSession?: boolean
}

// TROUBLESHOOTING MODE: visibility/timing logic stripped so the wrapper
// renders unconditionally and stays in the DOM. Once we confirm the rocket
// image is visible we'll restore the auto-hide + sessionStorage behavior.
export default function CustomerPortalRocketLoader(_props: Props = {}) {
  return (
    <div
      className="customer-portal-rocket-loader"
      data-debug-rocket-loader="always-on"
      aria-hidden="true"
    >
      <div className="customer-portal-rocket-loader__flight">
        <div className="customer-portal-rocket-loader__halo" />
        <div className="customer-portal-rocket-loader__trail" />
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
