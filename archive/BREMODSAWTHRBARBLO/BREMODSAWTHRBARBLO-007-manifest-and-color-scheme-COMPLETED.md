# BREMODSAWTHRBARBLO-007: Update breaching manifest and color schemes [COMPLETED]

Goal: confirm the breaching mod manifest remains aligned with the existing saw-through action content and document the rust-orange color scheme in the mod color scheme docs.

Reference: specs/breaching-mod-saw-through-barred-blocker.spec.md

# File list it expects to touch
- docs/mods/mod-color-schemes-used.md
- docs/mods/mod-color-schemes-available.md
- data/mods/breaching/mod-manifest.json (only if dependencies/content are missing or mismatched after verification)

# Out of scope
- Changes to actions, rules, scopes, or components.
- Test additions or modifications unless required to cover a newly identified invariant/edge case.
- Any other documentation updates outside the two color scheme files.

# Acceptance criteria
## Specific tests that must pass
- npm run validate:fast

## Invariants that must remain true
- Breaching manifest dependencies remain consistent with existing mod requirements.
- Color scheme entries use the rust-orange palette already referenced by the breaching action visuals, with documented contrast ratios that match the actual palette.
- No other mod manifests or docs are changed.

# Outcome
- Documented the rust-orange scheme in the used schemes list using the breaching action's existing visual palette, including the actual contrast ratios (normal state below AA).
- Updated scheme counts in both color scheme docs to reflect the new total/in-use numbers.
- Confirmed `data/mods/breaching/mod-manifest.json` already aligns with the action content; no manifest edits were needed.
