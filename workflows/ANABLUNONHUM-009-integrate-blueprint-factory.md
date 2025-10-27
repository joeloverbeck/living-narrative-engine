# ANABLUNONHUM-009: Integrate Template Processor into BodyBlueprintFactory

**Phase**: 2 - Structure Template Processor
**Priority**: Critical
**Estimated Effort**: 10-12 hours
**Dependencies**: ANABLUNONHUM-006, ANABLUNONHUM-007, ANABLUNONHUM-008

## Overview

Modify `BodyBlueprintFactory` to detect blueprint schemaVersion and route v2 blueprints through template processor while maintaining v1 compatibility.

## Technical Specifications

### File to Modify
- **Path**: `src/anatomy/bodyBlueprintFactory.js`
- **Existing service**: Extend with template processing

### Integration Points

```javascript
class BodyBlueprintFactory {
  constructor({ 
    dataRegistry, 
    validator, 
    logger,
    structureTemplateLoader,  // NEW
    socketGenerator,           // NEW
    slotGenerator             // NEW
  }) {
    // Add new dependencies
  }

  #loadBlueprint(blueprintId) {
    const blueprint = this.#dataRegistry.get('anatomyBlueprints', blueprintId);

    if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
      return this.#processTemplatedBlueprint(blueprint);  // NEW PATH
    } else {
      return blueprint;  // EXISTING PATH
    }
  }

  #processTemplatedBlueprint(blueprint) {  // NEW METHOD
    const template = this.#structureTemplateLoader.loadTemplate(blueprint.structureTemplate);
    const generatedSockets = this.#socketGenerator.generateSockets(template);
    const generatedSlots = this.#slotGenerator.generateSlots(template);

    return {
      ...blueprint,
      slots: {
        ...generatedSlots,
        ...blueprint.additionalSlots
      },
      _generatedSockets: generatedSockets  // Internal use
    };
  }
}
```

## Acceptance Criteria

- [ ] schemaVersion detection implemented
- [ ] v2 blueprint routing to template processor
- [ ] v1 blueprints unchanged (backward compatibility)
- [ ] Generated slots merged with additionalSlots
- [ ] All existing tests still pass
- [ ] New tests for v2 blueprint processing
- [ ] Integration tests with real templates

## Test Cases

- Load v1 blueprint (no changes)
- Load v2 blueprint with template
- Merge generated + additional slots
- Handle missing template gracefully
- Validate socket/slot consistency
- Performance: v2 overhead <10ms

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Phase 2
