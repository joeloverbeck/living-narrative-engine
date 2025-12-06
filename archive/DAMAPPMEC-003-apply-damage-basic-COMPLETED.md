# DAMAPPMEC-003: Apply Damage Operation (Basic)

## Description

Implement the core logic for the `APPLY_DAMAGE` operation. This ticket focuses on applying direct damage to a specific part, updating its health, handling thresholds/status labels, and dispatching events. **excludes damage propagation**.

## Expected File List

- `src/logic/operationHandlers/applyDamageHandler.js` (New)
- `data/schemas/operations/applyDamage.schema.json` (New)
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` (New)
- `src/dependencyInjection/tokens/tokens-core.js` (Update)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (Update)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (Update)

## Out of Scope

- Damage propagation (recursive damage to children).
- `RESOLVE_HIT_LOCATION` logic (this handler calls it, but doesn't implement it. Mock the call or use the previously implemented handler if available, but focus on the damage application).

## Reassessment

- **Assumption Correction:** The ticket originally required setting `is_destroyed = true` on the component when health reaches 0. Investigation of `data/mods/anatomy/components/part_health.component.json` reveals that this property does not exist in the schema. The `state` property set to "destroyed" is the correct way to indicate destruction. The requirement to set `is_destroyed` has been removed.
- **DI Registration:** Added necessary DI files to the Expected File List.

## Acceptance Criteria

### 1. Operation Schema

- Must define `APPLY_DAMAGE` type.
- Parameters: `entity_ref` (Req), `part_ref` (Optional), `amount` (Req, number), `damage_type` (Req, string).

### 2. Logic Implementation

- **Target Resolution:** If `part_ref` is missing, invoke `RESOLVE_HIT_LOCATION` (or delegate to `BodyGraphService` logic).
- **Health Calculation:** `new_health = current_health - amount`.
- **Clamping:** Health should not drop below 0 (unless spec allows negative, usually clamped at 0).
- **Status Update:**
  - 100-75%: "Healthy"
  - 75-50%: "Bruised"
  - 50-25%: "Wounded"
  - 25-0%: "Badly Damaged"
  - 0%: "Destroyed".
- **Persist:** Update the `anatomy:health` component on the entity.

### 3. Event Dispatch

- Dispatch `anatomy:damage_applied`: `{ entityId, partId, amount, damageType }`.
- Dispatch `anatomy:health_changed`: `{ entityId, partId, oldHealth, newHealth, statusLabel }`.
- Dispatch `anatomy:part_destroyed`: `{ entityId, partId }` (Only if health reaches 0).

### 4. Unit Tests

- **Direct Hit:** Apply 20 damage to a part with 100 HP. Assert health becomes 80, status "Healthy".
- **Threshold Crossing:** Apply 60 damage to 100 HP. Assert health 40, status "Wounded".
- **Destruction:** Apply 1000 damage. Assert health 0, status "Destroyed".
- **Events:** Verify that the correct events are emitted with correct payloads in each case.

### Invariants

- `current_health` must never exceed `max_health` (though this op decreases it, ensure logic respects bounds).
- Events must strictly follow the schema defined in specs.

## Outcome

- Implemented `ApplyDamageHandler` in `src/logic/operationHandlers/`.
- Created operation schema `data/schemas/operations/applyDamage.schema.json`.
- Registered handler in DI container (`tokens-core.js`, `operationHandlerRegistrations.js`) and interpreter (`interpreterRegistrations.js`).
- Implemented logic to resolve target part via `BodyGraphService` if not provided.
- Removed requirement for `is_destroyed` property on component as it is not supported by schema; relied on `state: "destroyed"`.
- Added comprehensive unit tests covering direct damage, thresholds, destruction, and edge cases.
