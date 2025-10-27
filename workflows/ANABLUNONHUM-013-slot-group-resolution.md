# ANABLUNONHUM-013: Implement Slot Group Resolution in RecipeProcessor

**Phase**: 3 - Recipe Pattern Enhancement
**Priority**: Critical
**Estimated Effort**: 8-10 hours
**Dependencies**: ANABLUNONHUM-003, ANABLUNONHUM-009

## Overview

Extend `RecipeProcessor` to resolve `matchesGroup` patterns by looking up limbSet/appendage definitions from structure templates.

## Implementation

```javascript
class RecipeProcessor {
  #resolveSlotGroup(groupRef, blueprint) {
    // Format: "limbSet:leg" or "appendage:tail"
    const [groupType, groupName] = groupRef.split(':');
    const template = this.#structureTemplateLoader.loadTemplate(blueprint.structureTemplate);

    let limbSet;
    if (groupType === 'limbSet') {
      limbSet = template.topology.limbSets.find(ls => ls.type === groupName);
    } else if (groupType === 'appendage') {
      limbSet = template.topology.appendages.find(a => a.type === groupName);
    }

    if (!limbSet) {
      throw new ValidationError(`Slot group '${groupRef}' not found in template`);
    }

    return this.#generateSlotKeysFromLimbSet(limbSet);
  }

  #generateSlotKeysFromLimbSet(limbSet) {
    const keys = [];
    for (let i = 1; i <= limbSet.count; i++) {
      const key = this.#applyTemplate(limbSet.socketPattern.idTemplate, {index: i});
      keys.push(key);
    }
    return keys;
  }
}
```

## Test Cases

- Resolve limbSet:leg group
- Resolve appendage:tail group
- Handle non-existent groups
- Generate correct slot keys
- Integration with pattern application

## References

- **Source**: `reports/anatomy-blueprint-non-human-architecture.md` Phase 3
