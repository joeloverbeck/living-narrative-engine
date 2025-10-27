# ANABLUNONHUM-015: Implement Property-Based Slot Filtering

**Phase**: 3 - Recipe Pattern Enhancement
**Priority**: Critical
**Estimated Effort**: 6-8 hours
**Dependencies**: ANABLUNONHUM-003, ANABLUNONHUM-009

## Overview

Implement `matchesAll` property-based filtering in `RecipeProcessor`.

## Implementation

```javascript
class RecipeProcessor {
  #matchSlotProperties(filters, blueprint) {
    const matchedSlots = [];
    
    for (const [slotKey, slotDef] of Object.entries(blueprint.slots)) {
      if (this.#slotMatchesFilters(slotKey, slotDef, filters)) {
        matchedSlots.push(slotKey);
      }
    }
    
    return matchedSlots;
  }

  #slotMatchesFilters(slotKey, slotDef, filters) {
    if (filters.slotType && slotDef.requirements.partType !== filters.slotType) {
      return false;
    }
    
    if (filters.orientation) {
      const orientationPattern = this.#wildcardToRegex(filters.orientation);
      if (!orientationPattern.test(slotDef._orientation || '')) {
        return false;
      }
    }
    
    if (filters.socketId) {
      const socketPattern = this.#wildcardToRegex(filters.socketId);
      if (!socketPattern.test(slotDef.socket)) {
        return false;
      }
    }
    
    return true;
  }
}
```

## Test Cases

- Filter by slotType
- Filter by orientation pattern
- Filter by socketId pattern
- Combine multiple filters
- No matches handled correctly

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Phase 3
