# Damage Types and Special Effects Specification

## Document Information

**Version:** 1.0.0
**Status:** ✅ Implemented
**Last Updated:** 2026-02-28
**Author:** Systems Design
**Dependencies:** Damage Application Mechanics, Per-Part Health, Event Bus
**Implementation Completed:** 2025-12-02

---

## Implementation Summary

This specification has been fully implemented through the DAMTYPANDSPEEFF ticket series:

| Ticket | Description | Status |
|--------|-------------|--------|
| DAMTYPANDSPEEFF-001 | Damage type schema and content | ✅ Complete |
| DAMTYPANDSPEEFF-002 | Status components and effect application | ✅ Complete |
| DAMTYPANDSPEEFF-003 | Tick systems (Bleeding, Burning, Poison) | ✅ Complete |
| DAMTYPANDSPEEFF-004 | Event and propagation integration | ✅ Complete |
| DAMTYPANDSPEEFF-005 | Testing and performance coverage | ✅ Complete |

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [Damage Type Data Model](#damage-type-data-model)
4. [Status Components and Effects](#status-components-and-effects)
5. [Processing Flow](#processing-flow)
6. [Events](#events)
7. [Data and File Layout](#data-and-file-layout)
8. [Testing Strategy](#testing-strategy)

---

## System Overview

Damage types add differentiated outcomes on top of raw damage (bleeding, bone fracture, burning, poison, dismemberment, stun). They are data-driven and can be extended by mods without engine code changes. The Damage System consults the damage type definition whenever damage is applied and enqueues immediate and ongoing effects via components and events. Ongoing effects are handled by dedicated systems (BleedingSystem, BurningSystem, PoisonSystem) that tick each turn.

## Goals and Non-Goals

- **Goals:** Data-driven damage taxonomy; deterministic application of special effects; clear event hooks for narration/mod rules; modular ongoing effect processors; compatibility with per-part health and propagation.
- **Non-Goals:** Visual/VFX rendering choices, balance values for shipped mods, UI copy for status badges.

## Damage Type Data Model

Damage types live in JSON definitions and are referenced by `damage_type` ids in actions/operations. Required schema fields:

- `id` (string): Unique key, used in events and rules.
- `name` (string): Designer label.
- `description` (string): Narrative aid.
- `penetration` (number 0-1): Used by propagation logic to weight internal hit chances.
- `bleed`: `{ "enabled": bool, "severity": "minor|moderate|severe", "baseDurationTurns": number }`
- `fracture`: `{ "enabled": bool, "thresholdFraction": number, "stunChance": number }`
- `burn`: `{ "enabled": bool, "dps": number, "durationTurns": number, "canStack": bool }`
- `poison`: `{ "enabled": bool, "tick": number, "durationTurns": number, "scope": "part|entity" }`
- `dismember`: `{ "enabled": bool, "thresholdFraction": number }` (if exceeded, set part health to 0 immediately)
- `flags`: array for custom behaviors (e.g., `["magical","holy"]`) so mods can branch logic without engine edits.

All optional sections default to safe no-op values if omitted. Missing `penetration` defaults to 0.0.

## Status Components and Effects

Effects are represented via components to keep processing modular:

- `anatomy:bleeding` on part: `{ severity, remainingTurns, tickDamage }`. Applied when a damage type with bleed enabled hits and part is not destroyed.
- `anatomy:burning` on part: `{ remainingTurns, tickDamage, stackedCount }`. Stacking increases tickDamage if `canStack` is true; otherwise refreshes duration.
- `anatomy:poisoned` on part or root entity (based on scope): `{ remainingTurns, tickDamage }`.
- `anatomy:fractured` on part: `{ sourceDamageType, appliedAtHealth }`. Applied when blunt-like types exceed `thresholdFraction * maxHealth`.
- `anatomy:stunned` on entity: `{ remainingTurns, sourcePartId }`, applied probabilistically from fracture stunChance (or other types that set it explicitly).
- Dismemberment uses part destruction: if `dismember.enabled` and incoming damage ≥ `thresholdFraction * maxHealth`, set part currentHealth to 0 and mark destroyed; do not apply ongoing components.

## Processing Flow

1. **Apply Damage** (existing): subtract health on target part, with propagation already resolved.
2. **Lookup Damage Type**: fetch definition by `damage_type` id; if missing, treat as neutral (no special effects) but still log a warning.
3. **Immediate Effects**:
   - Dismemberment check before bleeding/burning; if triggered, emit destroy events and skip ongoing components for that part.
   - Fracture check (if enabled and damage amount ≥ thresholdFraction * maxHealth and part is bone-bearing or flagged). Set `anatomy:fractured`, optionally roll stunChance to set `anatomy:stunned`.
   - Bleed attach: add/refresh `anatomy:bleeding` with severity mapped to tickDamage per severity table.
   - Burn attach: add/refresh `anatomy:burning` with stacking rules.
   - Poison attach: add to part or root entity based on scope; refresh duration on reapplication.
4. **Ongoing Tick Systems** (per turn):
   - BleedingSystem: apply tickDamage to part health; stop when health reaches 0 or duration ends; emits `anatomy:bleeding_stopped`.
   - BurningSystem: apply tickDamage; if part destroyed, stop. Optionally increase propagation chance to child parts if design chooses (guarded by config).
   - PoisonSystem: apply tickDamage to target scope; if entity dies, clear component.
5. **Event Dispatch**: each status add/remove emits events below.

## Events

- `anatomy:damage_type_applied`: `{ entityId, partId, damageTypeId, amount, propagatedFrom }`
- `anatomy:bleeding_started` / `anatomy:bleeding_stopped`: `{ entityId, partId, severity }`
- `anatomy:burning_started` / `anatomy:burning_stopped`: `{ entityId, partId, stackedCount }`
- `anatomy:poisoned_started` / `anatomy:poisoned_stopped`: `{ entityId, scope, partId? }`
- `anatomy:fractured`: `{ entityId, partId, damageTypeId, stunApplied }`
- `anatomy:dismembered`: `{ entityId, partId, damageTypeId }`

Events integrate with narrative/UI and allow mods to hook custom reactions.

## Data and File Layout

- Damage type definitions: `data/mods/anatomy/damage-types/*.json` (new directory).
- Component schemas:
  - `data/mods/anatomy/components/bleeding.component.json`
  - `data/mods/anatomy/components/burning.component.json`
  - `data/mods/anatomy/components/poisoned.component.json`
  - `data/mods/anatomy/components/fractured.component.json`
  - `data/mods/anatomy/components/stunned.component.json` (if not global already).
- System implementations (JS):
  - `src/anatomy/services/damageTypeEffectsService.js` (runs immediate application after damage).
  - `src/anatomy/services/bleedingTickSystem.js`
  - `src/anatomy/services/burningTickSystem.js`
  - `src/anatomy/services/poisonTickSystem.js`

## Testing Strategy

### Unit Tests ✅

- **Damage Type Parsing:** invalid/missing fields fall back to safe defaults; unknown ids warn but do not throw.
- **Bleed Application:** applying cutting damage to a healthy part attaches bleeding with correct severity and duration; reapplication refreshes duration.
- **Fracture Threshold:** blunt damage below threshold does not fracture; at/above threshold sets `anatomy:fractured`; stunChance respected (mock RNG).
- **Burn Stacking:** burn with `canStack=true` increases tickDamage and stackedCount; `canStack=false` refreshes duration without increasing damage.
- **Poison Scope:** poison on part vs entity targets correct component; duration refresh on repeat hit.
- **Dismemberment:** damage exceeding threshold sets part health to 0 and emits dismember event; no bleeding/burning applied afterward.
- **Effect Removal:** when durations expire, components are removed and stop further ticks.

### Integration Tests ✅

- **Full Damage Pipeline:** execute APPLY_DAMAGE with piercing damage through torso->heart propagation; assert damage_type_applied and bleeding_started fire for both parts.
- **Concurrent Effects:** apply fire+poison to same part; ticks reduce health cumulatively; removal events fire separately when timers end.
- **Stun and Action Lockout:** fracture-induced stun prevents action execution for remainingTurns (hook into command validator).
- **Dismember Narrative:** cutting damage over threshold on arm destroys part, emits dismembered, and prevents subsequent bleeding ticks for that part.
- **Mod Extensibility:** load a custom damage type JSON with unique flag; ensure DamageTypeEffectsSystem reads it and fires custom flag hook (via test double listener).

### Property/Statistical Tests ✅

- **Bleed DPS Bounds:** randomized damage types with bleed severity must not produce negative durations or tickDamage; assert invariants across generated samples.
- **Stacking Stability:** repeated burn applications with `canStack=true` should never exceed configured max stack cap if present; otherwise monotonic increase verified against expected formula.

### Performance/Regression Tests ✅

- Tick systems on large anatomies (e.g., 100 parts) run within frame budget; no duplicate events when multiple effects expire simultaneously.
- Ensure removing a destroyed entity clears all status components and does not leak timers or event handlers.

---

## Test Coverage Summary

| Test Suite | Tests | Status |
|------------|-------|--------|
| `tests/unit/anatomy/services/damageTypeEffectsService.test.js` | 745 lines | ✅ |
| `tests/unit/anatomy/services/bleedingTickSystem.test.js` | 367 lines | ✅ |
| `tests/unit/anatomy/services/burningTickSystem.test.js` | 393 lines | ✅ |
| `tests/unit/anatomy/services/poisonTickSystem.test.js` | 479 lines | ✅ |
| `tests/integration/anatomy/damage-type-events.integration.test.js` | - | ✅ |
| `tests/integration/anatomy/damage-application.integration.test.js` | - | ✅ |
| `tests/property/anatomy/damage-types.property.test.js` | 12 tests | ✅ |
| `tests/performance/anatomy/damage-effects.performance.test.js` | 15 tests | ✅ |

**Total:** 143 tests passing
