# HARMODREF-023: Migrate Inventory Validation to Plugin Architecture

**Priority:** P2 - MEDIUM
**Effort:** 2 weeks
**Status:** Not Started

## Report Reference
[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Inventory Validation Hardcoding"

## Problem Statement
Migrate inventory capacity validation from hardcoded weight-based system to pluggable capacity validators. Enable alternative inventory systems (slot-based, magical, etc.).

## Affected Files
1. `src/logic/operationHandlers/validateInventoryCapacityHandler.js`
2. `data/mods/items/plugins/weightCapacityValidator.js` (new)
3. `data/mods/items/mod-manifest.json`
4. `examples/mods/slot_inventory/plugins/slotCapacityValidator.js` (new)
5. `examples/mods/magical_storage/plugins/magicalCapacityValidator.js` (new)
6. Test files

## Plugin Implementations

### WeightCapacityValidator
```javascript
export class WeightCapacityValidator extends BaseCapacityValidatorPlugin {
  canValidate(actorId, itemId) {
    return this.entityManager.hasComponent(actorId, 'items:inventory') &&
           this.entityManager.hasComponent(itemId, 'items:weight');
  }

  validate(actorId, itemId) {
    const inventory = this.entityManager.getComponent(actorId, 'items:inventory');
    const weight = this.entityManager.getComponent(itemId, 'items:weight');
    
    const currentWeight = this.calculateCurrentWeight(inventory);
    const canAdd = (currentWeight + weight.value) <= inventory.maxWeight;
    
    return {
      canAdd,
      reason: canAdd ? null : 'Exceeds weight capacity'
    };
  }
}
```

### Example: SlotCapacityValidator
```javascript
export class SlotCapacityValidator extends BaseCapacityValidatorPlugin {
  canValidate(actorId, itemId) {
    return this.entityManager.hasComponent(actorId, 'slot_inventory:inventory');
  }

  validate(actorId, itemId) {
    const inventory = this.entityManager.getComponent(actorId, 'slot_inventory:inventory');
    const canAdd = inventory.usedSlots < inventory.totalSlots;
    
    return {
      canAdd,
      reason: canAdd ? null : 'No available slots'
    };
  }
}
```

## Acceptance Criteria
- [ ] CapacityValidator interface defined
- [ ] Weight validation moved to plugin
- [ ] No hardcoded validation logic
- [ ] Example alternative validators work
- [ ] All tests pass with >85% coverage
- [ ] Mod development guide updated

## Dependencies
HARMODREF-021 (plugin infrastructure)
