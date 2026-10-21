import { useEffect, useRef, useState } from 'react'
import { ADSENSE_CONFIG } from '../lib/plans.config'
import { useShop } from '../lib/ShopContext'

/**
 * Reusable Google AdSense Banner Component
 * Strictly displays ONLY for Free plan users on permitted pages.
 * - Max 1 unit per page below content
 * - Responsive container (max 728px, min-height 90px desktop / 50px mobile to prevent CLS)
 * - Lazy-loaded with IntersectionObserver near viewport
 * - Non-personalized ads requested
 * - Print styles hide automatically (@media print)
 */
export default function AdBanner({ slotId, pageName = 'Page' }) {
  const { shop, plan } = useShop()
  const adRef = useRef(null)
  const pushedRef = useRef(false)
  const [isVisible, setIsVisible] = useState(false)

  // VITE_ADS_ENABLED defaults to true unless explicitly 'false'
  const adsFlag = import.meta.env.VITE_ADS_ENABLED
  const adsEnabled = adsFlag === undefined || adsFlag === '' || adsFlag === 'true'
  const isDev = import.meta.env.DEV

  // STRICT RULE: Show ads ONLY on Free plan!
  if (!shop || plan?.key !== 'free') {
    return null
  }

  useEffect(() => {
    if (!adRef.current) return

    // Lazy load with IntersectionObserver: activate only when within 250px of viewport
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px 0px' }
    )

    observer.observe(adRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || pushedRef.current) return

    if (!adsEnabled) {
      return
    }

    // Inject AdSense script once if not already present
    const existingScript = document.querySelector(`script[src*="${ADSENSE_CONFIG.publisherId}"]`)
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = ADSENSE_CONFIG.scriptUrl
      script.async = true
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }

    try {
      // Guard against double push in React StrictMode
      if (typeof window !== 'undefined') {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        pushedRef.current = true
      }
    } catch (e) {
      console.warn('AdSense push notice:', e)
    }
  }, [isVisible, adsEnabled])

  const actualSlot = ADSENSE_CONFIG.slots[slotId] || slotId

  return (
    <div
      ref={adRef}
      className="ad-container"
      style={{
        maxWidth: 728,
        width: '100%',
        margin: '32px auto 16px',
        padding: '0 8px',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="ad-label"
        style={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted, #64748b)',
          marginBottom: 6,
        }}
      >
        Advertisement
      </div>

      <div
        className="ad-slot"
        style={{
          minHeight: 90,
          background: isDev && !adsEnabled ? '#f8fafc' : 'transparent',
          border: isDev && !adsEnabled ? '1px dashed #cbd5e1' : 'none',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {isDev && !adsEnabled ? (
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', padding: 16 }}>
            📢 Ad placeholder ({pageName} · Slot {actualSlot})
            <div style={{ fontSize: '0.7rem', marginTop: 4 }}>
              Set VITE_ADS_ENABLED=true in production to load Google AdSense
            </div>
          </div>
        ) : (
          isVisible && (
            <ins
              className="adsbygoogle"
              style={{ display: 'block', minHeight: 90 }}
              data-ad-client={ADSENSE_CONFIG.publisherId}
              data-ad-slot={actualSlot}
              data-ad-format="horizontal"
              data-full-width-responsive="false"
            />
          )
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .ad-slot {
            min-height: 50px !important;
          }
        }
        @media print {
          .ad-container, .ad-slot, .ad-label {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
