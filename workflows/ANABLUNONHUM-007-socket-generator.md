# ANABLUNONHUM-007: Implement SocketGenerator Service

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 12-14 hours
**Dependencies**: ANABLUNONHUM-001 ✓ (Completed), ANABLUNONHUM-006 ✓ (Completed)
**Status**: NEW IMPLEMENTATION - File does not exist yet

## Overview

Service to generate socket definitions from structure template limbSet/appendage patterns. Applies template variables and orientation schemes.

**Implementation Note**: This is a new file creation task. The `AnatomyStructureTemplateLoader` from ANABLUNONHUM-006 is available at `src/loaders/anatomyStructureTemplateLoader.js` and provides the structure templates this generator will process.

## Technical Specifications

### File Location
- **Path**: `src/anatomy/socketGenerator.js` (NEW FILE)
- **DI Token**: `ISocketGenerator` (needs registration in `src/dependencyInjection/tokens/tokens-core.js`)
- **Test Files**:
  - Unit: `tests/unit/anatomy/socketGenerator.test.js`
  - Integration: `tests/integration/anatomy/socketGenerator.integration.test.js`

### Core Functionality

```javascript
class SocketGenerator {
  generateSockets(structureTemplate) {
    const sockets = [];

    // Process each limbSet
    for (const limbSet of structureTemplate.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        sockets.push(this.#createSocketFromPattern(limbSet, i));
      }
    }

    // Process appendages
    for (const appendage of structureTemplate.topology.appendages) {
      sockets.push(this.#createSocketFromPattern(appendage, 1));
    }

    return sockets;
  }

  #createSocketFromPattern(limbSet, index) {
    return {
      id: this.#applyTemplate(limbSet.socketPattern.idTemplate, {index}),
      orientation: this.#resolveOrientation(limbSet, index),
      allowedTypes: limbSet.socketPattern.allowedTypes,
      nameTpl: limbSet.socketPattern.nameTpl || "{{type}} {{index}}"
    };
  }

  #applyTemplate(template, variables) {
    // Replace {{variable}} with values
  }

  #resolveOrientation(limbSet, index) {
    // Apply orientation scheme (bilateral, radial, indexed, custom)
  }
}
```

## Template Variable Resolution

Variables supported:
- `{{index}}` - 1-based limb index
- `{{orientation}}` - Computed from orientation scheme
- `{{position}}` - From explicit positions array

## Orientation Schemes

1. **indexed**: `position_1`, `position_2`, ...
2. **bilateral**: Alternates `left`, `right` for pairs
3. **radial**: Distributes around circle (angular)
4. **custom**: Uses provided positions array

## DI Token Registration

Add to `src/dependencyInjection/tokens/tokens-core.js`:

```javascript
export const tokens = {
  // ... existing tokens ...
  ISocketGenerator: 'ISocketGenerator',
  // ... rest of tokens ...
};
```

Register service in appropriate registration file (e.g., `src/dependencyInjection/registrations/anatomyRegistrations.js`):

```javascript
import SocketGenerator from '../../anatomy/socketGenerator.js';

container.register(tokens.ISocketGenerator, SocketGenerator);
```

## Integration Context

This service integrates with:
- **Input**: `AnatomyStructureTemplateLoader` provides structure templates
- **Output**: Generates socket definitions for anatomy system
- **Related Services**: May integrate with existing `SocketManager` service for socket lifecycle management
- **Schema**: Validates against `data/schemas/anatomy.structure-template.schema.json`

## Acceptance Criteria

- [ ] **DI Token registered** in `src/dependencyInjection/tokens/tokens-core.js`
- [ ] Socket generation from limbSets working
- [ ] Socket generation from appendages working
- [ ] Template variable replacement correct
- [ ] All orientation schemes implemented (`bilateral`, `radial`, `indexed`, `custom`)
- [ ] Socket ID uniqueness validated
- [ ] 20+ unit tests covering all schemes
- [ ] Integration tests with real templates from `AnatomyStructureTemplateLoader`
- [ ] Performance: <5ms for 20 sockets
- [ ] Integration with existing `SocketManager` service (if applicable)

## Test Cases

- Generate 8 spider leg sockets
- Generate bilateral arm sockets (2)
- Generate radial tentacle sockets (8)
- Apply indexed orientation correctly
- Handle custom positions array
- Reject duplicate socket IDs
- Validate allowed types propagation
- Test nameTpl template application

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Section 4.5
