# HARMODREF-011: Implement Component Type Registry

**Priority:** P1 - HIGH
**Effort:** 3 days
**Status:** Not Started
**Created:** 2025-11-15

## Report Reference

**Primary Source:** [reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md)
**Section:** "P1: Short-Term Refactoring" → "1. Component Type Registry Pattern"

**⚠️ IMPORTANT:** Read the full report and HARMODREF-010 design before implementing.

## Problem Statement

Implement the Component Type Registry infrastructure that will enable operation handlers to work with abstract component categories instead of hardcoded component IDs.

## Affected Files

### New Files
1. `src/entities/registries/componentTypeRegistry.js`
2. `tests/unit/entities/registries/componentTypeRegistry.test.js`
3. `tests/integration/loaders/componentTypeRegistration.integration.test.js`

### Modified Files
4. `src/dependencyInjection/tokens/tokens-core.js`
5. `src/dependencyInjection/registrations/entityRegistrations.js`
6. `src/loaders/modLoader.js`

## Implementation Steps

### Day 1: Core Implementation

1. **Create ComponentTypeRegistry class** (4 hours)
```javascript
// src/entities/registries/componentTypeRegistry.js
export class ComponentTypeRegistry {
  #categories = new Map(); // category -> [componentIds]
  #defaults = new Map();   // category -> defaultComponentId
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    this.#logger = logger;
  }

  register(category, componentId, isDefault = false) {
    assertNonBlankString(category, 'Category', 'register', this.#logger);
    assertNonBlankString(componentId, 'ComponentId', 'register', this.#logger);

    if (!this.#categories.has(category)) {
      this.#categories.set(category, []);
    }

    const components = this.#categories.get(category);
    if (!components.includes(componentId)) {
      components.push(componentId);
      this.#logger.debug(`Registered component type: ${componentId} in category: ${category}`);
    }

    if (isDefault) {
      this.#defaults.set(category, componentId);
      this.#logger.debug(`Set default for category ${category}: ${componentId}`);
    }
  }

  getComponentId(category, preferredType = null) {
    if (preferredType && this.isRegisteredInCategory(category, preferredType)) {
      return preferredType;
    }
    return this.#defaults.get(category) || null;
  }

  hasComponentOfCategory(entityManager, entityId, category) {
    const componentIds = this.#categories.get(category) || [];
    return componentIds.some(id => entityManager.hasComponent(entityId, id));
  }

  getComponentOfCategory(entityManager, entityId, category, preferredType = null) {
    const componentId = this.getComponentId(category, preferredType);
    
    if (!componentId) {
      throw new Error(`No component registered for category: ${category}`);
    }

    if (!entityManager.hasComponent(entityId, componentId)) {
      throw new Error(`Entity ${entityId} does not have component in category ${category}`);
    }

    return entityManager.getComponent(entityId, componentId);
  }

  getAllComponentsInCategory(category) {
    return [...(this.#categories.get(category) || [])];
  }

  isRegisteredInCategory(category, componentId) {
    return this.#categories.get(category)?.includes(componentId) || false;
  }
}
```

2. **Add DI Token** (15 minutes)
```javascript
// src/dependencyInjection/tokens/tokens-core.js
export const tokens = {
  // ... existing tokens ...
  IComponentTypeRegistry: 'IComponentTypeRegistry',
};
```

3. **Register in DI Container** (15 minutes)
```javascript
// src/dependencyInjection/registrations/entityRegistrations.js
import { ComponentTypeRegistry } from '../../entities/registries/componentTypeRegistry.js';

export function registerEntityServices(container) {
  // ... existing registrations ...
  
  container.register(
    tokens.IComponentTypeRegistry,
    ComponentTypeRegistry,
    { lifecycle: 'singleton' }
  );
}
```

### Day 2: ModLoader Integration

4. **Integrate with ModLoader** (4 hours)
```javascript
// src/loaders/modLoader.js
class ModLoader {
  #componentTypeRegistry;

  constructor({ /* existing deps */, componentTypeRegistry }) {
    // ... existing validation ...
    validateDependency(componentTypeRegistry, 'IComponentTypeRegistry', this.#logger, {
      requiredMethods: ['register']
    });
    this.#componentTypeRegistry = componentTypeRegistry;
  }

  async loadMod(modManifest) {
    // ... existing mod loading ...

    // Register component types
    if (modManifest.componentTypeRegistrations) {
      this.#logger.info(`Registering component types for mod: ${modManifest.id}`);
      
      for (const registration of modManifest.componentTypeRegistrations) {
        try {
          this.#componentTypeRegistry.register(
            registration.category,
            registration.componentId,
            registration.default || false
          );
        } catch (err) {
          this.#logger.error(
            `Failed to register component type for mod ${modManifest.id}`,
            err
          );
          throw err;
        }
      }
    }
  }
}
```

### Day 3: Tests

