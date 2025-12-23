# MODMANSTAENH-012: Configuration Profile UI Section

**Status:** Completed
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-009
**Parent:** MODMANSTAENH-000

---

## Objective

Add a "Configuration Profile" section to SummaryPanelView that displays the foundation vs optional ratio, including visual bar representation and profile classification badge. Data is passed via the `render()` method's `profileRatio` parameter, following the existing presentation-only view pattern.

---

## Architecture Clarification

**IMPORTANT**: SummaryPanelView is a **presentation-only view** that does NOT have direct access to services. All data flows through the `render()` method:

- **Constructor signature**: `{ container, logger, onSave }` - NO service injection
- **Data flow**: Controller calls services → passes pre-calculated data to `render()` → view renders DOM
- **Existing pattern**: `depthAnalysis`, `footprintAnalysis`, `healthStatus` are all passed via `render()`

The profile section follows the same pattern: `profileRatio` is passed as a new optional parameter to `render()`.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add profile section)
- `css/mod-manager.css` (add profile styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/ModManagerBootstrap.js` - no changes needed
- `src/modManager/controllers/ModManagerController.js` - already has service
- Depth UI (MODMANSTAENH-010)
- Footprint UI (MODMANSTAENH-011)
- Any calculation logic (handled by service)

---

## Implementation Details

### Changes to SummaryPanelView.js

1. **Add private field**: `#profileSection`
2. **Update `#createStructure()`**: Create profile section element
3. **Update `render()` signature**: Add `profileRatio = null` parameter
4. **Add `#renderProfileSection(profileRatio)`**: Render profile content dynamically
5. **Add `#formatProfileLabel(profile)`**: Format profile classification for display

### Section Structure (Corrected Pattern)

```javascript
/**
 * Render configuration profile section
 * @param {object|null} profileRatio - Profile ratio from ModStatisticsService
 * @param {number} profileRatio.foundationCount - Foundation mod count
 * @param {number} profileRatio.optionalCount - Optional mod count
 * @param {number} profileRatio.totalActive - Total active mods
 * @param {number} profileRatio.foundationPercentage - 0-100
 * @param {number} profileRatio.optionalPercentage - 0-100
 * @param {string} profileRatio.profile - 'foundation-heavy' | 'balanced' | 'content-heavy'
 */
#renderProfileSection(profileRatio) {
  this.#profileSection.innerHTML = '';

  // Hide section if no profile data
  if (!profileRatio) {
    this.#profileSection.hidden = true;
    return;
  }
  this.#profileSection.hidden = false;

  // Section header (collapsible button) - starts collapsed
  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.type = 'button';
  header.setAttribute('aria-expanded', 'false');
  header.innerHTML = `
    <span class="summary-panel__section-title">Configuration Profile</span>
    <span class="summary-panel__section-toggle" aria-hidden="true">▶</span>
  `;

  // Section content - starts collapsed
  const content = document.createElement('div');
  content.className =
    'summary-panel__section-content summary-panel__section-content--collapsed';

  if (profileRatio.totalActive === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'summary-panel__empty';
    emptyMessage.textContent = 'No active mods';
    content.appendChild(emptyMessage);
  } else {
    // Profile badge
    const badge = document.createElement('div');
    badge.className = `summary-panel__profile-badge summary-panel__profile-badge--${profileRatio.profile}`;
    badge.textContent = this.#formatProfileLabel(profileRatio.profile);
    content.appendChild(badge);

    // Ratio bar visualization
    const barContainer = document.createElement('div');
    barContainer.className = 'summary-panel__profile-bar-container';

    const foundationBar = document.createElement('div');
    foundationBar.className = 'summary-panel__profile-bar summary-panel__profile-bar--foundation';
    foundationBar.style.width = `${profileRatio.foundationPercentage}%`;
    foundationBar.setAttribute('aria-label', `Foundation: ${profileRatio.foundationPercentage}%`);

    const optionalBar = document.createElement('div');
    optionalBar.className = 'summary-panel__profile-bar summary-panel__profile-bar--optional';
    optionalBar.style.width = `${profileRatio.optionalPercentage}%`;
    optionalBar.setAttribute('aria-label', `Optional: ${profileRatio.optionalPercentage}%`);

    barContainer.appendChild(foundationBar);
    barContainer.appendChild(optionalBar);
    content.appendChild(barContainer);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'summary-panel__profile-legend';
    legend.innerHTML = `
      <div class="summary-panel__profile-legend-item">
        <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--foundation"></span>
        <span>Foundation: ${profileRatio.foundationCount} (${profileRatio.foundationPercentage}%)</span>
      </div>
      <div class="summary-panel__profile-legend-item">
        <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--optional"></span>
        <span>Optional: ${profileRatio.optionalCount} (${profileRatio.optionalPercentage}%)</span>
      </div>
    `;
    content.appendChild(legend);

    // Total count
    const total = document.createElement('div');
    total.className = 'summary-panel__profile-total';
    total.textContent = `Total Active: ${profileRatio.totalActive}`;
    content.appendChild(total);
  }

  // Toggle behavior
  header.addEventListener('click', () => {
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', String(!isExpanded));
    content.classList.toggle('summary-panel__section-content--collapsed');
    const toggle = header.querySelector('.summary-panel__section-toggle');
    if (toggle) {
      toggle.textContent = isExpanded ? '▶' : '▼';
    }
  });

  this.#profileSection.appendChild(header);
  this.#profileSection.appendChild(content);
}

/**
 * Format profile label for display
 * @param {string} profile - Profile classification
 * @returns {string} Human-readable label
 */
#formatProfileLabel(profile) {
  const labels = {
    'foundation-heavy': 'Foundation Heavy',
    'content-heavy': 'Content Heavy',
    'balanced': 'Balanced'
  };
  return labels[profile] || profile;
}
```

### CSS Updates

In `css/mod-manager.css`:

```css
/* Profile Section */
.summary-panel__profile-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  align-self: center;
  margin-bottom: 0.5rem;
}

.summary-panel__profile-badge--foundation-heavy {
  background-color: var(--color-foundation, #2a5a8a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-badge--content-heavy {
  background-color: var(--color-optional, #8a5a2a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-badge--balanced {
  background-color: var(--color-balanced, #5a8a5a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-bar-container {
  display: flex;
  height: 1.5rem;
  border-radius: 0.25rem;
  overflow: hidden;
  background-color: var(--secondary-bg-color, #333);
}

.summary-panel__profile-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.summary-panel__profile-bar--foundation {
  background-color: var(--color-foundation, #2a5a8a);
}

.summary-panel__profile-bar--optional {
  background-color: var(--color-optional, #8a5a2a);
}

.summary-panel__profile-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.summary-panel__profile-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-panel__profile-legend-color {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
}

.summary-panel__profile-legend-color--foundation {
  background-color: var(--color-foundation, #2a5a8a);
}

.summary-panel__profile-legend-color--optional {
  background-color: var(--color-optional, #8a5a2a);
}

.summary-panel__profile-total {
  font-size: 0.8125rem;
  color: var(--secondary-text-color, #aaa);
  text-align: center;
  padding-top: 0.5rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border-color, #444);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Profile badge display**
   - Shows correct badge for 'foundation-heavy'
   - Shows correct badge for 'content-heavy'
   - Shows correct badge for 'balanced'

2. **Bar visualization**
   - Foundation bar width matches percentage
   - Optional bar width matches percentage
   - Bars have correct aria-labels

3. **Legend and counts**
   - Shows foundation count and percentage
   - Shows optional count and percentage
   - Shows total active count

4. **Edge cases**
   - Empty message when no active mods (totalActive === 0)
   - Handles 0% optional correctly (100% foundation)
   - Section hidden when profileRatio is null

5. **Collapsible behavior**
   - Section starts collapsed
   - Toggles on header click

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. BEM naming convention maintained
3. Accessibility attributes present (aria-label on bars)
4. Consistent styling with other sections
5. Public API preserved (new optional parameter only)

---

## Verification Steps

```bash
# 1. Run SummaryPanelView tests
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose

# 2. Run all view tests
NODE_ENV=test npx jest tests/unit/modManager/views/ --no-coverage --silent

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent

# 4. Lint modified files
npx eslint src/modManager/views/SummaryPanelView.js css/mod-manager.css tests/unit/modManager/views/SummaryPanelView.test.js

# 5. Visual verification (manual)
# Open mod manager UI and verify profile section renders correctly
# Check bar proportions and badge styling
```

---

## Test Cases to Add

Following the correct pattern (data via `render()`, NOT service mocks):

```javascript
describe('Configuration Profile Section', () => {
  const defaultRenderOptions = (profileOverrides = {}) => ({
    loadOrder: [],
    activeCount: 0,
    explicitCount: 0,
    dependencyCount: 0,
    hotspots: [],
    healthStatus: null,
    depthAnalysis: null,
    footprintAnalysis: null,
    profileRatio: {
      foundationCount: 0,
      optionalCount: 0,
      totalActive: 0,
      foundationPercentage: 0,
      optionalPercentage: 0,
      foundationMods: [],
      profile: 'balanced',
      ...profileOverrides,
    },
    hasUnsavedChanges: false,
    isSaving: false,
    isLoading: false,
  });

  it('should display foundation-heavy badge correctly', () => {
    view.render(defaultRenderOptions({
      foundationCount: 8,
      optionalCount: 2,
      totalActive: 10,
      foundationPercentage: 80,
      optionalPercentage: 20,
      profile: 'foundation-heavy'
    }));

    const badge = container.querySelector('.summary-panel__profile-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('Foundation Heavy');
    expect(badge.classList.contains('summary-panel__profile-badge--foundation-heavy')).toBe(true);
  });

  // ... additional test cases following this pattern
});
```

---

## Outcome

**Completed Successfully**

### Implementation Summary

1. **SummaryPanelView.js changes (~115 lines)**:
   - Added `#profileSection` private field
   - Created profile section element in `#createStructure()`
   - Added `profileRatio` parameter to `render()` method
   - Implemented `#renderProfileSection(profileRatio)` method
   - Implemented `#formatProfileLabel(profile)` helper

2. **CSS additions (~85 lines)**:
   - Profile badge styles with 3 badge variants (foundation-heavy, content-heavy, balanced)
   - Ratio bar visualization styles
   - Legend and total count styles
   - All using BEM naming convention

3. **Test coverage (14 new tests)**:
   - Badge display for all profile types
   - Bar visualization with correct widths
   - Aria-labels for accessibility
   - Legend and total display
   - Edge cases (empty mods, 100% foundation, null profileRatio)
   - Collapsible behavior (starts collapsed, toggle on click)
   - Unknown profile graceful fallback

### Test Results

- **SummaryPanelView tests**: 86 passed
- **All modManager tests**: 730 passed
- **ESLint**: 0 errors (only pre-existing JSDoc warnings)

### Architecture Note

The original ticket incorrectly assumed direct service access. The ticket was corrected to follow the established presentation-only view pattern where all data flows through the `render()` method.

---

## Notes

- The original ticket assumed direct service access which was incorrect
- This revised version follows the established presentation-only view pattern
- All tests pass data through the `render()` method, not service mocks
- The section follows the same collapsible pattern as Depth and Footprint sections
