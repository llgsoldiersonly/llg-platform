import './customer-portal-scene-background.css'

// Decorative space scene painted behind every client portal route. Mounted
// from app/(client)/layout.tsx as a sibling of the rocket flyover loader.
// All children are absolutely positioned within a fixed full-viewport stage,
// so the scene stays put as widgets scroll over it. Pointer events disabled
// so it never interferes with clicks. aria-hidden because it's pure
// decoration — screen readers should skip it.
export function CustomerPortalSceneBackground() {
  return (
    <div className="cp-scene" aria-hidden="true">
      <div className="cp-scene__stars" />
      <img
        src="/customer-portal/llgportalsaturn.png"
        alt=""
        className="cp-scene__saturn"
        draggable={false}
      />
      <img
        src="/customer-portal/llgportalrocket.png"
        alt=""
        className="cp-scene__rocket"
        draggable={false}
      />
      <img
        src="/customer-portal/llgportalground.png"
        alt=""
        className="cp-scene__ground"
        draggable={false}
      />
      <img
        src="/customer-portal/llgportalpics.png"
        alt=""
        className="cp-scene__astronaut"
        draggable={false}
      />
    </div>
  )
}

export default CustomerPortalSceneBackground
