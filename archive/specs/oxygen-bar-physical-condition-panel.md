# Specification: Oxygen Bar in Physical Condition Panel

## Overview

Add an oxygen level bar to the "Physical Condition" panel in `game.html`, displayed below the existing health bar. The bar shows the current oxygen percentage aggregated from all respiratory organs (lungs, gills, etc.) in the character's body.

## Current System Context

### Physical Condition Panel
- **Location**: `game.html` lines 52-63, `#injury-status-widget`
- **Controller**: `src/domUI/injuryStatusPanel.js`
- **Update Trigger**: `TURN_STARTED_ID` event at beginning of actor's turn
- **Health Bar Pattern**: `.health-bar-wrapper` → `.health-bar-container` → `.health-bar-fill` + `.health-percentage-text`

### Oxygen Data Model
- **Component**: `breathing-states:respiratory_organ`
- **Fields**:
  - `oxygenCapacity`: Maximum oxygen units (integer ≥ 1)
  - `currentOxygen`: Current stored oxygen (integer ≥ 0)
  - `depletionRate`: Units lost per turn when not breathing (default: 1)
  - `restorationRate`: Units restored per turn when breathing (default: 10)
- **Storage**: Each respiratory organ entity has its own component instance

### Existing Lung Entities (Reference)
| Species | Per-Organ Capacity | Total Capacity |
|---------|-------------------|----------------|
| Human | 10 | 20 (2 lungs) |
| Amphibian | 6 | 12 (2 lungs) |
| Feline | 8 | 16 (2 lungs) |
| Reptilian | 20 | 40 (2 lungs) |

### Existing Oxygen Handlers
- `depleteOxygenHandler.js`: Reduces oxygen when submerged/not breathing
- `restoreOxygenHandler.js`: Restores oxygen when breathing normally
- Event `breathing-states:oxygen_depleted`: Fired when total oxygen = 0

---

## Feature Requirements

### FR-1: Oxygen Percentage Calculation

**FR-1.1**: Create an `OxygenAggregationService` (or extend existing service) that:
- Finds all respiratory organ entities owned by the actor
- Uses `anatomy:part` component's `ownerEntityId` to identify ownership
- Aggregates `currentOxygen` from all organs
- Aggregates `oxygenCapacity` from all organs
- Calculates percentage: `Math.round((totalCurrentOxygen / totalOxygenCapacity) * 100)`
- Returns integer 0-100

**FR-1.2**: Handle edge cases:
- **No respiratory organs**: Return `null` or indicator to hide bar
- **Single organ**: Calculate from single organ (e.g., some creatures)
- **Multiple organs**: Sum all oxygen values
- **Zero capacity** (invalid data): Return 0% or hide bar
- **Oxygen > capacity** (data corruption): Clamp to 100%

### FR-2: Oxygen Bar Display

**FR-2.1**: Visual design:
- **Position**: Below the health bar, within `#injury-status-content`
- **Color**: Blue color scheme for oxygen association
  - Suggested: `#2196F3` (Material Blue) or `#1976D2` (darker blue)
- **Structure**: Follow health bar pattern:
  ```html
  <div class="oxygen-bar-wrapper [severity-class]">
    <div class="oxygen-bar-container">
      <div class="oxygen-bar-fill" style="width: X%"></div>
    </div>
    <span class="oxygen-percentage-text">X%</span>
  </div>
  ```

