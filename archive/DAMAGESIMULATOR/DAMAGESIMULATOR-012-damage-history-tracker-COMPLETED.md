# DAMAGESIMULATOR-012: Create DamageHistoryTracker

## Summary
Create the `DamageHistoryTracker` component that maintains a session log of all damage applications. This provides a scrollable history showing timestamp, target part, damage dealt, effects triggered, and health changes.

## Dependencies
- DAMAGESIMULATOR-011 must be completed (DamageExecutionService for results)

## Assumption Corrections (Verified Against Codebase)

### Verified Correct
- `DamageSimulatorUI.js` exists at `src/domUI/damage-simulator/`
- `DamageExecutionService.js` exists with `damage-simulator:execution-complete` event (line 23)
- CSS history panel styles exist at lines 362-381 in `css/damage-simulator.css`
- HTML has `#history-log` container at line 113 in `damage-simulator.html`

### Corrections Applied
1. **Entity change event**: Use `damage-simulator:entity-loading` (from `DamageSimulatorUI.UI_EVENTS` line 47)
2. **Health data**: The `damage-simulator:execution-complete` payload doesn't include `healthBefore`/`healthAfter` values. The `DamageResult` from `DamageExecutionService.#extractResult()` contains: `success`, `targetPartId`, `targetPartName`, `damageDealt`, `damageType`, `severity`, `error`. **Solution**: Health display will show damage dealt only (no before/after tracking) since this would require subscribing to additional events or modifying DamageExecutionService (out of scope). Effects are extracted from `severity` field.

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageHistoryTracker.js` - History tracker
- `tests/unit/domUI/damage-simulator/DamageHistoryTracker.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate history panel
- `css/damage-simulator.css` - Add history panel styles

## Out of Scope
- DO NOT implement history export (future enhancement)
- DO NOT implement history persistence across page reloads
- DO NOT implement history filtering/search
- DO NOT modify DamageExecutionService

## Acceptance Criteria

### History Requirements
1. Record all damage applications from DamageExecutionService
2. Display in chronological order (newest first or last)
3. Show: timestamp, target part, damage amount, damage type, severity
4. Limit display to last N entries (default: 50)
5. Clear history on entity change
6. Provide "Clear History" button

### Display Requirements
1. Table or card-based display
2. Color coding for severity (minor=gray, moderate=orange, severe=red, critical=dark red)
3. Scrollable container for long history
4. Summary statistics at bottom (total damage, hit count)

### Tests That Must Pass
1. **Unit: DamageHistoryTracker.test.js**
   - `should record damage result`
   - `should display entries in order`
   - `should format timestamp correctly`
   - `should show target part name`
   - `should show damage amount`
   - `should show severity`
   - `should limit entries to maxEntries`
   - `should clear history on clearHistory()`
   - `should clear history on entity change`
   - `should calculate total damage`
   - `should calculate hit count`

**Note**: `should show health before and after` removed - health data not available in DamageResult (see Corrections Applied section).

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. History data stored in memory only
2. No external state persistence
3. History clears on entity change
4. No modifications to damage results

## Definition of Done
- [x] DamageHistoryTracker created with full JSDoc
- [x] Unit tests with ≥90% coverage
- [x] History panel integrated in UI
- [x] Entries display correctly with all fields
- [x] Summary statistics calculated and displayed
- [x] Clear button functions
- [x] History clears on entity change
- [x] Scrollable for long history
- [x] Effect badges styled correctly
- [x] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageHistoryTracker.js`

---

## Outcome

### Status: ✅ COMPLETED

### Implementation Summary
Successfully implemented the DamageHistoryTracker component with full integration into the Damage Simulator tool.

### Files Created
1. **`src/domUI/damage-simulator/DamageHistoryTracker.js`** (335 lines)
   - Full implementation with constructor, record(), render(), clearHistory(), getStatistics(), getEntries(), destroy()
   - Event subscriptions to `damage-simulator:execution-complete` and `damage-simulator:entity-loading`
   - XSS prevention via HTML escaping
   - Static EVENTS and MAX_ENTRIES_DEFAULT constants exposed for testing

2. **`tests/unit/domUI/damage-simulator/DamageHistoryTracker.test.js`** (42 test cases)
   - All ticket requirements covered
   - Additional edge case tests (empty results, missing fields, etc.)
   - Unsubscribe on destroy verified

### Files Modified
1. **`css/damage-simulator.css`**
   - Added history table styles (`.ds-history-table`, `.ds-history-table-container`)
   - Added severity badges (`.ds-severity-badge`, `.ds-severity-minor/moderate/severe/critical`)
   - Added summary section styles (`.ds-history-summary`)
   - Added row highlighting for severity levels

2. **`src/dependencyInjection/tokens/tokens-ui.js`**
   - Added `DamageHistoryTracker` token

3. **`src/dependencyInjection/registrations/damageSimulatorRegistrations.js`**
   - Added import and factory registration for DamageHistoryTracker

4. **`src/domUI/damage-simulator/DamageSimulatorUI.js`**
   - Added `historyTracker` to valid child component names in `setChildComponent`

5. **`src/damage-simulator.js`**
   - Added initialization code for DamageHistoryTracker with history log element lookup

### Test Results
- **DamageHistoryTracker.test.js**: 42/42 tests passing
- **All damage simulator tests**: 235/235 tests passing (6 test suites)
- **ESLint**: Passes with no warnings on DamageHistoryTracker.js

### Design Decisions
1. **Health data limitation**: Per ticket scope, did not modify DamageExecutionService to add healthBefore/healthAfter. Severity field provides damage classification instead.
2. **Factory pattern**: Used same DI factory pattern as other damage simulator components (containerElement provided at runtime).
3. **Event-driven updates**: Component self-subscribes to events and auto-renders on damage application.

### Date Completed
2025-12-31
