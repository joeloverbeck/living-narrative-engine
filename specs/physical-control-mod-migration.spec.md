# Physical-Control Mod Migration Specification

## Overview

This specification captures the required steps to migrate forceful positioning actions out of the `violence` mod into a dedicated
`physical-control` mod. The new mod groups actions that physically reposition or restrain targets without delivering direct
injury. It must include a full manifest, action/condition/rule triplets, updated tests, and refreshed accessibility visuals.

## Scope

- Create `data/mods/physical-control/` with `actions/`, `conditions/`, and `rules/` directories plus a `mod-manifest.json`.
- Move and rename the following action bundles from the `violence` mod:
  - `force_to_knees`
  - `push_off`
  - `push_onto_lying_furniture`
- Update every reference so the new namespace is `physical-control`.
- Refresh integration tests, debug harnesses, specs, and manifests to point at the new mod files.
- Adopt the "Ironclad Slate" WCAG color scheme for all physical-control actions.

## Mod Structure Requirements

1. **Manifest**
   - `id`: `physical-control`
   - `name`: `physical-control`
   - `version`: `1.0.0`
   - `dependencies`: `anatomy`, `clothing`, `positioning`
   - `content` lists the three action, rule, and condition JSON files.

2. **Actions**
   - Namespace IDs as `physical-control:<action_name>`.
   - Preserve existing templates, required/forbidden components, and combination logic.
   - Use the Ironclad Slate visual palette:
     ```json
     {
       "backgroundColor": "#2f2f2f",
       "textColor": "#f8f9fa",
       "hoverBackgroundColor": "#3f3d56",
       "hoverTextColor": "#f8f9ff"
     }
     ```

3. **Conditions**
   - Mirror original logic but update IDs and literal action IDs to `physical-control:*`.

4. **Rules**
   - Copy existing pipelines, updating any `condition_ref`, component IDs, and logged action IDs to the new namespace.
   - `handle_push_onto_lying_furniture` must:
     - Break closeness between actor and primary target.
     - Add `positioning:lying_down` with `{ "furniture_id": "{event.payload.secondaryId}" }`.
     - Lock the primary target's movement before logging success.

## Reference Updates

- Remove the migrated files from `data/mods/violence/mod-manifest.json`.
- Update debug harnesses (`debug-push-off.test.js`, `debug-payload-test.js`) to import from the new mod.
- Adjust schema regression tests that load `handle_push_off.rule.json` to the new path.
- Move integration suites into `tests/integration/mods/physical-control/` and update imports, action IDs, and expectations.
- Refresh existing specs (`force-to-knees`, `physical-control-push-onto-lying-furniture`) to mention the new mod and color palette.

## WCAG Color Tracking

- Assign "Ironclad Slate" to the physical-control mod in `specs/wcag-compliant-color-combinations.spec.md`.
- Mark the scheme as **USED BY** Physical-Control in both the usage table and section 11.2 entry.

## Validation Checklist

- [ ] New physical-control manifest validates with `npm run validate`.
- [ ] All integration tests under `tests/integration/mods/physical-control/` pass.
- [ ] Debug harnesses still execute without missing-module errors.
- [ ] WCAG specification reflects the new color assignment.
- [ ] Violence manifest contains only damage-oriented actions after migration.
