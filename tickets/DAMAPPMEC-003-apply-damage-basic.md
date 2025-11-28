# DAMAPPMEC-003: Apply Damage Operation (Basic)

## Description
Implement the core logic for the `APPLY_DAMAGE` operation. This ticket focuses on applying direct damage to a specific part, updating its health, handling thresholds/status labels, and dispatching events. **excludes damage propagation**.

## Expected File List
- `src/logic/operationHandlers/applyDamageHandler.js` (New)
- `data/schemas/operations/applyDamage.schema.json` (New)
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` (New)

## Out of Scope
- Damage propagation (recursive damage to children).
- `RESOLVE_HIT_LOCATION` logic (this handler calls it, but doesn't implement it. Mock the call or use the previously implemented handler if available, but focus on the damage application).

## Acceptance Criteria

### 1. Operation Schema
- Must define `APPLY_DAMAGE` type.
- Parameters: `entity_ref` (Req), `part_ref` (Optional), `amount` (Req, number), `damage_type` (Req, string).

### 2. Logic Implementation
- **Target Resolution:** If `part_ref` is missing, invoke `RESOLVE_HIT_LOCATION` (or fail if not available yet, but ideally it delegates).
- **Health Calculation:** `new_health = current_health - amount`.
- **Clamping:** Health should not drop below 0 (unless spec allows negative, usually clamped at 0).
- **Status Update:**
  - 100-75%: "Healthy"
  - 75-50%: "Bruised"
  - 50-25%: "Wounded"
  - 25-0%: "Badly Damaged"
  - 0%: "Destroyed" & `is_destroyed = true`.
- **Persist:** Update the `anatomy:health` component on the entity.

### 3. Event Dispatch
- Dispatch `anatomy:damage_applied`: `{ entityId, partId, amount, damageType }`.
- Dispatch `anatomy:health_changed`: `{ entityId, partId, oldHealth, newHealth, statusLabel }`.
- Dispatch `anatomy:part_destroyed`: `{ entityId, partId }` (Only if health reaches 0).

### 4. Unit Tests
- **Direct Hit:** Apply 20 damage to a part with 100 HP. Assert health becomes 80, status "Healthy".
- **Threshold Crossing:** Apply 60 damage to 100 HP. Assert health 40, status "Wounded".
- **Destruction:** Apply 1000 damage. Assert health 0, status "Destroyed", `is_destroyed` is true.
- **Events:** Verify that the correct events are emitted with correct payloads in each case.

### Invariants
- `current_health` must never exceed `max_health` (though this op decreases it, ensure logic respects bounds).
- Events must strictly follow the schema defined in specs.
