# EXPDIAPATSENANA-008: UI Integration for Branch Display

## Summary

Update the Expression Diagnostics UI to display path-sensitive analysis results with per-branch reachability cards, knife-edge warnings, and an overall summary indicating whether the expression can trigger.

## Priority: Medium | Effort: Medium

## Rationale

The path-sensitive analyzer produces rich per-branch data that needs to be presented to content authors. This ticket creates the UI components to:
1. Display branch cards showing feasibility status
2. Show per-branch threshold reachability
3. Highlight knife-edge warnings with contributing gates
4. Provide a clear summary of whether the expression CAN trigger

## Dependencies

- **EXPDIAPATSENANA-006** (Complete PathSensitiveAnalyzer)
- **EXPDIAPATSENANA-007** (Integration tests passing - validates analyzer works)
- Existing `ExpressionDiagnosticsController.js`
- Existing `expression-diagnostics.html` and CSS

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expression-diagnostics.js` | **Modify** (integrate PathSensitiveAnalyzer) |
| `expression-diagnostics.html` | **Modify** (add branch display sections) |
| `css/expression-diagnostics.css` | **Modify** (add branch card styles) |

## Out of Scope

- **DO NOT** modify PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005/006
- **DO NOT** modify the models - those are EXPDIAPATSENANA-001-004
- **DO NOT** create unit tests for UI components (manual testing sufficient for HTML/CSS)
- **DO NOT** implement feasibility volume display - that's EXPDIAPATSENANA-009
- **DO NOT** modify existing static analysis display (keep for comparison/backward compatibility)

## Implementation Details

### HTML Updates (expression-diagnostics.html)

Add new sections for branch display:

```html
<!-- Add after existing results section -->

<section id="path-sensitive-results" class="results-section hidden">
  <h2>Path-Sensitive Analysis</h2>

  <div id="path-sensitive-summary" class="summary-card">
    <span id="ps-status-indicator" class="status-indicator"></span>
    <span id="ps-summary-message" class="summary-message"></span>
  </div>

  <div id="branch-overview" class="branch-overview">
    <span id="branch-count-display">Analyzing <span id="branch-count">0</span> branches...</span>
    <span id="reachable-count-display"><span id="reachable-count">0</span> fully reachable</span>
  </div>

  <div id="branch-cards-container" class="branch-cards-container">
    <!-- Branch cards will be inserted here dynamically -->
  </div>

  <details id="knife-edge-summary" class="knife-edge-summary hidden">
    <summary>
      <span class="ke-icon">⚠️</span>
      <span id="ke-count">0</span> Knife-Edge Constraint(s) Detected
    </summary>
    <table id="knife-edge-table" class="diagnostics-table">
      <thead>
        <tr>
          <th>Axis</th>
          <th>Interval</th>
          <th>Width</th>
          <th>Contributing Prototypes</th>
          <th>Branch</th>
        </tr>
      </thead>
      <tbody id="knife-edge-tbody">
        <!-- Knife-edge rows inserted dynamically -->
      </tbody>
    </table>
  </details>
</section>

<!-- Template for branch cards (hidden, cloned via JS) -->
<template id="branch-card-template">
  <div class="branch-card" data-status="pending">
    <div class="branch-card-header">
      <span class="branch-status-icon"></span>
      <span class="branch-title"></span>
    </div>
    <div class="branch-card-content">
      <div class="branch-prototypes">
        <strong>Required prototypes:</strong>
        <span class="prototype-list"></span>
      </div>
      <div class="branch-thresholds hidden">
        <table class="threshold-table">
          <thead>
            <tr>
              <th>Prototype</th>
              <th>Required</th>
              <th>Max Possible</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody class="threshold-tbody">
          </tbody>
        </table>
      </div>
      <div class="branch-knife-edges hidden">
        <div class="ke-warning">
          <span class="ke-icon">⚠️</span>
          <span class="ke-message"></span>
        </div>
      </div>
    </div>
  </div>
</template>
```

### CSS Updates (css/expression-diagnostics.css)

Add styles for branch cards:

```css
/* Path-Sensitive Analysis Section */
#path-sensitive-results {
  margin-top: var(--spacing-lg);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-color);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--border-color);
  margin-bottom: var(--spacing-md);
}

