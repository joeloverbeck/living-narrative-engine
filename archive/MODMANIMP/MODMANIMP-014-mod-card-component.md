# MODMANIMP-014: ModCardComponent

**Status:** Completed
**Priority:** Phase 5 (UI Components)
**Estimated Effort:** S (3-4 hours)
**Dependencies:** None (CSS already exists in css/mod-manager.css)

---

## Objective

Create a reusable component for rendering individual mod cards. Each card displays mod metadata, status indicators, dependency information, and toggle controls. This is the fundamental building block for the mod list.

---

## Assumption Corrections (from codebase analysis)

The original ticket contained incorrect assumptions that have been corrected:

| Original Assumption | Corrected |
|---------------------|-----------|
| Reference: `src/domUI/components/ActionButtonComponent.js` | File doesn't exist; use simple DOM patterns |
| Reference: `src/domUI/helpers/htmlHelpers.js` | File doesn't exist; implement escapeHtml inline |
| Depends on MODMANIMP-005 for CSS | CSS already exists in `css/mod-manager.css` |
| CSS uses BEM double-underscore (`mod-card__header`) | CSS uses single-hyphen (`mod-card-header`) |

**Critical CSS alignment**: ModListView.js expects:
- `.mod-card__checkbox` (BEM notation, line 115)
- `.mod-card--locked` class (line 117)

The component must use these class names to work with ModListView.

---

## Files to Touch

### New Files

- `src/modManager/components/ModCardComponent.js`
- `tests/unit/modManager/components/ModCardComponent.test.js`

### Modified Files

- `css/mod-manager.css` - Add `.mod-card--locked` class

---

## Out of Scope

**DO NOT modify:**

- ModListView (will use this component)
- ModManagerController
- Animation logic (MODMANIMP-021 handles that)
- Conflict detection display (MODMANIMP-020)

---

## Implementation Details

### Component Class

See `src/modManager/components/ModCardComponent.js` for the actual implementation.

Key design decisions:
- Uses CSS class names that align with existing `css/mod-manager.css`
- Uses `.mod-card__checkbox` (BEM) as required by ModListView
- Uses `.mod-card--locked` for locked state detection
- Implements inline `#escapeHtml()` for XSS protection
- Provides `createCard()` and `updateCardState()` to match `ModCardComponentLike` interface

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ModCardComponent.test.js`):
   - `createCard returns article element with correct role`
   - `createCard sets data-mod-id attribute`
   - `createCard renders mod name and version`
   - `createCard renders description`
   - `createCard renders author`
   - `createCard shows checkbox checked for active mods`
   - `createCard shows checkbox disabled for core mods`
   - `createCard shows lock icon for core mods`
   - `createCard shows dependency badge for dependency status`
   - `createCard renders dependency count`
   - `createCard shows worlds badge when hasWorlds is true`
   - `createCard escapes HTML in all text fields`
   - `updateCardState updates checkbox state`
   - `updateCardState updates CSS classes`
   - `updateCardState adds/removes lock icon`
   - `addConflictIndicator adds conflict warning`
   - `removeConflictIndicator removes conflict warning`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/components/ModCardComponent.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **XSS prevention:**
   ```bash
   grep -q "escapeHtml" src/modManager/components/ModCardComponent.js && \
   grep -q "textContent" src/modManager/components/ModCardComponent.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. All user-provided text is HTML-escaped
2. Core mods always show lock icon and disabled checkbox
3. Dependency mods have disabled checkbox
4. Card has proper ARIA attributes for accessibility
5. Status badge text matches actual status
6. updateCardState modifies DOM in place (no re-creation)
7. Conflict indicators can be added/removed independently

---

## Reference Files

- CSS classes: `css/mod-manager.css` (already complete)
- ModListView interface: `src/modManager/views/ModListView.js` (defines `ModCardComponentLike`)
- ModMetadata type: `src/modManager/services/ModDiscoveryService.js`

---

## Outcome

### What Was Done

1. **Corrected ticket assumptions** - Updated ticket to reflect that reference files (`ActionButtonComponent.js`, `htmlHelpers.js`) don't exist and CSS already exists
2. **Created `src/modManager/components/ModCardComponent.js`** - Full implementation of ModCardComponentLike interface
3. **Created `tests/unit/modManager/components/ModCardComponent.test.js`** - 53 comprehensive unit tests
4. **Updated `css/mod-manager.css`** - Added `.mod-card--locked` class for ModListView integration

### Key Implementation Decisions

- Uses `.mod-card__checkbox` (BEM) for checkbox class as ModListView expects
- Uses `.mod-card--locked` for locked state detection by ModListView
- XSS protection via `textContent` (no innerHTML for user data)
- Logger integration with debug output for card creation
- Full ARIA accessibility support

### Test Results

- **53 unit tests passing** for ModCardComponent
- **13 unit tests passing** for ModListView (unchanged, validates integration)
- **0 ESLint errors** (warnings only for JSDoc style)
- **0 TypeScript errors** for new files

### Files Created/Modified

| File | Action | Reason |
|------|--------|--------|
| `src/modManager/components/ModCardComponent.js` | Created | Main component implementation |
| `tests/unit/modManager/components/ModCardComponent.test.js` | Created | 53 comprehensive unit tests |
| `css/mod-manager.css` | Modified | Added `.mod-card--locked` class |
| `tickets/MODMANIMP-014-mod-card-component.md` | Modified | Fixed assumptions, marked completed |
