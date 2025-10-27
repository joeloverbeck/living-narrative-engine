# ANABLUNONHUM-008: Implement SlotGenerator Service

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-007 (SocketGenerator - already implemented)

## Overview

Generate blueprint slot definitions from structure template topology. Transforms limbSets and appendages into slot configuration objects that match the blueprint V2 schema. Works in tandem with the existing SocketGenerator service to provide complete template-to-blueprint processing.

## Technical Specifications

### File Location
- **Path**: `src/anatomy/slotGenerator.js`
- **DI Token**: `ISlotGenerator`

### Architecture Context

The SlotGenerator is part of a two-service pipeline:
1. **SocketGenerator** (already implemented at `src/anatomy/socketGenerator.js`):
   - Generates socket definitions for entity attachment points
   - Returns array of socket objects with `id`, `orientation`, `allowedTypes`, `nameTpl`

2. **SlotGenerator** (this ticket):
   - Generates slot definitions for blueprint requirements
   - Returns object mapping slot keys to slot configuration
   - Must produce keys that match SocketGenerator's socket IDs

Both services are coordinated by BodyBlueprintFactory during blueprint V2 processing.

### Core Functionality

```javascript
class SlotGenerator {
  /**
   * Generates blueprint slot definitions from structure template
   * @param {object} structureTemplate - Structure template with topology
   * @returns {object} Object mapping slot keys to slot definitions
   */
  generateBlueprintSlots(structureTemplate) {
    const slots = {};

    for (const limbSet of template.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        const slotKey = this.#generateSlotKey(limbSet.socketPattern, i, limbSet.count);
        slots[slotKey] = this.#createSlotDefinition(limbSet, slotKey);
      }
    }

    for (const appendage of template.topology.appendages) {
      for (let i = 1; i <= appendage.count; i++) {
        const slotKey = this.#generateSlotKey(appendage.socketPattern, i, appendage.count);
        slots[slotKey] = this.#createSlotDefinition(appendage, slotKey);
      }
    }

    return slots;
  }

  #createSlotDefinition(limbSetOrAppendage, slotKey) {
    return {
      socket: slotKey,  // Slot key must match socket ID from SocketGenerator
      requirements: {
        partType: limbSetOrAppendage.type,
        components: ["anatomy:part"]
      },
      optional: limbSetOrAppendage.optional || false
    };
  }

  /**
   * Generates slot key by applying template variables
   * Must use same logic as SocketGenerator.#applyTemplate to ensure matching IDs
   */
  #generateSlotKey(socketPattern, index, totalCount) {
    const { idTemplate, orientationScheme, positions } = socketPattern;

    // Resolve orientation using same logic as SocketGenerator
    const orientation = this.#resolveOrientation(
      orientationScheme,
      index,
      totalCount,
      positions
    );

    // Build variable context
    const variables = {
      index,
      orientation,
      position: orientation,
      type: socketPattern.allowedTypes?.[0] || 'part'
    };

    // Apply template (must match SocketGenerator's logic exactly)
    return this.#applyTemplate(idTemplate, variables);
  }

  #resolveOrientation(scheme = 'indexed', index, totalCount, positions) {
    // Must match SocketGenerator's orientation resolution logic
    switch (scheme) {
      case 'bilateral':
        // Handle bilateral and quadrupedal arrangements
        if (totalCount === 4) {
          const quadPositions = ['left_front', 'right_front', 'left_rear', 'right_rear'];
          return quadPositions[index - 1] || 'mid';
        }
        return index % 2 === 1 ? 'left' : 'right';

      case 'radial':
        if (positions && positions.length > 0) {
          return positions[index - 1] || `position_${index}`;
        }
        // Default radial positions for common counts
        if (totalCount === 8) {
          const octagonal = ['anterior', 'anterior_right', 'right', 'posterior_right',
                            'posterior', 'posterior_left', 'left', 'anterior_left'];
          return octagonal[index - 1] || `position_${index}`;
        }
        return `position_${index}`;

      case 'custom':
        if (!positions || positions.length === 0) {
          this.#logger.warn(`Custom orientation without positions array for index ${index}`);
          return `position_${index}`;
        }
        return positions[index - 1] || `position_${index}`;

      case 'indexed':
      default:
        return String(index);
    }
  }

  #applyTemplate(template, variables) {
    // Must match SocketGenerator's template application logic
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return result;
  }
}
```

## Slot Key Synchronization Rules

**CRITICAL**: Slot keys must exactly match socket IDs generated by SocketGenerator.

- Both services must use identical template variable resolution
- Both services must use identical orientation scheme logic
- Both services must use identical template application logic
- Format: lowercase with underscores
- Pattern: derived from `socketPattern.idTemplate` with variables substituted
- Must be unique within blueprint

### Validation Strategy

To ensure synchronization:
1. Extract shared logic into template utility service (consider refactoring)
2. Write integration tests that verify slot keys match socket IDs
3. Document the coupling explicitly in both services

## Acceptance Criteria

- [ ] Slot generation from limbSets
- [ ] Slot generation from appendages
- [ ] Slot keys match SocketGenerator's socket IDs exactly
- [ ] Requirements object in correct blueprint format
- [ ] Optional flag handled properly
- [ ] Template variable resolution matches SocketGenerator
- [ ] 15+ unit tests covering all orientation schemes
- [ ] Integration tests with SocketGenerator proving key synchronization
- [ ] Integration tests with BodyBlueprintFactory

## Test Cases

### Unit Tests
- Generate slots matching each orientation scheme (bilateral, radial, indexed, custom)
- Verify slot key == socket ID for all schemes
- Create correct requirements structure
- Handle optional limbs (optional: true/false)
- Validate slot uniqueness within generated object
- Handle edge cases: empty limbSets, empty appendages, count=1
- Template variable substitution correctness
- Orientation resolution for quadrupedal (count=4)
- Orientation resolution for radial with explicit positions
- Orientation resolution for radial without explicit positions

### Integration Tests
- **SlotGenerator + SocketGenerator synchronization**:
  - Same template → verify all slot keys exist in socket IDs
  - Bilateral arrangement → verify left/right matching
  - Radial arrangement → verify position matching
  - Indexed arrangement → verify numeric matching
  - Quadrupedal arrangement → verify front/rear matching

- **SlotGenerator + BodyBlueprintFactory**:
  - Blueprint V2 with structureTemplate
  - Generated slots merged with additionalSlots
  - Recipe validation against generated slots
  - End-to-end anatomy graph creation

## Implementation Notes

### Shared Logic Consideration

Since SlotGenerator and SocketGenerator must use identical template resolution logic, consider:

**Option A**: Duplicate logic with extensive tests ensuring parity
**Option B**: Extract shared utilities into `src/anatomy/templateVariableResolver.js`

Recommendation: Start with Option A for this ticket, refactor to Option B in follow-up ticket if needed.

### Dependency Injection

```javascript
constructor({ logger }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'info', 'warn', 'error']
  });
  this.#logger = logger;
}
```

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 4.5 (lines 556-619)
- **Schema**: `data/schemas/anatomy.structure-template.schema.json`
- **Documentation**: `docs/anatomy/structure-templates.md` (template variables section, lines 369-410)
- **Related Service**: `src/anatomy/socketGenerator.js` (implemented)
- **Integration Point**: `src/anatomy/bodyBlueprintFactory.js` (to be modified in ANABLUNONHUM-009)
