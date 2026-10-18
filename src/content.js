/**
 * ALL personal content lives in this one file.
 * Agents: change words, links and playlists here — never hard-code them in components.
 * The site is one conversation with Pulidevan Prabakaran, founder of AI Essentials. Keep it about that: no résumé, no past jobs.
 * Always use the full name "Pulidevan Prabakaran". Never shorten it to a nickname.
 */

export const profile = {
  name: "Pulidevan Prabakaran",
  title: "Founder, AI Essentials",
  bigWord: ["PULIDEVAN", "PRABAKARAN"],  // giant parallax words behind the head, one per line
  city: "Chennai",
  timeZone: "Asia/Kolkata",
  tzLabel: "IST",
  coords: "13.08°N 80.27°E"
};

/** The ₹999 call. Booking happens entirely on Razorpay: the site itself collects no personal data. */
export const offer = {
  title: "1:1 discovery call",
  with: "With Pulidevan Prabakaran",
  price: "₹999",
  was: "₹2,029",
  cta: "Book on Razorpay · ₹999",
  payUrl: "https://rzp.io/rzp/frjnjJz"
};

/**
 * The AI clone (Gemini, in Pulidevan Prabakaran's voice). Its knowledge and tone live server-side in
 * public/api/_brand.php. Here: the opening lines, tap-to-ask prompts and the post-payment thank-you.
 */
export const assistant = {
  label: "AI clone · second brain",
  greeting: ["Hey, I'm Pulidevan Prabakaran. Well, my AI clone 🤌🏼", "Ask me anything about AI, brands or what you're building."],
  prompts: ["Who are you?", "Show me AI videos", "Is this for someone like me?"],
  bookChip: "Book a call · ₹999",
  bookReply: "Let's get on a call. ₹999, and we map exactly where AI fits in your work.",
  headAsk: "Who are you?",                     // clicking the 3D head asks this
  placeholder: "Ask me anything…",
  paid: "Payment done? Lovely 🔥 I'll reach out on the WhatsApp or email you paid with. Talk soon."
};

/** Student films hosted for filmaking.aiessentials.in. Shown when someone asks about AI video. */
const CDN = "https://cdn.jsdelivr.net/gh/pulidevan/ai-essential-assets@1638b8d3566b/";
export const films = {
  more: "https://filmaking.aiessentials.in",
  items: [
    { title: "GO DESI · Diwali TVC", poster: CDN + "img/student-godesi-scene.webp", src: CDN + "films/student-godesi.mp4", preview: CDN + "films/student-godesi-preview.mp4" },
    { title: "Godrej HIT · Comedy TVC", poster: CDN + "img/student-hit-thumb.webp", src: CDN + "films/student-hit.mp4", preview: CDN + "films/student-hit-preview.mp4" },
    { title: "Casio · Get The Time Right", poster: CDN + "img/student-casio-thumb.webp", src: CDN + "films/student-casio.mp4", preview: CDN + "films/student-casio-preview.mp4" },
    { title: "Avast · Don't Take The Bait", poster: CDN + "img/student-avast-thumb.webp", src: CDN + "films/student-avast.mp4", preview: CDN + "films/student-avast-preview.mp4" },
    { title: "Ways · Snack TVC", poster: CDN + "img/student-ways-thumb.webp", src: CDN + "films/student-ways.mp4", preview: CDN + "films/student-ways-preview.mp4" },
    { title: "Rya · Holiday Cheer", poster: CDN + "img/student-rya-thumb.webp", src: CDN + "films/student-rya-holiday.mp4", preview: CDN + "films/student-rya-holiday-preview.mp4" },
    { title: "PicxStudio · Urban Rhythm", poster: CDN + "img/student-picx-thumb.webp", src: CDN + "films/student-picx-urban.mp4", preview: CDN + "films/student-picx-urban-preview.mp4" },
    { title: "What's Inside · Thriller Teaser", poster: CDN + "img/student-whatsinside-thumb.webp", src: CDN + "films/student-whatsinside.mp4", preview: CDN + "films/student-whatsinside-preview.mp4" },
    { title: "The Encounter · Narrative Spec", poster: CDN + "img/student-cinematic-thumb.webp", src: CDN + "films/student-cinematic-spec.mp4", preview: CDN + "films/student-cinematic-spec-preview.mp4" }
  ]
};

/**
 * Records in the 3D crate: SoundCloud artists/playlists, played through a hidden SoundCloud widget
 * (no SoundCloud branding on the page). `home: true` loads first; Shuffle picks another.
 * url = any public SoundCloud artist, playlist or track URL. color/ink = record label colours.
 */
export const playlists = [
  { name: "Lofi Girl", url: "https://soundcloud.com/lofi_girl", color: "#ff5a1f", ink: "#1a0c06", home: true },
  { name: "Chillhop", url: "https://soundcloud.com/chillhopdotcom", color: "#e9dcc3", ink: "#1d2a2e" },
  { name: "Jinsang", url: "https://soundcloud.com/jinsang", color: "#2b3c42", ink: "#f4fbfa" },
  { name: "Kupla", url: "https://soundcloud.com/kupla", color: "#7fb3bf", ink: "#0f2a33" },
  { name: "Potsu", url: "https://soundcloud.com/potsu", color: "#f4fbfa", ink: "#0f2a33" },
  { name: "Sleepy Fish", url: "https://soundcloud.com/sleepyfish-music", color: "#d8401f", ink: "#fff4ec" }
];