**FR-2.2**: Severity classes for oxygen (threshold percentages):
| Class | Range | Color | Description |
|-------|-------|-------|-------------|
| `oxygen-full` | 80-100% | Blue (#2196F3) | Normal breathing |
| `oxygen-low` | 40-79% | Yellow-Blue (#FFC107) | Mild oxygen depletion |
| `oxygen-critical` | 1-39% | Orange (#FF9800) | Severe oxygen depletion |
| `oxygen-depleted` | 0% | Red (#F44336) | No oxygen (suffocating) |

**FR-2.3**: Label/identifier:
- Show "O₂" subscript label before/alongside the bar
- Accessible: Include `aria-label="Oxygen level: X%"`

**FR-2.4**: Critical state animation:
- When oxygen = 0% (depleted), apply pulsing animation similar to dying state
- CSS animation: `suffocating-pulse` with 1.5s ease-in-out infinite
- Visual urgency to indicate immediate danger

### FR-3: UI Update Triggers

**FR-3.1**: Update on `TURN_STARTED_ID` event (same as health bar)
- Recalculate oxygen percentage from current component data
- Re-render bar with updated percentage and severity class

**FR-3.2**: Immediate updates after oxygen operations:
- After `DEPLETE_OXYGEN` operation executes
- After `RESTORE_OXYGEN` operation executes
- Consider subscribing to `breathing-states:oxygen_depleted` event

### FR-4: Conditional Display

**FR-4.1**: Hide oxygen bar when:
- Actor has no respiratory organs (e.g., undead, constructs)
- System has oxygen display disabled (future configuration)

**FR-4.2**: Show oxygen bar when:
- Actor has at least one respiratory organ (always visible, even at 100%)

---

## Technical Implementation Notes

### Service Pattern (Follow InjuryAggregationService)

```javascript
// Pseudo-implementation pattern
class OxygenAggregationService {
  aggregateOxygen(entityId) {
    // 1. Get all entities with breathing-states:respiratory_organ component
    // 2. Filter by ownership (anatomy:part.ownerEntityId === entityId)
    // 3. Sum currentOxygen and oxygenCapacity
    // 4. Return { totalCurrent, totalCapacity, percentage, organCount }
  }
}
```

### Integration with InjuryStatusPanel

Option A: Extend `InjuryStatusPanel` to include oxygen bar
- Add oxygen aggregation call in `updateForActor()`
- Add `#createOxygenBar()` method following `#createHealthBar()` pattern
- Add oxygen severity class logic

Option B: Create separate `OxygenStatusPanel` widget
- More modular but adds complexity
- May be overkill for single bar addition

**Recommendation**: Option A (extend existing panel)

### CSS Additions (css/components/_injury-status-panel.css)

```css
/* Oxygen bar specific styles */
.oxygen-bar-wrapper { /* similar to .health-bar-wrapper */ }
.oxygen-bar-container { /* similar to .health-bar-container */ }
.oxygen-bar-fill {
  background-color: #2196F3; /* Blue base */
  transition: width 0.3s ease-in-out, background-color 0.3s ease-in-out;
}

/* Oxygen severity colors */
.oxygen-full .oxygen-bar-fill { background-color: #2196F3; }
.oxygen-low .oxygen-bar-fill { background-color: #FFC107; }
.oxygen-critical .oxygen-bar-fill { background-color: #FF9800; }
.oxygen-depleted .oxygen-bar-fill { background-color: #F44336; }

/* Suffocating state animation (0% oxygen) */
.oxygen-depleted {
  animation: suffocating-pulse 1.5s ease-in-out infinite;
}

@keyframes suffocating-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* O₂ label styling */
.oxygen-label {
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 4px;
  color: #2196F3;
}
```

---

## Testing Requirements

### T-1: Unit Tests for OxygenAggregationService

**T-1.1**: Basic aggregation tests
- [ ] Test aggregation with single respiratory organ
- [ ] Test aggregation with two respiratory organs (standard case)
- [ ] Test aggregation with three or more respiratory organs
- [ ] Test percentage calculation accuracy (e.g., 15/20 = 75%)

**T-1.2**: Edge case tests
- [ ] Test with no respiratory organs → returns null/indicator
- [ ] Test with zero total capacity → handles gracefully
- [ ] Test with currentOxygen = 0 → returns 0%
- [ ] Test with currentOxygen = oxygenCapacity → returns 100%
- [ ] Test with currentOxygen > oxygenCapacity → clamps to 100%
- [ ] Test with different organ types mixed (lung + gill if applicable)

**T-1.3**: Ownership validation tests
- [ ] Test only aggregates organs owned by specified entity
- [ ] Test ignores organs owned by other entities
- [ ] Test handles organs with missing ownerEntityId gracefully

### T-2: Unit Tests for Oxygen Bar Rendering

**T-2.1**: DOM structure tests
- [ ] Test oxygen bar wrapper created with correct classes
- [ ] Test oxygen bar fill has correct width percentage
- [ ] Test percentage text displays correct value
- [ ] Test accessibility attributes present (aria-label)

**T-2.2**: Severity class tests
- [ ] Test `oxygen-full` class at 100%, 90%, 80%
- [ ] Test `oxygen-low` class at 79%, 50%, 40%
- [ ] Test `oxygen-critical` class at 39%, 20%, 1%
- [ ] Test `oxygen-depleted` class at 0%
- [ ] Test class transitions when percentage changes

**T-2.3**: Conditional display tests
- [ ] Test bar hidden when actor has no respiratory organs
- [ ] Test bar shown when actor has respiratory organs
- [ ] Test bar updates correctly on turn change

### T-3: Integration Tests

**T-3.1**: Event integration tests
- [ ] Test oxygen bar updates on `TURN_STARTED_ID` event
- [ ] Test oxygen bar reflects current component state after depletion
- [ ] Test oxygen bar reflects current component state after restoration

**T-3.2**: Handler integration tests
- [ ] Test `DEPLETE_OXYGEN` reduces displayed percentage correctly
- [ ] Test `RESTORE_OXYGEN` increases displayed percentage correctly
- [ ] Test `restoreFull: true` shows 100% after execution

**T-3.3**: Multi-organ scenarios
- [ ] Test human with two lungs showing combined percentage
- [ ] Test creature with single organ showing correct percentage
- [ ] Test asymmetric damage (one lung at 50%, one at 100%)

### T-4: Visual/Styling Tests

**T-4.1**: CSS validation
- [ ] Test bar height and spacing match design
- [ ] Test color scheme matches specification
- [ ] Test transition animations work correctly
- [ ] Test responsive behavior (if applicable)

---

## Acceptance Criteria

1. **AC-1**: Oxygen bar appears below health bar when actor has respiratory organs
2. **AC-2**: Oxygen percentage accurately reflects sum of all respiratory organ oxygen levels
3. **AC-3**: Bar color changes based on oxygen level severity thresholds
4. **AC-4**: Bar updates at the start of each turn
5. **AC-5**: Bar reflects changes after oxygen depletion operations
6. **AC-6**: Bar reflects changes after oxygen restoration operations
7. **AC-7**: Bar is hidden for actors without respiratory organs
8. **AC-8**: All tests pass with ≥80% branch coverage

---

## Files to Create/Modify

### New Files
- `src/anatomy/services/oxygenAggregationService.js` - Oxygen data aggregation
- `tests/unit/anatomy/services/oxygenAggregationService.test.js` - Unit tests
- `tests/integration/domUI/oxygenBarDisplay.integration.test.js` - Integration tests

### Modified Files
- `src/domUI/injuryStatusPanel.js` - Add oxygen bar rendering
- `css/components/_injury-status-panel.css` - Add oxygen bar styles
- `src/dependencyInjection/tokens/` - Add service token if needed
- `src/dependencyInjection/registrations/` - Register new service

---

## Design Decisions (Resolved)

1. **Visibility**: Always visible when actor has respiratory organs (even at 100%)
2. **Label**: Show "O₂" subscript label next to the bar
3. **Critical State**: Pulsing animation when oxygen = 0% (suffocating state)
4. **Restoration Indicator**: Not required for initial implementation

---

## Dependencies

- Existing `breathing-states:respiratory_organ` component schema
- Existing `depleteOxygenHandler.js` and `restoreOxygenHandler.js`
- Existing `InjuryStatusPanel` and health bar CSS patterns
- `TURN_STARTED_ID` event subscription pattern