5. **Unit Tests** (3 hours)
```javascript
// tests/unit/entities/registries/componentTypeRegistry.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ComponentTypeRegistry } from '../../../src/entities/registries/componentTypeRegistry.js';
import { createTestBed } from '../../common/testBed.js';

describe('ComponentTypeRegistry', () => {
  let testBed;
  let registry;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    const mockLogger = testBed.createMockLogger();
    registry = new ComponentTypeRegistry({ logger: mockLogger });
    mockEntityManager = testBed.createMock('entityManager', ['hasComponent', 'getComponent']);
  });

  describe('register', () => {
    it('should register component in category', () => {
      registry.register('sitting', 'positioning:sitting', true);
      
      const components = registry.getAllComponentsInCategory('sitting');
      expect(components).toContain('positioning:sitting');
    });

    it('should set default when isDefault is true', () => {
      registry.register('sitting', 'positioning:sitting', true);
      
      const defaultId = registry.getComponentId('sitting');
      expect(defaultId).toBe('positioning:sitting');
    });

    it('should allow multiple components in same category', () => {
      registry.register('sitting', 'positioning:sitting', true);
      registry.register('sitting', 'advanced:sitting', false);
      
      const components = registry.getAllComponentsInCategory('sitting');
      expect(components).toHaveLength(2);
    });
  });

  describe('getComponentId', () => {
    it('should return default when no preference given', () => {
      registry.register('sitting', 'positioning:sitting', true);
      
      expect(registry.getComponentId('sitting')).toBe('positioning:sitting');
    });

    it('should return preferred type if registered', () => {
      registry.register('sitting', 'positioning:sitting', true);
      registry.register('sitting', 'advanced:sitting', false);
      
      expect(registry.getComponentId('sitting', 'advanced:sitting'))
        .toBe('advanced:sitting');
    });
  });

  describe('hasComponentOfCategory', () => {
    it('should return true if entity has any component in category', () => {
      registry.register('sitting', 'positioning:sitting', true);
      mockEntityManager.hasComponent.mockReturnValue(true);
      
      expect(registry.hasComponentOfCategory(mockEntityManager, 'entity1', 'sitting'))
        .toBe(true);
    });
  });

  describe('getComponentOfCategory', () => {
    it('should return component data for category', () => {
      registry.register('sitting', 'positioning:sitting', true);
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponent.mockReturnValue({ targetId: 'chair1' });
      
      const component = registry.getComponentOfCategory(
        mockEntityManager,
        'entity1',
        'sitting'
      );
      
      expect(component).toEqual({ targetId: 'chair1' });
    });

    it('should throw if no component registered for category', () => {
      expect(() => {
        registry.getComponentOfCategory(mockEntityManager, 'entity1', 'unknown');
      }).toThrow('No component registered for category: unknown');
    });
  });
});
```

6. **Integration Tests** (2 hours)
```javascript
// tests/integration/loaders/componentTypeRegistration.integration.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Component Type Registration Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should register component types during mod loading', async () => {
    const mockManifest = {
      id: 'test_mod',
      version: '1.0.0',
      componentTypeRegistrations: [
        { category: 'sitting', componentId: 'test_mod:sitting', default: true }
      ]
    };

    // Load mod with registry
    await testBed.loadMod(mockManifest);

    // Verify registration
    const registry = testBed.getService('IComponentTypeRegistry');
    expect(registry.getComponentId('sitting')).toBe('test_mod:sitting');
  });
});
```

## Acceptance Criteria

- [ ] ComponentTypeRegistry class implemented with all API methods
- [ ] DI token created and registered
- [ ] ModLoader integration complete
- [ ] Unit test coverage >90%
- [ ] Integration tests validate mod registration flow
- [ ] All tests pass: `npm run test:unit && npm run test:integration`
- [ ] No ESLint violations
- [ ] Code follows project naming conventions
- [ ] Comprehensive error messages
- [ ] Logger integration for debugging

## Dependencies

**Required:**
- HARMODREF-010 - Design must be approved

**Blocks:**
- HARMODREF-012 - Cannot update manifests without registry
- HARMODREF-013 - Proof-of-concept needs registry

## Testing Commands

```bash
# Unit tests
npm run test:unit -- tests/unit/entities/registries/componentTypeRegistry.test.js

# Integration tests
npm run test:integration -- tests/integration/loaders/componentTypeRegistration.integration.test.js

# Full test suite
npm run test:ci

# Lint
npx eslint src/entities/registries/componentTypeRegistry.js \
  src/loaders/modLoader.js
```

## Timeline

- **Day 1:** Core implementation + DI integration (4-5 hours)
- **Day 2:** ModLoader integration (4 hours)
- **Day 3:** Unit + integration tests (5 hours)
- **Buffer:** Code review and fixes (2 hours)

## Next Steps

After completion, proceed to:
1. HARMODREF-012 - Update mod manifests
2. HARMODREF-013 - Refactor first handler as proof-of-concept