.summary-card[data-status="fully_reachable"] {
  border-left-color: var(--success-color, #22c55e);
  background: var(--success-bg, #f0fdf4);
}

.summary-card[data-status="partially_reachable"] {
  border-left-color: var(--warning-color, #eab308);
  background: var(--warning-bg, #fefce8);
}

.summary-card[data-status="unreachable"] {
  border-left-color: var(--error-color, #ef4444);
  background: var(--error-bg, #fef2f2);
}

.branch-overview {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm);
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-bottom: var(--spacing-md);
}

/* Branch Cards Container */
.branch-cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

/* Individual Branch Card */
.branch-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.branch-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.branch-card[data-status="reachable"] {
  border-color: var(--success-color, #22c55e);
}

.branch-card[data-status="reachable"] .branch-card-header {
  background: var(--success-bg, #f0fdf4);
}

.branch-card[data-status="knife-edge"] {
  border-color: var(--warning-color, #eab308);
}

.branch-card[data-status="knife-edge"] .branch-card-header {
  background: var(--warning-bg, #fefce8);
}

.branch-card[data-status="unreachable"] {
  border-color: var(--error-color, #ef4444);
}

.branch-card[data-status="unreachable"] .branch-card-header {
  background: var(--error-bg, #fef2f2);
}

.branch-card[data-status="infeasible"] {
  border-color: var(--error-color, #ef4444);
  opacity: 0.7;
}

.branch-card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--surface-alt);
  font-weight: 500;
}

.branch-status-icon {
  font-size: 1.2em;
}

.branch-card-content {
  padding: var(--spacing-md);
}

.branch-prototypes {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-sm);
}

.prototype-list {
  color: var(--text-secondary);
}

/* Threshold Table within Branch Card */
.threshold-table {
  width: 100%;
  font-size: var(--font-sm);
  border-collapse: collapse;
  margin-top: var(--spacing-sm);
}

.threshold-table th,
.threshold-table td {
  padding: var(--spacing-xs) var(--spacing-sm);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.threshold-table th {
  font-weight: 500;
  color: var(--text-muted);
}

/* Knife-Edge Warning within Card */
.branch-knife-edges {
  margin-top: var(--spacing-sm);
}

.ke-warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--warning-bg, #fefce8);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
}

/* Knife-Edge Summary Section */
.knife-edge-summary {
  margin-top: var(--spacing-md);
  border: 1px solid var(--warning-color, #eab308);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.knife-edge-summary summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--warning-bg, #fefce8);
  cursor: pointer;
  font-weight: 500;
}

.knife-edge-summary[open] summary {
  border-bottom: 1px solid var(--warning-color, #eab308);
}

#knife-edge-table {
  width: 100%;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .branch-cards-container {
    grid-template-columns: 1fr;
  }

  .branch-overview {
    flex-direction: column;
    gap: var(--spacing-xs);
  }
}
```

### JavaScript Updates (src/expression-diagnostics.js)

Add methods to render path-sensitive results:

```javascript
// Add to ExpressionDiagnosticsController or create separate renderer

/**
 * Render path-sensitive analysis results
 * @param {PathSensitiveResult} result
 */
function renderPathSensitiveResults(result) {
  const section = document.getElementById('path-sensitive-results');
  section.classList.remove('hidden');

  // Update summary
  const summaryCard = document.getElementById('path-sensitive-summary');
  summaryCard.dataset.status = result.overallStatus;

  document.getElementById('ps-status-indicator').textContent = result.statusEmoji;
  document.getElementById('ps-summary-message').textContent = result.getSummaryMessage();

  // Update counts
  document.getElementById('branch-count').textContent = result.branchCount;
  document.getElementById('reachable-count').textContent = result.fullyReachableBranchIds.length;

  // Render branch cards
  const container = document.getElementById('branch-cards-container');
  container.innerHTML = '';

  for (const branch of result.branches) {
    const card = createBranchCard(branch, result);
    container.appendChild(card);
  }

  // Render knife-edge summary
  renderKnifeEdgeSummary(result);
}

/**
 * Create a branch card element
 * @param {AnalysisBranch} branch
 * @param {PathSensitiveResult} result
 * @returns {HTMLElement}
 */
function createBranchCard(branch, result) {
  const template = document.getElementById('branch-card-template');
  const card = template.content.cloneNode(true).querySelector('.branch-card');

  // Determine status
  let status = 'reachable';
  if (branch.isInfeasible) {
    status = 'infeasible';
  } else if (branch.knifeEdges.length > 0) {
    status = 'knife-edge';
  } else {
    const branchReachability = result.getReachabilityForBranch(branch.branchId);
    const allReachable = branchReachability.every(r => r.isReachable);
    if (!allReachable) {
      status = 'unreachable';
    }
  }

  card.dataset.status = status;

  // Status icon
  const statusIcons = {
    reachable: '✅',
    'knife-edge': '⚠️',
    unreachable: '❌',
    infeasible: '🚫'
  };
  card.querySelector('.branch-status-icon').textContent = statusIcons[status];

  // Title
  card.querySelector('.branch-title').textContent = branch.description;

  // Prototypes
  card.querySelector('.prototype-list').textContent =
    branch.requiredPrototypes.join(', ') || 'none';

  // Threshold table (if unreachable)
  if (status === 'unreachable' || status === 'knife-edge') {
    const branchReachability = result.getReachabilityForBranch(branch.branchId);
    const unreachable = branchReachability.filter(r => !r.isReachable);

    if (unreachable.length > 0) {
      const thresholdsDiv = card.querySelector('.branch-thresholds');
      thresholdsDiv.classList.remove('hidden');

      const tbody = card.querySelector('.threshold-tbody');
      for (const r of unreachable) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${r.prototypeId}</td>
          <td>${r.threshold.toFixed(2)}</td>
          <td>${r.maxPossible.toFixed(2)}</td>
          <td>${r.gap.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
      }
    }
  }

  // Knife-edge warning
  if (branch.knifeEdges.length > 0) {
    const keDiv = card.querySelector('.branch-knife-edges');
    keDiv.classList.remove('hidden');

    const keMessage = branch.knifeEdges
      .map(ke => `${ke.axis}: ${ke.formatInterval()}`)
      .join('; ');
    card.querySelector('.ke-message').textContent = keMessage;
  }

  return card;
}

/**
 * Render knife-edge summary section
 * @param {PathSensitiveResult} result
 */
function renderKnifeEdgeSummary(result) {
  const keSection = document.getElementById('knife-edge-summary');
  const allKnifeEdges = result.allKnifeEdges;

  if (allKnifeEdges.length === 0) {
    keSection.classList.add('hidden');
    return;
  }

  keSection.classList.remove('hidden');
  document.getElementById('ke-count').textContent = allKnifeEdges.length;

  const tbody = document.getElementById('knife-edge-tbody');
  tbody.innerHTML = '';

  for (const ke of allKnifeEdges) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${ke.axis}</td>
      <td>${ke.formatInterval()}</td>
      <td>${ke.width.toFixed(3)}</td>
      <td>${ke.formatContributors()}</td>
      <td>${ke.branchId || '-'}</td>
    `;
    tbody.appendChild(row);
  }
}

/**
 * Clear path-sensitive results
 */
function clearPathSensitiveResults() {
  const section = document.getElementById('path-sensitive-results');
  section.classList.add('hidden');
  document.getElementById('branch-cards-container').innerHTML = '';
  document.getElementById('knife-edge-tbody').innerHTML = '';
}
```

## Acceptance Criteria

### Manual Testing Requirements

Since this is UI work, acceptance is verified through manual testing:

1. **Load expression-diagnostics.html in browser**
2. **Select `flow_absorption` expression**
3. **Click "Run Analysis"**
4. **Verify UI displays:**
   - Summary card with green status and "CAN trigger" message
   - Branch count shows 3+ branches
   - Reachable count shows 2+ branches
   - Branch cards for each enumerated path
   - Interest/fascination branches show ✅
   - Entrancement branch shows ⚠️ with knife-edge warning
   - Knife-edge summary section shows agency_control constraint
   - Unreachable thresholds table shows flow max ~0.77 in entrancement branch

### Visual Verification Checklist

- [ ] Summary card has correct color based on status
- [ ] Branch cards are displayed in responsive grid
- [ ] Status icons are correct (✅, ⚠️, ❌, 🚫)
- [ ] Prototype list is visible for each branch
- [ ] Knife-edge warnings are highlighted with yellow background
- [ ] Threshold tables show gap correctly
- [ ] Knife-edge summary expands/collapses correctly
- [ ] Mobile layout works (single column)
- [ ] Existing static analysis results still display (backward compatibility)

### Invariants That Must Remain True

1. **Backward compatibility** - Old static analysis results still display
2. **No analysis modification** - UI only displays, doesn't change analysis
3. **Responsive design** - Works on mobile and desktop
4. **Accessible** - Uses semantic HTML, proper headings

## Verification Commands

```bash
# Build the app
npm run build

# Start dev server
npm run dev

# Open in browser
# Navigate to expression-diagnostics.html
# Test with flow_absorption expression
```

## Definition of Done

- [ ] HTML template for branch cards added
- [ ] CSS styles for branch cards and statuses added
- [ ] JavaScript rendering functions added
- [ ] PathSensitiveAnalyzer integrated into analysis flow
- [ ] Summary card displays correct status
- [ ] Branch cards display for each branch
- [ ] Knife-edge warnings visible with correct styling
- [ ] Threshold tables show unreachable details
- [ ] Manual testing confirms correct display for flow_absorption
- [ ] Responsive layout works on mobile
- [ ] Existing static analysis display preserved
