# SPEBUBCOPALL-001: Add copy-all icon to UI icon registry

Status: Completed

Define a dedicated clipboard/all-in-one icon in `icons.js` with registry override support so the new meta button has a reliable default asset. Icon registry plumbing already handles override lookups (string or `{ markup }`), so the scope is to add the built-in icon entry and extend tests to confirm the new key participates in the existing fallback/override behavior.

## File list
- src/domUI/icons.js
- tests/unit/domUI/icons.test.js (extend coverage for default + registry override of `copy-all`)

## Out of scope
- Any DOM wiring or meta button rendering.
- Clipboard behavior or payload formatting.
- Styling changes to existing icons.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- tests/unit/domUI/icons.test.js` passes with cases asserting built-in `copy-all` icon and registry override fallback behavior (string and `{ markup }` responses fall back to the default when invalid).
- Invariants:
  - Existing icon IDs (notes, thoughts, etc.) and fallbacks remain unchanged.
  - Registry lookups still prefer provided icons when valid, falling back to defaults on invalid responses.
  - No SVG/html is pulled from the DOM; icons remain string-returning helpers as today.

## Outcome
- Added built-in `copy-all` SVG to `src/domUI/icons.js` and kept existing registry override behavior intact.
- Expanded `tests/unit/domUI/icons.test.js` to cover `copy-all` default, override (string/object), and fallback behavior; run with `npm run test:unit -- --runInBand tests/unit/domUI/icons.test.js`.
