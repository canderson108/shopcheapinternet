"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

// Consent-aware analytics. Google tags load in Consent Mode v2 with everything denied by default;
// Meta Pixel loads only after the visitor accepts. Event helpers are in src/lib/track.ts.

const GA4 = process.env.NEXT_PUBLIC_GA4_ID;
const GTM = process.env.NEXT_PUBLIC_GTM_ID;
const ADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CONSENT_KEY = "sci_consent";

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function Analytics() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const anyTag = Boolean(GA4 || GTM || ADS || META);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || consent !== "granted") return;
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.("consent", "update", { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  }, [consent, ready]);

  function choose(v: "granted" | "denied") {
    try {
      window.localStorage.setItem(CONSENT_KEY, v);
    } catch {
      /* storage unavailable */
    }
    setConsent(v);
  }

  if (!anyTag) return null;
  const gtagId = GA4 ?? ADS;

  return (
    <>
      {(gtagId || GTM) && (
        <Script id="consent-defaults" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});
gtag('js',new Date());${GA4 ? `gtag('config','${GA4}');` : ""}${ADS ? `gtag('config','${ADS}');` : ""}`}
        </Script>
      )}
      {gtagId && <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />}
      {GTM && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');`}
        </Script>
      )}
      {META && consent === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META}');fbq('track','PageView');`}
        </Script>
      )}
      {ready && consent === null && (
        <div role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-4">
          <p className="text-sm text-slate-700">
            We use cookies to measure our site and ads. Essential cookies are always on. See our{" "}
            <a href="/legal/privacy" className="font-semibold text-mint-700 underline">privacy policy</a>.
          </p>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <button className="btn-outline btn-sm" onClick={() => choose("denied")}>Decline</button>
            <button className="btn-primary btn-sm" onClick={() => choose("granted")}>Accept</button>
          </div>
        </div>
      )}
    </>
  );
}
