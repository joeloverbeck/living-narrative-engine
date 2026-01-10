# Plan: Fix Expression Diagnostics Color Scheme Issues

## Status

- ✅ **Issue 1 (Emoji Mismatch)**: COMPLETED
- 🔄 **Issue 2 (Dropdown Race Condition)**: IN PROGRESS

---

## Issue 1: Emoji-Color Mismatch (COMPLETED ✅)

### Problem
The "rare" diagnostic status showed inconsistent visual indicators:
- **Dropdown badge**: MAGENTA circle (CSS `#EE3377`)
- **Status Summary**: YELLOW emoji (🟡) from hard-coded map
- **Monte Carlo rarity**: YELLOW emoji (🟡) from STATUS_THEME

### Root Causes Fixed
1. `statusTheme.js` had wrong emoji for rare (🟡 instead of 🟣)
2. `ExpressionDiagnosticsController.js` had hard-coded emoji map instead of using STATUS_INDICATORS
3. Tests expected wrong emoji

### Changes Made
- `src/expressionDiagnostics/statusTheme.js`: Line 56 `emoji: '🟣'`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`: Replaced hard-coded emojiMap with STATUS_INDICATORS lookup
- `tests/unit/expressionDiagnostics/models/DiagnosticResult.test.js`: Updated expected emoji
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`: Updated expected emoji
- `tests/unit/expressionDiagnostics/statusTheme.test.js`: NEW - regression tests for emoji-colorName consistency

---

## Issue 2: Dropdown Shows RED After Monte Carlo Shows PURPLE (Current)

### Problem
After Monte Carlo simulation shows "Rare" result with PURPLE circle, the dropdown (Expression Selection) incorrectly updates to show RED instead of purple.

### Root Cause Analysis (CONFIRMED)

**Bug Location**: `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `#persistExpressionStatus()` method (lines 985-1041)
- `#loadProblematicExpressionsPanel()` method (lines 790-835)

**Flow Analysis (Confirmed via code inspection)**:
```
1. Monte Carlo determines 'rare' status
2. #persistExpressionStatus() is called with status='rare'
3. ✅ Line 1012-1015: Calls server API to persist status
4. ✅ Line 1021-1025: Calls dropdown.updateOptionStatus(id, 'rare') - CORRECT
5. ✅ Line 1029-1034: Updates local cache #expressionStatuses - CORRECT
6. ❌ Line 1037: Calls #loadProblematicExpressionsPanel()
   └── Line 798: scanAllStatuses() re-reads ALL files from server
   └── Line 800: OVERWRITES #expressionStatuses with server data (potentially stale)
   └── Line 827: #updateDropdownStatuses() uses overwritten array
   └── Result: Dropdown gets overwritten with stale 'impossible' status (RED)
```

**Root Cause**: Race condition where:
1. `updateStatus()` sends write request to server
2. Server writes file to disk asynchronously
3. `scanAllStatuses()` reads files IMMEDIATELY (before write completes)
4. Stale data overwrites the correct in-memory state

**Why RED specifically**: The expression file on disk may contain 'impossible' from a previous static analysis run. The file hasn't been updated yet when scanAllStatuses reads it.

### Fix Strategy

**Option A (Recommended)**: Use local cache instead of re-scanning
In `#persistExpressionStatus()`, after updating local cache, refresh problematic pills panel using the **already-updated local cache** instead of re-scanning files.

**Option B**: Remove the panel refresh
Since the dropdown is already correctly updated, and the local cache is updated, the only thing missing is the problematic pills panel refresh. We could just use the local cache to render pills.

**Option C**: Add delay before refresh
Wait for server write to complete before refreshing. Less reliable.

### Implementation Steps

#### Step 1: Create Failing Test
**File**: `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`

Create test that reproduces the race condition:
```javascript
describe('Race Condition Prevention', () => {
  it('should not overwrite dropdown status when persisting status', async () => {
    // Arrange: Mock scanAllStatuses to return stale 'impossible' status
    mockExpressionStatusService.scanAllStatuses.mockResolvedValue({
      success: true,
      expressions: [{ id: 'test:expression', diagnosticStatus: 'impossible', filePath: 'test/path.json' }]
    });

    // Act: Persist 'rare' status
    // The persist should update dropdown to 'rare'
    // The subsequent panel refresh should NOT overwrite it with 'impossible'

    // Assert: Dropdown should still show 'rare', not 'impossible'
    expect(mockDropdown.updateOptionStatus).toHaveBeenLastCalledWith('test:expression', 'rare');
  });
});
```

#### Step 2: Fix the Race Condition
**File**: `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`

**Change 1**: Replace line 1037 in `#persistExpressionStatus()`:
```javascript
// OLD (line 1037):
await this.#loadProblematicExpressionsPanel();

// NEW:
// Refresh problematic pills using local cache (already updated above)
// This avoids the race condition where scanAllStatuses() returns stale data
this.#refreshProblematicPillsFromCache();
```

**Change 2**: Add new method `#refreshProblematicPillsFromCache()` after `#loadProblematicExpressionsPanel()`:
```javascript
/**
 * Refresh problematic pills panel using the in-memory cache.
 * Used after persisting status to avoid race condition with disk I/O.
 * @private
 */
#refreshProblematicPillsFromCache() {
  if (!this.#problematicPillsContainer) {
    this.#logger.warn('Problematic pills container not found in DOM');
    return;
  }

  const problematic = this.#expressionStatusService.getProblematicExpressions(
    this.#expressionStatuses,
    10
  );
  this.#renderProblematicPills(problematic);
}
```

#### Step 3: Verify Tests Pass
Run existing tests to ensure no regressions.

### Files to Modify

| File | Change |
|------|--------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Line 1037: Replace `#loadProblematicExpressionsPanel()` with `#refreshProblematicPillsFromCache()`. Add new `#refreshProblematicPillsFromCache()` method after line 835. |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | Add test for race condition prevention |

### Verification Plan

1. **Create failing test** that reproduces the race condition
2. **Run unit tests**: `npm run test:unit -- --testPathPattern="ExpressionDiagnosticsController"`
3. **Verify types**: `npm run typecheck`
4. **Lint modified files**: `npx eslint src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`
5. **Manual verification**:
   - Load `expression-diagnostics.html`
   - Select an expression with 'unknown' status (gray)
   - Run Static Analysis (should remain gray if Unknown)
   - Run Monte Carlo simulation
   - **Verify**: Dropdown shows PURPLE (not RED) after simulation shows "Rare"
   - Problematic pills panel should update correctly
