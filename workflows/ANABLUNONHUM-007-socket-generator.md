# ANABLUNONHUM-007: Implement SocketGenerator Service

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 12-14 hours
**Dependencies**: ANABLUNONHUM-001, ANABLUNONHUM-006

## Overview

Service to generate socket definitions from structure template limbSet/appendage patterns. Applies template variables and orientation schemes.

## Technical Specifications

### File Location
- **Path**: `src/anatomy/socketGenerator.js`
- **DI Token**: `ISocketGenerator`

### Core Functionality

```javascript
class SocketGenerator {
  generateSockets(structureTemplate) {
    const sockets = [];
    
    // Process each limbSet
    for (const limbSet of template.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        sockets.push(this.#createSocketFromPattern(limbSet, i));
      }
    }
    
    // Process appendages
    for (const appendage of template.topology.appendages) {
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
    // Apply orientation scheme (bilateral, radial, indexed)
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

## Acceptance Criteria

- [ ] Socket generation from limbSets working
- [ ] Socket generation from appendages working
- [ ] Template variable replacement correct
- [ ] All orientation schemes implemented
- [ ] Socket ID uniqueness validated
- [ ] 20+ unit tests covering all schemes
- [ ] Integration tests with real templates
- [ ] Performance: <5ms for 20 sockets

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
