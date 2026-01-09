# EXPDIAPATSENANA-009: Feasibility Volume Calculation

## Summary

Implement the optional feasibility volume calculation that provides a crude measure of how "likely" an expression is to trigger naturally, even when technically possible. This helps identify expressions that are technically reachable but have such narrow constraint windows that they're unlikely to fire in practice.

## Priority: Low | Effort: Small

## Rationale

Some expressions may have all thresholds technically reachable, but the constraints create such a narrow "feasibility volume" that random states are unlikely to satisfy them. For example:
- `agency_control` must be between 0.09 and 0.11 (2% of range)
- `arousal` must be between 0.25 and 0.30 (5% of range)

The combined probability of hitting both constraints randomly is 0.02 × 0.05 = 0.001 (0.1%).

Feasibility volume provides a single metric indicating this practical difficulty.

## Dependencies

- **EXPDIAPATSENANA-006** (Complete PathSensitiveAnalyzer)
- No new model dependencies (volume is a simple number)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` | **Modify** (add volume calculation) |
| `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` | **Modify** (add volume tests) |
| `expression-diagnostics.html` | **Modify** (add volume display) |
| `css/expression-diagnostics.css` | **Modify** (add volume indicator styles) |

## Out of Scope

- **DO NOT** modify the models (volume is stored in PathSensitiveResult.feasibilityVolume, already defined)
- **DO NOT** change the analysis algorithm for reachability
- **DO NOT** implement Monte Carlo-based volume estimation (use geometric calculation only)
- **DO NOT** add volume to branch-level results (only overall volume)

## Implementation Details

### Feasibility Volume Calculation

Add to `PathSensitiveAnalyzer.js`:

```javascript
/**
 * Compute feasibility volume as the product of normalized interval widths.
 *
 * A volume of 0 means at least one axis is impossible.
 * A very small volume means technically possible but extremely unlikely.
 * Volume of 1 would mean no constraints at all.
 *
 * @private
 * @param {AnalysisBranch[]} branches
 * @returns {number} Maximum volume across all feasible branches (0-1 normalized)
 */
#computeFeasibilityVolume(branches) {
  let maxVolume = 0;

  for (const branch of branches) {
    if (branch.isInfeasible) continue;

    const volume = this.#computeBranchVolume(branch);
    maxVolume = Math.max(maxVolume, volume);
  }

  return maxVolume;
}

/**
 * Compute volume for a single branch
 * @private
 * @param {AnalysisBranch} branch
 * @returns {number}
 */
#computeBranchVolume(branch) {
  const intervals = branch.axisIntervals;

  if (intervals.size === 0) {
    return 1; // No constraints = full volume
  }

  let volume = 1;
  let constrainedAxes = 0;

  for (const [axis, interval] of intervals) {
    const width = interval.max - interval.min;

    // Skip if impossible (should already be flagged as infeasible)
    if (width < 0) return 0;

    // Normalize by axis total range
    const axisRange = this.#getAxisRange(axis);
    const normalizedWidth = width / axisRange;

    // Only count axes that are actually constrained (not full range)
    if (normalizedWidth < 0.99) {
      volume *= normalizedWidth;
      constrainedAxes++;
    }
  }

  // Adjust for number of constrained axes to make volume more interpretable
  // Single tight constraint shouldn't be as severe as multiple tight constraints
  if (constrainedAxes === 0) {
    return 1;
  }

  return volume;
}

/**
 * Get the total range for an axis (for normalization)
 * @private
 * @param {string} axis
 * @returns {number}
 */
#getAxisRange(axis) {
  // Mood axes are normalized to [0, 1] internally
  // Sexual axes are also [0, 1] normalized

  // Could be extended to support different ranges per axis
  return 1.0;
}

/**
 * Interpret volume as a human-readable category
 * @param {number} volume
 * @returns {{category: string, description: string, emoji: string}}
 */
