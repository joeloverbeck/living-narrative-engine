# MODMANIMP-007: Index.html Button

**Status:** Completed
**Priority:** Phase 2 (Frontend Foundation)
**Estimated Effort:** S (1-2 hours)
**Dependencies:** MODMANIMP-004 (HTML entry point)

---

## Objective

Add a "Mod Manager" button to the index.html "Game Operations" section that navigates to the Mod Manager page. Follows the existing button styling pattern.

---

## Files to Touch

### Modified Files

- `index.html` (ADD button to Game Operations section)

---

## Out of Scope

**DO NOT modify:**

- Any CSS files (button styles already exist)
- Other HTML files
- Button functionality beyond navigation

**Note:** JavaScript WILL be added for the click handler, following the existing pattern.

---

## Implementation Details

### Button Location

Find the "Game Operations" section in index.html and add the Mod Manager button. The **actual** section structure is:

```html
<section
  class="button-category button-category--game"
  aria-labelledby="game-operations-title"
>
  <h2 id="game-operations-title" class="category-title">
    Game Operations
  </h2>
  <p class="category-description">
    Start playing or continue your adventure
  </p>
  <div class="button-grid button-grid--2col">
    <!-- Existing buttons -->
    <button
      id="start-button"
      class="menu-button nav-button nav-button--game"
    >
      <span class="button-icon" aria-hidden="true">🎮</span>
      <span class="button-text">Start New Game</span>
    </button>
    <!-- ... other buttons ... -->
  </div>
</section>
```

### Button HTML

```html
<button
  id="mod-manager-button"
  class="menu-button nav-button nav-button--game"
>
  <span class="button-icon" aria-hidden="true">📦</span>
  <span class="button-text">Mod Manager</span>
</button>
```

### JavaScript Click Handler

Following the existing pattern, add:

```javascript
document
  .getElementById('mod-manager-button')
  .addEventListener('click', () => {
    window.location.href = 'mod-manager.html';
  });
```

### Placement

Insert the Mod Manager button **before** the "Start New Game" button, as mod configuration should logically happen before starting a game.

### Grid Update

Change `button-grid--2col` to `button-grid--3col` to accommodate the third button.

### Full Diff Preview

```diff
- <div class="button-grid button-grid--2col">
+ <div class="button-grid button-grid--3col">
+   <button
+     id="mod-manager-button"
+     class="menu-button nav-button nav-button--game"
+   >
+     <span class="button-icon" aria-hidden="true">📦</span>
+     <span class="button-text">Mod Manager</span>
+   </button>
    <button
      id="start-button"
      class="menu-button nav-button nav-button--game"
    >
```

And in the script section:

```diff
+ document
+   .getElementById('mod-manager-button')
+   .addEventListener('click', () => {
+     window.location.href = 'mod-manager.html';
+   });
  document.getElementById('start-button').addEventListener('click', () => {
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **HTML is valid after modification:**
   ```bash
   npx html-validate index.html || echo "Install html-validate for validation"
   ```

2. **Button exists and links correctly:**
   ```bash
   grep -q 'mod-manager-button' index.html && \
   grep -q 'Mod Manager' index.html && \
   echo "Button present"
   ```

3. **Button uses correct styling classes:**
   ```bash
   grep 'mod-manager-button' index.html | grep -q 'nav-button nav-button--game' && \
   echo "Styling correct"
   ```

4. **Button has icon and text spans:**
   ```bash
   grep -A2 'mod-manager-button' index.html | grep -q 'button-icon' && \
   grep -A3 'mod-manager-button' index.html | grep -q 'button-text' && \
   echo "Structure correct"
   ```

5. **JavaScript handler exists:**
   ```bash
   grep -q "getElementById('mod-manager-button')" index.html && \
   grep -q "mod-manager.html" index.html && \
   echo "Handler present"
   ```

### Invariants That Must Remain True

1. All existing buttons remain functional
2. Button uses existing nav-button--game class (no new CSS needed)
3. Button is placed in "Game Operations" section
4. Button follows existing icon + text span structure with aria-hidden
5. Link target is relative (mod-manager.html, not absolute path)
6. JavaScript handler follows existing pattern using addEventListener

---

## Reference Files

- Button styling: `css/index-redesign.css` (nav-button classes)
- Button structure: Existing buttons in `index.html`
- Target page: `mod-manager.html` (MODMANIMP-004)

---

## Assumptions Corrected (2025-12-17)

The original ticket assumed anchor-based navigation (`<a href="...">`), but the actual implementation uses `<button>` elements with JavaScript click handlers. The ticket has been updated to reflect:

1. Use `<button>` element instead of `<a>` tag
2. Include `aria-hidden="true"` on the icon span
3. Use actual class names: `button-category`, `button-grid--Xcol`
4. Use actual ID: `game-operations-title` not `game-operations-heading`
5. Add JavaScript click handler following existing pattern
6. Update grid from 2col to 3col for third button

---

## Outcome (2025-12-17)

### What Was Changed vs Originally Planned

| Originally Planned | Actual Implementation |
|--------------------|----------------------|
| Add anchor tag `<a href="mod-manager.html">` | Added `<button id="mod-manager-button">` with JavaScript handler |
| No JavaScript changes | Added click handler following existing pattern |
| Keep grid as-is | Changed grid from `button-grid--2col` to `button-grid--3col` |

### Files Modified

1. **`index.html`**
   - Added Mod Manager button in "Game Operations" section before "Start New Game"
   - Changed grid class from `button-grid--2col` to `button-grid--3col`
   - Added JavaScript click handler for navigation to `mod-manager.html`

2. **`tests/unit/index.test.js`**
   - Added new test suite "Mod Manager Button" with 3 tests
   - Updated "All Menu Buttons" tests to include Mod Manager button
   - Updated button ID and event listener lists to include new button

### Tests Added/Modified

- **New tests:** 3 tests in "Mod Manager Button" describe block
- **Updated tests:** 3 tests in "All Menu Buttons" describe block to include Mod Manager

### Verification

All 13 tests pass (10 original updated + 3 new)
