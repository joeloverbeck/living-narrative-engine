# Negligible Damage Tier & Narrative Alignment

## Document Info

Version: 0.1 (draft)  
Owner: Gameplay Systems  
Scope: Spec for introducing a negligible damage band, narrative phrasing, and health state handling for low-damage hits routed through `APPLY_DAMAGE` (macros in `data/mods/violence/macros/` and `data/mods/weapons/macros/`).  
Primary code refs to inspect: `src/logic/operationHandlers/applyDamageHandler.js`, `src/anatomy/services/damagePropagationService.js`, `src/anatomy/services/damageTypeEffectsService.js`, `src/anatomy/services/damageAccumulator.js`, `src/anatomy/services/bodyDescriptionComposer.js`, `game.html` perceptible event rendering.

---

## Problem Statement

- Observed logs show tiny hits (e.g., torso 50 → 48, heart 50 → 49) still surfacing dramatic UI text: `Rill's torso suffers piercing damage. As a result, her heart suffers piercing damage.` while the actor remains at `Health: Perfect health.`  
- Disconnects: (1) applied damage magnitude vs. condition state, (2) propagation narrative not reflecting severity, (3) overall health summary ignores small-but-nonzero damage.  
- Existing e2e coverage that exercises `APPLY_DAMAGE` (e.g., `tests/e2e/actions/damagePropagationFlow.e2e.test.js`, `damageNarrativeDispatch.e2e.test.js`, `damageEdgeCases.e2e.test.js`, `swingAtTargetFullFlow.e2e.test.js`, `damageSessionEventQueueing.e2e.test.js`, `propagationBookkeeping.e2e.test.js`, `damageEffectsTriggers.e2e.test.js`, `hitResolutionControls.e2e.test.js`) must stay stable for non-negligible hits while gaining scenarios for low-damage behavior.

---

## Goals

- Introduce a negligible (or cosmetic) damage tier that sits between pristine and the first injury band; ensure hits within this band alter state/narrative appropriately.
- Thread severity into propagation and perceptible event messaging so extremely small hits read as negligible rather than dramatic.
- Update health summaries so any recorded damage exits `Perfect health` while still signaling the impact is trivial.
- Add deterministic coverage across unit/integration/e2e to prevent regressions in macros invoking `APPLY_DAMAGE` for small amounts.

## Non-Goals

- Armor/mitigation changes (stays out of scope; negligible tier is post-mitigation).  
- Rebalancing damage numbers in mod data beyond messaging/severity classification.  
- UI redesign outside of text phrasing and severity labels.

---

## Proposed Behavior

### 1) Negligible Damage Tier (new)

- Add a new part-level condition band `negligible` (name TBD: `cosmetic`, `superficial`, or `grazed`) representing damage that is >0 but below the first injury threshold.  
- Threshold proposal: `appliedDamage / partMaxHealth < 0.02` (2%) *or* absolute `appliedDamage < 2`, whichever is higher; clamp to avoid zero-damage noise.  
- State mapping:  
  - `perfect` → only when `currentHealth === maxHealth`.  
  - `negligible` → when `currentHealth < maxHealth` and the cumulative delta is below the existing first injury threshold.  
  - Downstream bands remain unchanged.
- Propagation should inherit severity classification from child hits: if the propagated amount falls in negligible range, tag the child hit as negligible too.

### 2) Narrative & Event Text

- Perceptible event text (used by `game.html`/UI) should receive a severity qualifier when hits classify as negligible, e.g., `Rill's torso suffers negligible piercing damage. As a result, her heart suffers negligible piercing damage.`  
- Only attach the qualifier when the severity is negligible; preserve existing phrasing for higher bands.  
- Ensure narrative accumulator / composer includes severity so recap text does not overstate impact.

### 3) Health Summary / Condition Lines

- `Health: Perfect health.` should only render when *no* parts have recorded damage.  
- When all damage is within the negligible band, render a soft state such as `Health: Cosmetic scuffs.` (exact copy TBD, but must distinguish from both perfect and injured).  
- Body description composer should reflect the negligible band with minimal language (e.g., “slight marks”) and not escalate pain/bleeding effects.

### 4) Data & Macros

- No change to macro payloads required; the tier is computed in the damage pipeline.  
- If any macros currently hardcode narrative strings for small hits, align them with the negligible severity flag emitted by the handler.

---

## Technical Notes

- Severity classification lives close to damage application (likely `damageAccumulator` or `damageTypeEffectsService`) so both propagation and narrative can consume it.  
- Propagation log entries should include `severity` to keep debugging parity with `DAMAGE_DEBUG` output.  
- Avoid brittle numeric checks: centralize thresholds in a config/constant to prevent divergence between damage, summary, and UI layers.

---

## Testing Plan

- **Unit**:  
  - Severity classifier: verify boundaries (0, 1, 1.9, 2, 2% of max, just above threshold).  
  - Propagation: parent hit negligible → child hit negligible; parent non-negligible → child respects amount.  
  - Narrative helper: negligible hits emit qualified strings; non-negligible unchanged.
- **Integration** (`tests/integration` new/extended suites):  
  - Damage accumulation + body description composer outputs cosmetic language when only negligible damage exists.  
  - Health summary returns “cosmetic” variant instead of “perfect” once any damage is applied.
- **E2E** (`tests/e2e/actions` additions):  
  - New scenario exercising a low-damage `APPLY_DAMAGE` macro from `data/mods/violence` or `data/mods/weapons`, asserting UI/perceptible text uses negligible wording and health summary exits perfect.  
  - Regression assertions on existing suites (listed in Problem Statement) to ensure medium/high damage messages remain unchanged.
- **Debugging hooks**: Extend `DAMAGE_DEBUG` to include `severity` so assertions can target logs without brittle string parsing.

---

## Open Questions

- Naming: `negligible` vs `cosmetic` vs `superficial`—pick one and align across code, UI, and data.  
- Exact threshold: is 2%/2hp the right floor, or should it be data-driven per anatomy?  
- Should negligible hits suppress downstream status effects (bleeds, pain) entirely, or only dampen their intensity?  
- Does the negligible band contribute to long-term scarring or is it transient?

