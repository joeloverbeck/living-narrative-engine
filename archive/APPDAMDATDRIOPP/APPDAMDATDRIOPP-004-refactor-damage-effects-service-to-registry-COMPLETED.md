# APPDAMDATDRIOPP-004: Refactor damageTypeEffectsService to use data-driven registry

Status: Completed

Rework `damageTypeEffectsService` to consume the status-effect registry added in APPDAMDATDRIOPP-003. Remove hardcoded IDs/defaults/orderings while keeping default behavior identical to current outputs with the shipped registry data.

## Updated assumptions after review
- Registry + loader exist (`StatusEffectRegistry` service, `status-effects.registry.json`) but the service still hardcodes component/event IDs, thresholds, durations, stacking defaults, and the dismember→fracture→bleed→burn→poison order.
- DI currently injects `dataRegistry` into the service (unused); `StatusEffectRegistry` is already registered and available but not consumed.
- Unit tests (`tests/unit/anatomy/services/damageTypeEffectsService.test.js`) assert the hardcoded defaults and fixed order. Property tests under `tests/property/anatomy/damage-types.property.test.js` still assume an older API that pulled damage types from a registry and are currently misaligned with the service signature.

## File list (expected touches)
- src/anatomy/services/damageTypeEffectsService.js (registry consumption + fallbacks)
- src/dependencyInjection/registrations/worldAndEntityRegistrations.js (wire StatusEffectRegistry)
- tests/unit/anatomy/services/damageTypeEffectsService.test.js (update expectations to registry-backed defaults)
- tests/property/anatomy/damage-types.property.test.js (realign with current service signature or guard outdated assumptions)

## Tasks
- Replace in-file constants for component/event IDs, default durations/stacking/severity, thresholds, and effect ordering with lookups from the status-effect registry, falling back to the existing defaults when data is missing or malformed.
- Ensure payload construction/dispatch uses IDs from registry definitions while keeping exported constants stable for existing consumers.
- Surface missing/invalid registry entries through the existing logger once per effect type without breaking execution.
- Update unit/property coverage so the service is validated against registry-driven defaults and apply-order while still matching current outcomes with the shipped registry file.

## Out of scope
- Changing the semantics of shipped effects (bleed/burn/poison/fracture/dismember) beyond sourcing values and order from the registry.
- Adding new effect types or altering damage-entry authorship.
- Broad downstream rewrites; limit changes to what is required for registry-driven application and updated tests.

## Acceptance criteria
- Tests: Focused suites for `damageTypeEffectsService` (unit + relevant property coverage) pass with registry-driven behavior; new/updated tests included.
- Invariants: With the default registry data, outputs (payload shapes, severities/durations/stacks, ordering) match current behavior; runtime logs unchanged aside from single warning per missing/malformed registry entry.

## Outcome
- `damageTypeEffectsService` now resolves component/event IDs, defaults, and apply order from `StatusEffectRegistry` with single-shot fallbacks/warnings and preserves prior outputs with shipped registry data.
- Dependency injection wires the registry into the service; unit/property suites updated to cover registry-driven ordering/defaults alongside legacy fallbacks.
