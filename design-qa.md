# Pinch design review — November 13, 2026

## Implemented direction

DM Sans throughout; white, graphite, and cool gray UI surfaces; monochrome headings; no italic display text. The previous serif font dependency is removed. Food photography provides the natural color.

Explore combines a photographic spotlight with a two-column mobile / four-column desktop grid. Cards use consistent image slots, compact time/diet metadata, clear titles, and separate favorite controls. Dietary filters expand from a fixed, reachable control beside the horizontally scrollable collections.

Navigation floats above content with backdrop blur, translucent gradients, a reflective border, and an animated selection capsule. The web / Expo implementation is inspired by Liquid Glass; it does not invoke Apple's native Liquid Glass API. Native iOS continues to use SF Symbols and haptics.

References: [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [Flighty information hierarchy](https://developer.apple.com/news/?id=970ncww4), [Crouton cooking interactions](https://developer.apple.com/news/?id=9x75y43e).

## Motion and accessibility

- Spring press feedback and sliding navigation selection.
- 320 ms content entrances and 160 ms dismissals; cooking-step transitions; subtle desktop photo hover zoom.
- One shared system Reduce Motion subscription. Browser CSS also disables transitions for that preference and provides a reduced-transparency fallback.
- Visible keyboard focus, readable glass-button contrast, 44-pixel-or-larger primary control targets.
- Inactive screens are hidden from keyboard navigation while remaining mounted. Recipe detail takes heading focus and restores focus to its originating card on return.

## Verification

- TypeScript check passed. Existing five ingredient/import tests passed.
- Browser export passed; iOS export passed. Physical iPhone behavior has not been tested.
- Browser checks at 320 × 740, 390 × 844, and 1440 × 1000 CSS pixels.
- At 320 px, document width equals viewport width and both grid columns remain within the viewport. Preference tiles were corrected to avoid splitting their labels.
- Verified dietary filtering, favorites save/undo, Saved collection, recipe detail, cooking step advancement and resume, add options, manual editor, profile, account form, and preference sheet dismissal.
- Returning from the salmon detail restored Explore's scroll position at 688 px and focused the originating recipe card.
- Import/parser behavior is covered by the existing tests; this visual change did not modify the import or account backend.
- No browser errors were observed during the checked flows.

## Captures

- [Mobile Explore](<C:/Users/maxim/.codex/visualizations/2026/11/13/01a1d4ce-b15a-7a52-ab7f-03f0092dc3cc/pinch-glass-mobile.jpg>)
- [Mobile recipe cards](<C:/Users/maxim/.codex/visualizations/2026/11/13/01a1d4ce-b15a-7a52-ab7f-03f0092dc3cc/pinch-glass-cards.jpg>)
- [Desktop Explore](<C:/Users/maxim/.codex/visualizations/2026/11/13/01a1d4ce-b15a-7a52-ab7f-03f0092dc3cc/pinch-glass-desktop.jpg>)
