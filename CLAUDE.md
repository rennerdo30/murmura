# CLAUDE.md

**Murmura** - *From whispers to fluency* - Multi-language learning platform.

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build static site |
| `npm run deploy` | Deploy Convex + build |
| `npx tsc --noEmit` | Check TypeScript (must pass) |

**Live URL**: https://murmura.renner.dev

---

## MANDATORY Rules

### TypeScript
- `strict: true` must be enabled
- **NO `any` types** - use proper types or `unknown`
- **NO `// @ts-ignore`** - fix the underlying issue
- Run `npx tsc --noEmit` before commits

### Convex Security
- **NEVER use `v.any()`** - always use proper validators
- **NEVER expose userId** in query results
- Use `v.union(v.literal(...))` for enums

### User Data Storage
- **When logged in**: Store user preferences/progress in **Convex**
- **When logged out**: Use `localStorage` as fallback
- Always sync localStorage to Convex when user logs in
- Examples: voice preferences, SRS settings, learning progress

### Accessibility (WCAG AA)
- Color contrast: 4.5:1 minimum
- Touch targets: 44px × 44px minimum
- Keyboard navigation: Tab, Enter, Escape, Arrows
- Focus indicators on all interactive elements
- Respect `prefers-reduced-motion`

### Mobile (320px minimum)
- Use `min(value, 100%)` pattern for widths
- Grid: `minmax(min(260px, 100%), 1fr)`
- Test at 320px, 375px, 480px, 640px

### Code Quality
- Use `react-icons` - **NO emojis as icons**
- Wrap pages in `<ErrorBoundary>`
- No duplicate code - extract shared logic

---

## Architecture

### Tech Stack
- **Next.js** - Static export to GitHub Pages
- **Convex** - Backend-as-a-service (database, auth)
- **TypeScript** + **React 19**
- **TTS**: Pre-generated ElevenLabs → Kokoro browser TTS → Web Speech API

### TTS Fallback Chain
1. **Pre-generated audio** - ElevenLabs files in `public/audio/` (best quality)
2. **Kokoro browser TTS** - `kokoro-js` runs locally (English only, auto-loads on desktop)
3. **Web Speech API** - Browser built-in (variable quality, all languages)

### Multi-Language Data Structure
```
src/data/
├── ja/              # Japanese (Hiragana, Kanji, etc.)
├── ko/              # Korean (Hangul)
├── zh/              # Chinese (Hanzi)
└── language-configs.json  # Master config
```

### Language Themes
Each language has its own theme (applied via `data-theme` attribute):
- Japanese: Zen Garden (Vermillion + Gold)
- Korean: Hanok (K-pop Pink + Cyan)
- Chinese: Silk Road (Imperial Red + Gold)

**DO NOT** show Japanese elements when learning other languages.

### Navigation
- **Mobile**: `BottomNavBar` (fixed bottom, 5 tabs: Home, Study, Paths, Review, Settings)
  - Rendered in `ClientLayout.tsx`, hidden on desktop (≥769px)
  - Uses `usePathname()` for active tab highlighting
  - Glass morphism + safe area padding for notch/island devices
- **Desktop**: Top `Navigation` component with back button

### Key Components
- `useTargetLanguage()` - Language state, levels, theme
- `LanguageContentGuard` - Shows "Coming Soon" if no data
- `dataLoader.ts` - Registry-based vocabulary loading
- `BottomNavBar` - Persistent mobile navigation (auto-included in layout)
- `ReviewProgress` - Sticky progress bar with inline exit button

### Module Page Pattern
```typescript
const { targetLanguage, levels, getDataUrl } = useTargetLanguage();
const displayLevels = useMemo(() => levels.slice(0, 2), [levels]);
const vocabulary = useMemo(() => getVocabularyData(targetLanguage), [targetLanguage]);
```

---

## Adding a New Language

1. Add config to `src/data/language-configs.json`
2. Create data files in `src/data/{code}/`
3. Add to `dataLoader.ts` registry (vocabulary only)
4. Grammar/Reading/Listening use dynamic fetch automatically

---

## Deployment

**Static frontend (GitHub Pages) + Serverless backend (Convex)**

```bash
npm run deploy  # Builds + deploys Convex
git push origin master  # Deploys to GitHub Pages
```

### Environment Variables
- `.env.local`: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`
- **Convex Dashboard**: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`

Generate auth keys: `node tools/generateAuthKeys.mjs`

---

## Key Directories

| Path | Description |
|------|-------------|
| `src/app/` | Next.js pages (alphabet, vocabulary, kanji, grammar, reading, listening) |
| `src/components/common/` | Shared components (Navigation, BottomNavBar) |
| `src/components/ui/` | Reusable UI components |
| `src/hooks/` | Custom hooks (useTTS, useTimer, useSRS, etc.) |
| `src/lib/` | Utilities (kokoroTTS, storage, dataLoader, etc.) |
| `src/data/` | JSON data files by language |
| `convex/` | Backend schema, auth, queries, mutations |
| `public/audio/` | 390+ pre-generated TTS audio files |

---

## Audio Generation

```bash
npm run generate-audio -- --type all --update-json
npm run generate-audio -- --type vocabulary --update-json
```

For Kokoro (local): `npm run setup-kokoro` first

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Convex not connecting | Check `.env.local` for `NEXT_PUBLIC_CONVEX_URL` |
| Audio not playing | Verify `audioUrl` paths, check browser console |
| Build fails | `rm -rf .next && npm install` |
| Mobile mode not working | `window.DEBUG_MOBILE = true` in console |

---

## Known Issues / TODO

**Remaining:**
- Translations need language-aware module descriptions
- Audio needs pause/stop during navigation

**Completed:**
- All module pages use dynamic data loading
- TTS uses dynamic language from `useTargetLanguage()`
- Error boundaries on all pages
- Focus states and accessibility
- Persistent bottom navigation bar on mobile
- Dashboard widgets collapsible on mobile (accordion)
- Locked learning paths disabled for keyboard/mouse
- Vocabulary pagination with load-more
- Sticky review progress bar with exit button
- Color picker aria-labels for accessibility

See `SPECIFICATION.md` for detailed design specifications.
