# Murmura

*From whispers to fluency* - A comprehensive, browser-based language learning application.

**Live Demo**: [https://murmura.renner.dev](https://murmura.renner.dev)

## Supported Languages

| Language | Framework | Features |
|----------|-----------|----------|
| Japanese | JLPT (N5-N1) | Hiragana, Katakana, Kanji, Vocabulary, Grammar, Reading, Listening |
| Korean | TOPIK (1-6) | Hangul, Vocabulary, Grammar, Reading, Listening |
| Chinese | HSK (1-6) | Hanzi, Vocabulary, Grammar, Reading, Listening |
| Spanish | CEFR (A1-C2) | Vocabulary, Grammar, Reading, Listening |
| German | CEFR (A1-C2) | Vocabulary, Grammar, Reading, Listening |
| Italian | CEFR (A1-C2) | Vocabulary, Grammar, Reading, Listening |
| English | CEFR (A1-C2) | Vocabulary, Grammar, Reading, Listening |

## Features

- **Multi-Language Support**: Learn 7 languages with culturally-themed interfaces
- **Structured Learning Paths**: JLPT, CEFR, HSK, and TOPIK progression tracks
- **Character Systems**: Hiragana, Katakana, Hangul, Kanji, and Hanzi practice
- **Adaptive Input Methods**:
  - **Desktop**: Type answers with keyboard
  - **Mobile**: Touch-friendly multiple choice
- **Spaced Repetition**: SRS-based review system for optimal retention
- **Progress Tracking**: Persistent stats with Convex backend
- **Text-to-Speech**: Pre-generated audio first, then Edge TTS, in-browser Kokoro,
  and the Web Speech API as fallbacks
- **Gamification**: XP, levels, streaks, daily goals and achievements
- **Offline Support**: Works without internet after initial load

## Appearance and languages

- **Themes**: every target language ships a culturally-themed dark palette
  (Zen Garden, Schwarzwald, Sol y Sombra, ...) plus a **Daylight** light theme.
  Pick one globally or per language under *Settings -> Appearance*, or override
  individual colours there.
- **Interface language**: the UI itself is translated into 12 languages and
  follows the browser language by default (switcher in the dashboard header).
- **Accessibility**: keyboard focus rings throughout, a skip link, touch targets
  of at least 44px and full `prefers-reduced-motion` support.

## Tech Stack

- **Next.js 16** (App Router, static export) with **React 19**
- **TypeScript** - Type-safe development
- **CSS Modules** + CSS custom properties for theming and design tokens
- **Convex** - Backend for progress sync and authentication
- **Edge TTS / Kokoro** - Text-to-speech, with pre-generated audio where available
- **GitHub Pages** - Static hosting

## Getting Started

### Local Development

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/rennerdo30/murmura.git
cd murmura
npm install
```

2. Generate the Convex client (creates `convex/_generated`, which the app
   imports and which is not checked in):
```bash
npx convex dev   # keep running for a live backend, or use `npx convex codegen`
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file:
```env
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
ELEVENLABS_API_KEY=sk_...  # Optional, for audio generation
```

See `.env.example` for the full list.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build / static export into `out/` |
| `npm run deploy` | Deploy Convex functions and build the frontend |
| `npm run generate-audio` | Pre-generate TTS audio files |
| `npm run check-i18n` | Verify every locale has all keys from `en.json` |
| `npm run find-missing-i18n` | List translation keys used in code but missing from `en.json` |
| `npx tsc --noEmit` | Type-check without emitting |

## Project Structure

```
murmura/
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React Context providers
│   ├── data/               # Language data (JSON)
│   │   ├── ja/             # Japanese
│   │   ├── ko/             # Korean
│   │   ├── zh/             # Chinese
│   │   └── ...
│   ├── lib/                # Utilities
│   ├── locales/            # UI translations (12 languages)
│   ├── styles/             # Design tokens (globals.css) + per-theme palettes
│   └── types/              # TypeScript types
├── convex/                 # Backend functions
├── public/                 # Static assets & audio
└── tools/                  # CLI utilities
```

## Deployment

Deployed automatically to GitHub Pages on push to `master`.

```bash
npm run deploy  # Deploy Convex + build frontend
```

## Contributing

Contributions welcome! See [SPECIFICATION.md](SPECIFICATION.md) for design guidelines.

## License

Open source for educational purposes.

## Acknowledgments

- [Wanakana.js](https://github.com/WaniKani/WanaKana) - Japanese character conversion
- [Convex](https://convex.dev) - Backend platform
- [Kokoro](https://github.com/hexgrad/kokoro) - In-browser text-to-speech
- [ElevenLabs](https://elevenlabs.io) - Optional voices for the audio generation tool

---

Made with care for language learners everywhere