static interpretVolume(volume) {
  if (volume === 0) {
    return {
      category: 'impossible',
      description: 'Cannot trigger - constraints are contradictory',
      emoji: '🔴'
    };
  }

  if (volume < 0.001) {
    return {
      category: 'extremely_unlikely',
      description: 'Extremely unlikely to trigger naturally (<0.1% of state space)',
      emoji: '🟠'
    };
  }

  if (volume < 0.01) {
    return {
      category: 'very_unlikely',
      description: 'Very unlikely to trigger naturally (0.1-1% of state space)',
      emoji: '🟡'
    };
  }

  if (volume < 0.1) {
    return {
      category: 'unlikely',
      description: 'Unlikely to trigger naturally (1-10% of state space)',
      emoji: '🟡'
    };
  }

  if (volume < 0.5) {
    return {
      category: 'moderate',
      description: 'Moderate trigger likelihood (10-50% of state space)',
      emoji: '🟢'
    };
  }

  return {
    category: 'likely',
    description: 'Likely to trigger naturally (>50% of state space)',
    emoji: '🟢'
  };
}
```

### Update analyze() Method

```javascript
analyze(expression, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ... existing analysis code ...

  // Compute feasibility volume if requested
  const feasibilityVolume = opts.computeVolume
    ? this.#computeFeasibilityVolume(branches)
    : null;

  return new PathSensitiveResult({
    expressionId: expression.id,
    branches,
    reachabilityByBranch,
    feasibilityVolume
  });
}
```

### HTML Update

Add volume indicator to summary:

```html
<div id="volume-indicator" class="volume-indicator hidden">
  <span id="volume-emoji" class="volume-emoji"></span>
  <span id="volume-label" class="volume-label"></span>
  <span id="volume-value" class="volume-value"></span>
  <span id="volume-description" class="volume-description"></span>
</div>
```

### CSS Update

```css
.volume-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--surface-alt);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  margin-top: var(--spacing-sm);
}

.volume-emoji {
  font-size: 1.2em;
}

.volume-label {
  font-weight: 500;
}

.volume-value {
  font-family: monospace;
  background: var(--surface-color);
  padding: 0.1em 0.4em;
  border-radius: var(--radius-xs);
}

.volume-description {
  color: var(--text-muted);
  font-style: italic;
}
```

### JavaScript Update

```javascript
/**
 * Render feasibility volume indicator
 * @param {PathSensitiveResult} result
 */
function renderVolumeIndicator(result) {
  const indicator = document.getElementById('volume-indicator');

  if (result.feasibilityVolume === null) {
    indicator.classList.add('hidden');
    return;
  }

  indicator.classList.remove('hidden');

  const interpretation = PathSensitiveAnalyzer.interpretVolume(result.feasibilityVolume);

  document.getElementById('volume-emoji').textContent = interpretation.emoji;
  document.getElementById('volume-label').textContent = 'Feasibility Volume:';
  document.getElementById('volume-value').textContent =
    (result.feasibilityVolume * 100).toFixed(2) + '%';
  document.getElementById('volume-description').textContent = interpretation.description;
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose
```

### Unit Test Coverage Requirements

**pathSensitiveAnalyzer.test.js (Feasibility Volume - new tests):**
- `#computeFeasibilityVolume()` returns 0 for all infeasible branches
- `#computeFeasibilityVolume()` returns maximum volume across branches
- `#computeFeasibilityVolume()` returns 1 when no constraints
- `#computeBranchVolume()` returns product of normalized widths
- `#computeBranchVolume()` returns 0 for impossible constraint
- `#computeBranchVolume()` handles single tight constraint
- `#computeBranchVolume()` handles multiple tight constraints
- `#getAxisRange()` returns 1.0 for normalized axes
- `interpretVolume()` returns 'impossible' for volume 0
- `interpretVolume()` returns 'extremely_unlikely' for volume < 0.001
- `interpretVolume()` returns 'very_unlikely' for volume < 0.01
- `interpretVolume()` returns 'unlikely' for volume < 0.1
- `interpretVolume()` returns 'moderate' for volume < 0.5
- `interpretVolume()` returns 'likely' for volume >= 0.5
- Volume is null when computeVolume option is false
- Volume is calculated when computeVolume option is true

### Invariants That Must Remain True

1. **Volume in [0, 1]** - Always properly bounded
2. **Volume = 0 iff infeasible** - Zero only for impossible constraints
3. **Max across branches** - Best branch determines overall volume
4. **Optional calculation** - Only computed when explicitly requested
5. **No reachability impact** - Volume doesn't change reachability determination

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose

# Type checking
npm run typecheck

# Manual verification
# 1. Build: npm run build
# 2. Open expression-diagnostics.html
# 3. Enable "Compute Feasibility Volume" option (add checkbox)
# 4. Analyze flow_absorption
# 5. Verify volume indicator shows reasonable value
```

## Definition of Done

- [ ] `#computeFeasibilityVolume()` method implemented
- [ ] `#computeBranchVolume()` method implemented
- [ ] `interpretVolume()` static method implemented
- [ ] `analyze()` method computes volume when option enabled
- [ ] Unit tests cover all volume calculation methods
- [ ] Unit tests cover interpretation function
- [ ] HTML volume indicator added
- [ ] CSS styles for volume indicator added
- [ ] JavaScript rendering for volume added
- [ ] All tests pass
- [ ] Manual verification shows reasonable volume values
