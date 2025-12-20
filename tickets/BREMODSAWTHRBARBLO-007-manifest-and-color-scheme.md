# BREMODSAWTHRBARBLO-007: Update breaching manifest and color schemes

Goal: align the breaching mod manifest with the new action and document the rust-orange color scheme.

# File list it expects to touch
- data/mods/breaching/mod-manifest.json
- docs/mods/mod-color-schemes-used.md
- docs/mods/mod-color-schemes-available.md

# Out of scope
- Changes to actions, rules, scopes, or components.
- Test additions or modifications.
- Any other documentation updates outside the two color scheme files.

# Acceptance criteria
## Specific tests that must pass
- npm run validate:fast

## Invariants that must remain true
- Breaching manifest dependencies remain consistent with existing mod requirements.
- Color scheme entries use the specified rust-orange palette and contrast ratios.
- No other mod manifests or docs are changed.
