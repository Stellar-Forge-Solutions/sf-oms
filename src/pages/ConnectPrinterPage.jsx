import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PLAY_URL = 'https://play.google.com/store/apps/details?id=mate.bluetoothprint&referrer=utm_source%3Dwebsite%26utm_medium%3Dhero'
const APPLE_URL = 'https://apps.apple.com/id/app/bluetooth-thermal-printer/id1599863946'
const LANG_KEY = 'sf_orders_printer_lang'

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
]

const T = {
  en: {
    back: '← Back',
    title: 'Connect Printer',
    subtitle: 'Print bills on your Bluetooth thermal printer in 3 simple steps. This is a one-time setup.',
    before: 'Before you start',
    beforeList: [
      'Keep your Bluetooth thermal printer (58 mm or 80 mm) ready with paper loaded.',
      'Switch the printer ON and keep it near your phone.',
      'Use the same phone you use for billing.',
    ],
    stepWord: 'Step',
    steps: [
      {
        title: 'Install the printing app',
        desc: 'Download the free "Bluetooth Thermal Printer" app on your phone. It sends the bill from this website to your printer.',
        points: [
          'Android phone: install from Play Store.',
          'iPhone: install from App Store.',
          'Open the app once after installing and allow the permissions it asks for.',
        ],
      },
      {
        title: 'Open an order and tap Thermal printer',
        desc: 'Create an order, open it, then tap the “Thermal printer” button under Bill.',
        points: [
          'Your phone may ask "Open in Bluetooth Print app?" — tap Open / Allow.',
          'If it does not open, check that the app from Step 1 is installed.',
          'Tip: make a small test order first (for example 1 item).',
        ],
      },
      {
        title: 'Turn on Bluetooth and select your printer',
        desc: 'The first time you print, the app will ask you to enable Bluetooth and choose your printer. You only do this once.',
        points: [
          'Tap Allow / Turn on when it asks for Bluetooth (and Nearby devices or Location on Android).',
          'Select your printer from the list. If you do not see it, make sure the printer is ON.',
          'If it asks for a pairing code, try 0000 or 1234 (check your printer manual).',
          'After this, every bill prints directly with one tap.',
        ],
      },
    ],
    storeTitle: 'Download the app',
    play: 'Get it on Play Store',
    apple: 'Download on App Store',
    helpTitle: 'Not printing? Quick fixes',
    help: [
      'Make sure the printer is ON, has paper, and Bluetooth is ON in your phone.',
      'Close the printing app fully and try Print again.',
      'Match the paper size (58 mm or 80 mm) in Settings → Thermal printer paper.',
      'Move the phone closer to the printer and try again.',
      'Still stuck? Contact Stellar Forge support.',
    ],
    cta: '🧾 New Order',
  },
  hi: {
    back: '← वापस',
    title: 'प्रिंटर कनेक्ट करें',
    subtitle: 'अपने ब्लूटूथ थर्मल प्रिंटर पर बिल प्रिंट करने के 3 आसान स्टेप। यह सेटअप सिर्फ एक बार करना है।',
    before: 'शुरू करने से पहले',
    beforeList: [
      'अपना ब्लूटूथ थर्मल प्रिंटर (58 mm या 80 mm) कागज़ डालकर तैयार रखें।',
      'प्रिंटर चालू करें और उसे फ़ोन के पास रखें।',
      'वही फ़ोन इस्तेमाल करें जिससे आप बिलिंग करते हैं।',
    ],
    stepWord: 'स्टेप',
    steps: [
      {
        title: 'प्रिंटिंग ऐप इंस्टॉल करें',
        desc: 'अपने फ़ोन में फ्री "Bluetooth Thermal Printer" ऐप डाउनलोड करें। यह ऐप इस वेबसाइट से बिल को आपके प्रिंटर तक पहुँचाता है।',
        points: [
          'Android फ़ोन: Play Store से इंस्टॉल करें।',
          'iPhone: App Store से इंस्टॉल करें।',
          'इंस्टॉल के बाद ऐप एक बार खोलें और जो अनुमतियाँ (permissions) मांगे वो दें।',
        ],
      },
      {
        title: 'बिल बनाएँ और Print दबाएँ',
        desc: 'New Order पर जाएँ, ग्राहक और आइटम जोड़ें, फिर Print बटन दबाएँ।',
        points: [
          'फ़ोन पूछ सकता है "Bluetooth Print ऐप में खोलें?" — Open / Allow दबाएँ।',
          'अगर ऐप नहीं खुलता, तो जाँचें कि स्टेप 1 वाला ऐप इंस्टॉल है।',
          'सुझाव: पहले एक छोटा टेस्ट बिल बनाएँ (जैसे 1 आइटम)।',
        ],
      },
      {
        title: 'ब्लूटूथ चालू करें और प्रिंटर चुनें',
        desc: 'पहली बार प्रिंट करने पर ऐप ब्लूटूथ चालू करने और प्रिंटर चुनने को कहेगा। यह सिर्फ एक बार करना है।',
        points: [
          'ब्लूटूथ (और Android में Nearby devices या Location) की अनुमति मांगे तो Allow / Turn on दबाएँ।',
          'सूची में से अपना प्रिंटर चुनें। न दिखे तो जाँचें कि प्रिंटर चालू है।',
          'अगर पेयरिंग कोड मांगे तो 0000 या 1234 आज़माएँ (प्रिंटर के मैनुअल में देखें)।',
          'इसके बाद हर बिल सिर्फ एक टैप में सीधे प्रिंट होगा।',
        ],
      },
    ],
    storeTitle: 'ऐप डाउनलोड करें',
    play: 'Play Store से पाएँ',
    apple: 'App Store से डाउनलोड करें',
    helpTitle: 'प्रिंट नहीं हो रहा? आसान उपाय',
    help: [
      'प्रिंटर चालू हो, उसमें कागज़ हो और फ़ोन में ब्लूटूथ चालू हो — यह जाँचें।',
      'प्रिंटिंग ऐप को पूरी तरह बंद करके दोबारा Print दबाएँ।',
      'Settings → Thermal printer paper में कागज़ का साइज़ (58 mm या 80 mm) सही रखें।',
      'फ़ोन को प्रिंटर के पास लाकर फिर कोशिश करें।',
      'फिर भी न हो तो Stellar Forge सपोर्ट से संपर्क करें।',
    ],
    cta: '🧾 नया बिल शुरू करें',
  },
  mr: {
    back: '← मागे',
    title: 'प्रिंटर कनेक्ट करा',
    subtitle: 'तुमच्या ब्लूटूथ थर्मल प्रिंटरवर बिल प्रिंट करण्यासाठी 3 सोपे स्टेप्स. हे सेटअप फक्त एकदाच करायचे आहे.',
    before: 'सुरू करण्यापूर्वी',
    beforeList: [
      'तुमचा ब्लूटूथ थर्मल प्रिंटर (58 mm किंवा 80 mm) कागद घालून तयार ठेवा.',
      'प्रिंटर चालू करा आणि फोनजवळ ठेवा.',
      'बिलिंगसाठी वापरता तोच फोन वापरा.',
    ],
    stepWord: 'स्टेप',
    steps: [
      {
        title: 'प्रिंटिंग ॲप इन्स्टॉल करा',
        desc: 'तुमच्या फोनमध्ये मोफत "Bluetooth Thermal Printer" ॲप डाउनलोड करा. हे ॲप या वेबसाइटवरून बिल तुमच्या प्रिंटरपर्यंत पोहोचवते.',
        points: [
          'Android फोन: Play Store वरून इन्स्टॉल करा.',
          'iPhone: App Store वरून इन्स्टॉल करा.',
          'इन्स्टॉल केल्यानंतर ॲप एकदा उघडा आणि मागितलेल्या परवानग्या (permissions) द्या.',
        ],
      },
      {
        title: 'बिल तयार करा आणि Print दाबा',
        desc: 'New Order वर जा, ग्राहक आणि आयटम जोडा, मग Print बटण दाबा.',
        points: [
          'फोन विचारू शकतो "Bluetooth Print ॲपमध्ये उघडायचे?" — Open / Allow दाबा.',
          'ॲप उघडले नाही तर स्टेप 1 मधील ॲप इन्स्टॉल आहे का ते तपासा.',
          'टीप: आधी एक छोटे टेस्ट बिल बनवा (उदा. 1 आयटम).',
        ],
      },
      {
        title: 'ब्लूटूथ चालू करा आणि प्रिंटर निवडा',
        desc: 'पहिल्यांदा प्रिंट करताना ॲप ब्लूटूथ चालू करायला आणि प्रिंटर निवडायला सांगेल. हे फक्त एकदाच करायचे आहे.',
        points: [
          'ब्लूटूथची (आणि Android मध्ये Nearby devices किंवा Location ची) परवानगी मागितल्यास Allow / Turn on दाबा.',
          'यादीतून तुमचा प्रिंटर निवडा. दिसत नसेल तर प्रिंटर चालू आहे का ते तपासा.',
          'पेअरिंग कोड मागितल्यास 0000 किंवा 1234 वापरून पहा (प्रिंटरच्या मॅन्युअलमध्ये पहा).',
          'यानंतर प्रत्येक बिल फक्त एका टॅपमध्ये थेट प्रिंट होईल.',
        ],
      },
    ],
    storeTitle: 'ॲप डाउनलोड करा',
    play: 'Play Store वरून मिळवा',
    apple: 'App Store वरून डाउनलोड करा',
    helpTitle: 'प्रिंट होत नाहीये? सोपे उपाय',
    help: [
      'प्रिंटर चालू आहे, त्यात कागद आहे आणि फोनमध्ये ब्लूटूथ चालू आहे का ते तपासा.',
      'प्रिंटिंग ॲप पूर्णपणे बंद करून पुन्हा Print दाबा.',
      'Settings → Thermal printer paper मध्ये कागदाचा आकार (58 mm किंवा 80 mm) बरोबर ठेवा.',
      'फोन प्रिंटरच्या जवळ आणून पुन्हा प्रयत्न करा.',
      'तरीही अडचण असल्यास Stellar Forge सपोर्टशी संपर्क साधा.',
    ],
    cta: '🧾 नवीन बिल सुरू करा',
  },
}

function getInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && T[saved]) return saved
  } catch { /* ignore */ }
  return 'en'
}

export default function ConnectPrinterPage() {
  const navigate = useNavigate()
  const [lang, setLang] = useState(getInitialLang)
  const t = T[lang]

  const pick = (code) => {
    setLang(code)
    try { localStorage.setItem(LANG_KEY, code) } catch { /* ignore */ }
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        {t.back}
      </button>

      {/* Language switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {LANGS.map(l => (
          <button key={l.code}
            className={`btn btn-sm ${lang === l.code ? 'btn-dark' : 'btn-secondary'}`}
            onClick={() => pick(l.code)}>
            {l.label}
          </button>
        ))}
      </div>

      <h1 className="page-title">🖨️ {t.title}</h1>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>{t.subtitle}</p>

      {/* Before you start */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10 }}>
          {t.before}
        </div>
        <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text)' }}>
          {t.beforeList.map(x => <li key={x}>{x}</li>)}
        </ul>
      </div>

      {/* Steps */}
      {t.steps.map((s, i) => (
        <div key={i} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
              background: 'var(--teal)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1rem',
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                {t.stepWord} {i + 1}
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', margin: '2px 0 6px' }}>{s.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>{s.desc}</p>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text)' }}>
                {s.points.map(p => <li key={p}>{p}</li>)}
              </ul>

              {i === 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>
                    {t.storeTitle}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <a className="btn btn-dark btn-full" href={PLAY_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      ▶️ {t.play}
                    </a>
                    <a className="btn btn-secondary btn-full" href={APPLE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      🍎 {t.apple}
                    </a>
                  </div>
                </div>
              )}

              {i === 1 && (
                <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} onClick={() => navigate('/orders/new')}>
                  {t.cta}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Troubleshooting */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🛠️ {t.helpTitle}</h3>
        <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text)' }}>
          {t.help.map(h => <li key={h}>{h}</li>)}
        </ul>
      </div>
    </div>
  )
}
