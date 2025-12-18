# Plan: Correct Documentation for Sense-Aware Perception Testing

## Issue Summary

The "Testing Upgraded Rules" section in `docs/modding/sense-aware-perception.md` contains **incorrect information** about the event payload contract.

### Discrepancy Found

**Documentation states (lines 509-514):**
> These parameters are consumed internally and will **always be undefined** in test assertions:
> - `actor_description` → NOT in payload
> - `target_description` → NOT in payload
> - `alternate_descriptions` → NOT in payload
> - `sense_aware` → NOT in payload

**Actual implementation (dispatchPerceptibleEventHandler.js lines 226-247):**
```javascript
const payload = {
  // ...standard fields...
  actorDescription: actor_description ?? null,
  targetDescription: target_description ?? null,
  alternateDescriptions: params.alternate_descriptions ?? null,
  senseAware: params.sense_aware ?? true,
  // ...
};
```

**Conclusion:** All four fields ARE included in the payload. The documentation is wrong.

## Plan

### Step 1: Update the "What Appears in Event Payload" table (lines 497-505)

Add the missing fields:
- `actor_description` → `actorDescription`
- `target_description` → `targetDescription`
- `alternate_descriptions` → `alternateDescriptions`
- `sense_aware` → `senseAware`

### Step 2: Remove/Replace "What Does NOT Appear in Payload" section (lines 507-514)

This entire section is incorrect and should be removed. Replace with a clarification about what these fields mean and how they're used.

### Step 3: Update "Incorrect Test Assertions" section (lines 533-539)

Remove the examples that claim these fields are "always undefined" since they ARE defined.

### Step 4: Update "What You CAN Test" and "What You CANNOT Test" sections

Adjust to reflect reality - tests CAN check these payload fields.

## Files to Modify

- `docs/modding/sense-aware-perception.md`

## Implementation Notes

The key insight is that:
1. **All parameters ARE in the broadcast payload** for the `core:perceptible_event`
2. The parameters are **also** passed separately to `AddPerceptionLogEntryHandler` for log routing
3. Tests CAN validate the presence and values of these fields in the event payload
