# ANABLUNONHUM-008: Implement SlotGenerator Service

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-007

## Overview

Generate blueprint slot definitions from structure template. Matches socket IDs to slot keys and creates requirement objects.

## Technical Specifications

### File Location
- **Path**: `src/anatomy/slotGenerator.js`
- **DI Token**: `ISlotGenerator`

### Core Functionality

```javascript
class SlotGenerator {
  generateSlots(structureTemplate) {
    const slots = {};
    
    for (const limbSet of template.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        const slotKey = this.#generateSlotKey(limbSet, i);
        slots[slotKey] = this.#createSlotDefinition(limbSet, slotKey);
      }
    }
    
    for (const appendage of template.topology.appendages) {
      const slotKey = this.#generateSlotKey(appendage, 1);
      slots[slotKey] = this.#createSlotDefinition(appendage, slotKey);
    }
    
    return slots;
  }

  #createSlotDefinition(limbSet, slotKey) {
    return {
      socket: slotKey,  // Must match socket ID
      requirements: {
        partType: limbSet.type,
        components: ["anatomy:part"]
      },
      optional: limbSet.optional || false
    };
  }
}
```

## Slot Key Rules

- Slot key must exactly match socket ID
- Format: lowercase with underscores
- Pattern: `{type}_{index}` or custom from template
- Must be unique within blueprint

## Acceptance Criteria

- [ ] Slot generation from limbSets
- [ ] Slot generation from appendages
- [ ] Slot keys match socket IDs exactly
- [ ] Requirements object correct format
- [ ] Optional flag handled properly
- [ ] 15+ unit tests
- [ ] Integration with SocketGenerator tested

## Test Cases

- Generate slots matching socket pattern
- Verify slot key == socket ID
- Create correct requirements
- Handle optional limbs
- Validate slot uniqueness
- Merge with additionalSlots (integration)

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 4.5
