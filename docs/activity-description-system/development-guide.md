# Activity Description System Development Guide

**Version**: 2.0 (Facade Pattern Architecture)
**Last Updated**: 2025-11-01
**Audience**: Contributors, Maintainers, Developers

## Overview

This guide provides comprehensive development guidance for contributing to the Activity Description System. Whether you're fixing bugs, adding features, or extending functionality, this guide will help you navigate the codebase effectively.

---

## Table of Contents

1. [System Architecture Quick Reference](#system-architecture-quick-reference)
2. [Development Setup](#development-setup)
3. [Code Organization](#code-organization)
4. [Adding New Features](#adding-new-features)
5. [Extending Services](#extending-services)
6. [Testing Guidelines](#testing-guidelines)
7. [Performance Optimization](#performance-optimization)
8. [Debugging Techniques](#debugging-techniques)
9. [Common Development Patterns](#common-development-patterns)
10. [Code Review Checklist](#code-review-checklist)
11. [Contribution Workflow](#contribution-workflow)

---

## System Architecture Quick Reference

### The 7 Services

```
ActivityDescriptionFacade (Orchestrator)
├── ActivityCacheManager          - TTL caching with event-driven invalidation
├── ActivityIndexManager           - Activity indexing and lookup optimization
├── ActivityMetadataCollectionSystem - 3-tier metadata collection
├── ActivityNLGSystem             - Natural language generation
├── ActivityGroupingSystem        - Sequential activity grouping
├── ActivityContextBuildingSystem - Context building and tone adjustment
└── ActivityFilteringSystem       - Condition-based visibility filtering
```

### Dependency Flow

```
Facade
  ↓
Metadata Collection → Filtering → Grouping → Context Building → NLG
  ↑                                  ↑           ↑
Cache Manager                    Index Manager   Cache Manager
```

### File Locations

```
src/anatomy/
├── cache/
│   └── activityCacheManager.js
├── services/
│   ├── activityDescriptionFacade.js
│   ├── activityIndexManager.js
│   ├── activityMetadataCollectionSystem.js
│   ├── activityNLGSystem.js
│   ├── grouping/
│   │   └── activityGroupingSystem.js
│   ├── context/
│   │   └── activityContextBuildingSystem.js
│   └── filtering/
│       └── activityFilteringSystem.js
```

---

## Development Setup

### Prerequisites

```bash
# Node.js 18+ required
node --version  # Should be >= 18.0.0

# Install dependencies
npm install

# Verify setup
npm run typecheck
npm run lint
npm run test:unit
```

### IDE Configuration

#### VSCode Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.suggest.autoImports": true,
  "javascript.updateImportsOnFileMove.enabled": "always"
}
```

#### ESLint Configuration

Already configured in `.eslintrc.js`. Key rules:

- `no-unused-vars` - Prevent unused imports
- `no-console` - Use logger instead
- `max-lines` - Max 500 lines per file
- `complexity` - Max cyclomatic complexity 15

---

## Code Organization

### File Structure Standards

Every service file follows this structure:

```javascript
/**
 * @file Brief description of service purpose
 * @description More detailed explanation if needed
 */

// External imports
import { validateDependency } from '../../utils/dependencyUtils.js';

// Internal imports
import SomeHelper from './someHelper.js';

// Type definitions
/** @typedef {import('./types.js').SomeType} SomeType */

// Constants
const DEFAULT_CONFIG = Object.freeze({
  // ... frozen configuration
});

/**
 * ServiceName class
 *
 * Detailed class documentation
 */
class ServiceName {
  // Private fields
  #logger;
  #dependency;

  /**
   * Constructor with JSDoc
   *
   * @param {object} params - Dependency object
   * @param {object} params.logger - Logger service
   * @param {object} params.dependency - Some dependency
   */
  constructor({ logger, dependency }) {
    // Validate dependencies
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // Assign to private fields
    this.#logger = logger;
    this.#dependency = dependency;
  }

  // Public methods

  /**
   * Public method with full JSDoc
   *
   * @param {string} param - Description
   * @returns {Promise<string>} Description
   */
  async publicMethod(param) {
    // Implementation
  }

  // Private methods

  /**
   * Private helper method
   *
   * @private
   */
  #privateHelper() {
    // Implementation
  }

  /**
   * Cleanup method
   */
  destroy() {
    // Cleanup resources
  }
}

export default ServiceName;
```

### Naming Conventions

- **Classes**: `PascalCase` (e.g., `ActivityCacheManager`)
- **Files**: `camelCase` (e.g., `activityCacheManager.js`)
- **Methods**: `camelCase` (e.g., `generateActivityDescription`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_CONFIG`)
- **Private fields**: `#camelCase` (e.g., `#logger`)
- **Interfaces**: `IPascalCase` (e.g., `IActivityCacheManager`)

### Import/Export Patterns

```javascript
// ✅ Use default exports for main classes
export default ActivityCacheManager;

// ✅ Use named exports for utilities
export { validateCache, buildCacheKey };

// ✅ Use type imports when only used in JSDoc
/** @typedef {import('./types.js').CacheEntry} CacheEntry */

// ❌ Avoid mixing default and named exports from same class file
```

---

## Adding New Features

### Example: Adding a New Metadata Source

**Scenario**: Add support for "emotional state" activity metadata.

#### Step 1: Define Component Schema

```json
// data/mods/core/components/emotional_state.component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:emotional_state",
  "description": "Emotional state of entity",
  "dataSchema": {
    "type": "object",
    "properties": {
      "emotion": {
        "type": "string",
        "enum": ["happy", "sad", "angry", "neutral"]
      },
      "activityMetadata": {
        "type": "object",
        "properties": {
          "template": { "type": "string" },
          "priority": { "type": "number" }
        }
      }
    },
    "required": ["emotion"]
  }
}
```

#### Step 2: Add Metadata Collection

The `ActivityMetadataCollectionSystem` automatically collects from components with `activityMetadata`:

```javascript
// No code changes needed! The system auto-discovers it.

// Test it:
describe('Emotional State Activity Metadata', () => {
  it('should collect emotional state metadata', () => {
    const entity = createEntityWithComponent('core:emotional_state', {
      emotion: 'happy',
      activityMetadata: {
        template: '{actor} looks happy',
        priority: 50,
      },
    });

    const activities = metadataSystem.collectActivityMetadata(
      entity.id,
      entity
    );

    expect(activities).toContainEqual(
      expect.objectContaining({
        template: '{actor} looks happy',
        priority: 50,
        sourceComponent: 'core:emotional_state',
      })
    );
  });
});
```

#### Step 3: Add Custom Rendering (Optional)

If you need custom NLG handling:

```javascript
// Extend ActivityNLGSystem
class EmotionalNLGSystem extends ActivityNLGSystem {
  generateActivityPhrase(actorReference, activity, useActorPronoun, context) {
    // Check if this is emotional activity
    if (activity.sourceComponent === 'core:emotional_state') {
      // Custom phrase generation
      const emotion = activity.metadata?.emotion || 'neutral';
      return `${actorReference} appears ${emotion}`;
    }

    // Delegate to parent for other activities
    return super.generateActivityPhrase(
      actorReference,
      activity,
      useActorPronoun,
      context
    );
  }
}

// Register in DI container
container.register('IActivityNLGSystem', EmotionalNLGSystem);
```

---

### Example: Adding Custom Grouping Logic

**Scenario**: Group activities by emotion instead of default grouping.

#### Step 1: Extend Grouping System

```javascript
// src/anatomy/services/grouping/emotionalActivityGroupingSystem.js
import ActivityGroupingSystem from './activityGroupingSystem.js';

class EmotionalActivityGroupingSystem extends ActivityGroupingSystem {
  /**
   * Override grouping logic to group by emotion
   *
   * @param {Array<object>} activities - Activities to group
   * @param {string|null} cacheKey - Cache key for performance
   * @returns {Array<object>} Grouped activities
   */
  groupActivities(activities, cacheKey = null) {
    // Group by emotion metadata
    const emotionGroups = new Map();

    activities.forEach((activity) => {
      const emotion = activity.metadata?.emotion || 'neutral';
      if (!emotionGroups.has(emotion)) {
        emotionGroups.set(emotion, []);
      }
      emotionGroups.get(emotion).push(activity);
    });

    // Convert to standard group format
    const groups = [];
    for (const [emotion, emotionActivities] of emotionGroups.entries()) {
      if (emotionActivities.length === 0) continue;

      const [primary, ...related] = this.sortByPriority(emotionActivities);

      groups.push({
        primaryActivity: primary,
        relatedActivities: related.map((activity) => ({
          activity,
          conjunction: 'and', // All in same emotion group use "and"
        })),
      });
    }

    return groups;
  }
}

export default EmotionalActivityGroupingSystem;
```

#### Step 2: Register in DI

```javascript
// src/dependencyInjection/registrations/anatomyRegistrations.js
import EmotionalActivityGroupingSystem from '../../anatomy/services/grouping/emotionalActivityGroupingSystem.js';

container.registerSingleton(
  'IActivityGroupingSystem',
  EmotionalActivityGroupingSystem,
  {
    dependencies: {
      logger: 'ILogger',
    },
  }
);
```

#### Step 3: Test

```javascript
describe('EmotionalActivityGroupingSystem', () => {
  it('should group activities by emotion', () => {
    const activities = [
      { id: '1', metadata: { emotion: 'happy' }, priority: 100 },
      { id: '2', metadata: { emotion: 'happy' }, priority: 90 },
      { id: '3', metadata: { emotion: 'sad' }, priority: 80 },
    ];

    const groups = groupingSystem.groupActivities(activities);

    expect(groups).toHaveLength(2); // happy group, sad group
    expect(groups[0].primaryActivity.metadata.emotion).toBe('happy');
    expect(groups[0].relatedActivities).toHaveLength(1);
  });
});
```

---

## Extending Services

### When to Extend vs. Configure

**Configure** (preferred):

- Adjusting existing behavior parameters
- Changing thresholds or limits
- Enabling/disabling features

**Extend** (when necessary):

- Adding completely new functionality
- Changing core algorithms
- Integrating external systems

### Extension Guidelines

#### 1. Extend Specific Services, Not Facade

```javascript
// ✅ Good: Extend specialized service
class CustomNLGSystem extends ActivityNLGSystem {
  // Override specific behavior
}

// ❌ Bad: Extend facade
class CustomFacade extends ActivityDescriptionFacade {
  // Too broad, hard to maintain
}
```

#### 2. Preserve Interface Contracts

```javascript
// ✅ Good: Maintain expected interface
class CustomCacheManager extends ActivityCacheManager {
  get(cacheName, key) {
    // Custom implementation
    const value = super.get(cacheName, key);
    this.#trackAccess(cacheName, key); // Add tracking
    return value; // Return expected type
  }
}

// ❌ Bad: Change interface
class BadCacheManager extends ActivityCacheManager {
  get(cacheName, key, extraParam) {
    // ❌ Changed signature
    return { data: super.get(cacheName, key), cached: true }; // ❌ Changed return type
  }
}
```

#### 3. Call Parent Methods

```javascript
class CustomFilteringSystem extends ActivityFilteringSystem {
  filterByConditions(activities, entity) {
    // Pre-processing
    const preprocessed = this.#preprocessActivities(activities);

    // Delegate to parent
    const filtered = super.filterByConditions(preprocessed, entity);

    // Post-processing
    return this.#postprocessActivities(filtered);
  }
}
```

---

## Testing Guidelines

### Test Structure

Every service should have comprehensive tests:

```
tests/unit/anatomy/
├── cache/
│   └── activityCacheManager.test.js
├── services/
│   ├── activityDescriptionFacade.test.js
│   ├── activityIndexManager.test.js
│   ├── activityMetadataCollectionSystem.test.js
│   ├── activityNLGSystem.test.js
│   ├── grouping/
│   │   └── activityGroupingSystem.test.js
│   ├── context/
│   │   └── activityContextBuildingSystem.test.js
│   └── filtering/
│       └── activityFilteringSystem.test.js
```

### Test Patterns

#### Unit Test Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import { createMockLogger } from '../../common/testHelpers.js';

describe('ActivityCacheManager', () => {
  let cacheManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    cacheManager = new ActivityCacheManager({ logger: mockLogger });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Cache Registration', () => {
    it('should register cache with default config', () => {
      cacheManager.registerCache('testCache');

      const value = cacheManager.get('testCache', 'key1');
      expect(value).toBeNull(); // Cache exists but empty
    });

    it('should register cache with custom TTL', () => {
      cacheManager.registerCache('testCache', { ttl: 5000 });

      cacheManager.set('testCache', 'key1', 'value1');
      expect(cacheManager.get('testCache', 'key1')).toBe('value1');
    });
  });

  describe('Cache Operations', () => {
    beforeEach(() => {
      cacheManager.registerCache('testCache', { ttl: 1000 });
    });

    it('should set and get values', () => {
      cacheManager.set('testCache', 'key1', 'value1');
      expect(cacheManager.get('testCache', 'key1')).toBe('value1');
    });

    it('should respect TTL', () => {
      jest.useFakeTimers();

      cacheManager.set('testCache', 'key1', 'value1');
      expect(cacheManager.get('testCache', 'key1')).toBe('value1');

      jest.advanceTimersByTime(1001);
      expect(cacheManager.get('testCache', 'key1')).toBeNull();

      jest.useRealTimers();
    });
  });
});
```

#### Integration Test Template

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestContainer } from '../../common/testContainer.js';

describe('Activity Description Integration', () => {
  let container;
  let facade;
  let entityManager;

  beforeEach(async () => {
    container = createTestContainer();
    facade = container.resolve('ActivityDescriptionFacade');
    entityManager = container.resolve('IEntityManager');
  });

  it('should generate description from real mod data', async () => {
    // Create entity with real mod components
    const actorId = 'test_actor';
    const entity = await entityManager.createEntity(actorId, 'core:actor');

    await entity.addComponent('positioning:kneeling', {
      target: 'target_npc',
    });

    // Generate description
    const description = await facade.generateActivityDescription(actorId);

    // Verify output
    expect(description).toContain('kneel');
    expect(description).toMatch(/Activity: .* kneeling before .*/);
  });
});
```

### Coverage Requirements

- **Branches**: 80% minimum
- **Functions**: 90% minimum
- **Lines**: 90% minimum

```bash
# Run with coverage
npm run test:unit -- --coverage

# Check specific file
npm run test:unit -- activityCacheManager.test.js --coverage
```

---

## Performance Optimization

### Profiling

```javascript
import { performance } from 'perf_hooks';

// Profile specific operation
const start = performance.now();
const description = await facade.generateActivityDescription('actor_1');
const end = performance.now();

console.log(`Generated in ${end - start}ms`);
```

### Common Bottlenecks

1. **Entity Lookups**: Cache entity instances
2. **JSON Logic Evaluation**: Cache condition results
3. **String Operations**: Minimize regex and template parsing
4. **Event Dispatching**: Batch event subscriptions

### Optimization Techniques

#### 1. Memoization

```javascript
class OptimizedNLGSystem extends ActivityNLGSystem {
  #phraseCache = new Map();

  generateActivityPhrase(actorReference, activity, useActorPronoun, context) {
    // Build cache key
    const cacheKey = `${actorReference}:${activity.template}:${useActorPronoun}`;

    // Check cache
    if (this.#phraseCache.has(cacheKey)) {
      return this.#phraseCache.get(cacheKey);
    }

    // Generate phrase
    const phrase = super.generateActivityPhrase(
      actorReference,
      activity,
      useActorPronoun,
      context
    );

    // Cache result
    this.#phraseCache.set(cacheKey, phrase);

    return phrase;
  }
}
```

#### 2. Batch Operations

```javascript
// ❌ Bad: Multiple individual operations
for (const entityId of entityIds) {
  facade.invalidateCache(entityId, 'all');
}

// ✅ Good: Batch operation
facade.invalidateEntities(entityIds);
```

#### 3. Lazy Loading

```javascript
class LazyContextSystem extends ActivityContextBuildingSystem {
  #cachedCloseness = null;

  buildActivityContext(actorId, activity) {
    // Load closeness data only when needed
    if (!this.#cachedCloseness) {
      this.#cachedCloseness = this.#loadClosenessData(actorId);
    }

    return super.buildActivityContext(actorId, activity);
  }
}
```

---

## Debugging Techniques

### Enable Debug Logging

```javascript
// Set environment variable
process.env.LOG_LEVEL = 'debug';

// Or configure logger
const logger = createLogger({ level: 'debug' });
```

### Inspect Cache State

```javascript
const testHooks = facade.getTestHooks();
const snapshot = testHooks.getCacheSnapshot();

console.log('Caches:', {
  entityName: snapshot.entityName.size,
  gender: snapshot.gender.size,
  activityIndex: snapshot.activityIndex.size,
  closeness: snapshot.closeness.size,
});
```

### Trace Event Flow

```javascript
const eventBus = container.resolve('EventBus');

// Log all events
const originalDispatch = eventBus.dispatch.bind(eventBus);
eventBus.dispatch = (event) => {
  console.log('Event:', event.type, event.payload);
  return originalDispatch(event);
};
```

### Debug Specific Service

```javascript
describe('Debug ActivityNLGSystem', () => {
  it('should trace phrase generation', () => {
    const nlgSystem = new ActivityNLGSystem({ logger, entityManager });

    // Spy on internal methods
    const generateSpy = jest.spyOn(nlgSystem, 'generateActivityPhrase');

    const phrase = nlgSystem.generateActivityPhrase(
      'Jon Ureña',
      { template: '{actor} kneels' },
      false,
      {}
    );

    expect(generateSpy).toHaveBeenCalledWith(
      'Jon Ureña',
      expect.objectContaining({ template: '{actor} kneels' }),
      false,
      {}
    );

    console.log('Generated phrase:', phrase);
  });
});
```

---

## Common Development Patterns

### Pattern 1: Service Composition

```javascript
// Compose multiple services for complex feature
class AdvancedActivitySystem {
  constructor({ facade, cacheManager, nlgSystem }) {
    this.#facade = facade;
    this.#cacheManager = cacheManager;
    this.#nlgSystem = nlgSystem;
  }

  async generateWithAnalytics(entityId) {
    const start = Date.now();

    const description =
      await this.#facade.generateActivityDescription(entityId);

    const analytics = {
      duration: Date.now() - start,
      cacheHits: this.#cacheManager.getMetrics(),
      phraseCount: this.#nlgSystem.getPhraseCount(),
    };

    return { description, analytics };
  }
}
```

### Pattern 2: Decorator Pattern

```javascript
// Add functionality without modifying original
class LoggingCacheManager {
  constructor(cacheManager, logger) {
    this.#cacheManager = cacheManager;
    this.#logger = logger;
  }

  get(cacheName, key) {
    const value = this.#cacheManager.get(cacheName, key);
    this.#logger.debug(`Cache ${cacheName}:${key} → ${value ? 'HIT' : 'MISS'}`);
    return value;
  }

  set(cacheName, key, value) {
    this.#logger.debug(`Cache ${cacheName}:${key} ← SET`);
    return this.#cacheManager.set(cacheName, key, value);
  }

  // Delegate all other methods
  registerCache(...args) {
    return this.#cacheManager.registerCache(...args);
  }
  invalidate(...args) {
    return this.#cacheManager.invalidate(...args);
  }
  destroy(...args) {
    return this.#cacheManager.destroy(...args);
  }
}
```

### Pattern 3: Strategy Pattern

```javascript
// Different grouping strategies
class TimeBasedGroupingStrategy {
  group(activities) {
    // Group by timestamp
  }
}

class CategoryBasedGroupingStrategy {
  group(activities) {
    // Group by category
  }
}

class ConfigurableGroupingSystem extends ActivityGroupingSystem {
  #strategy;

  constructor({ logger, strategy }) {
    super({ logger });
    this.#strategy = strategy;
  }

  groupActivities(activities, cacheKey) {
    return this.#strategy.group(activities);
  }
}
```

---

## Code Review Checklist

### Before Submitting PR

- [ ] **All tests pass** (`npm run test:unit`, `npm run test:integration`)
- [ ] **Code coverage ≥80%** for new code
- [ ] **Linting passes** (`npm run lint`)
- [ ] **Type checking passes** (`npm run typecheck`)
- [ ] **Documentation updated** (JSDoc, README, guides)
- [ ] **No console.log** (use logger instead)
- [ ] **Proper error handling** (try/catch, error events)
- [ ] **Performance considered** (caching, batching)
- [ ] **Breaking changes documented** (if any)
- [ ] **Migration guide updated** (if breaking)

### Code Quality Checks

- [ ] **Single Responsibility**: Each method does one thing
- [ ] **DRY**: No code duplication
- [ ] **KISS**: Simple, readable code
- [ ] **Consistent naming**: Follows project conventions
- [ ] **Meaningful comments**: Explain "why", not "what"
- [ ] **Error messages**: Clear, actionable
- [ ] **Test names**: Descriptive (should X when Y)
- [ ] **No magic numbers**: Use named constants
- [ ] **Proper imports**: Correct paths, no circular dependencies
- [ ] **Cleanup**: `destroy()` methods release resources

---

## Contribution Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/activity-emotional-metadata
```

### 2. Implement Feature

- Write tests first (TDD)
- Implement functionality
- Document changes

### 3. Run Quality Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: Add emotional state activity metadata

- Add core:emotional_state component schema
- Extend metadata collection to include emotions
- Add tests for emotional metadata collection
- Update documentation

Closes #123"
```

### 5. Push and Create PR

```bash
git push origin feature/activity-emotional-metadata
```

### 6. Address Review Feedback

```bash
# Make requested changes
git add .
git commit -m "refactor: Address PR feedback"
git push
```

---

## Resources

### Documentation

- **Architecture**: `docs/activity-description-system/architecture.md`
- **API Reference**: `docs/activity-description-system/api-reference.md`
- **Testing Guide**: `docs/activity-description-system/testing-guide.md`
- **Configuration**: `docs/activity-description-system/configuration-guide.md`
- **Migration**: `docs/migration/activity-description-service-refactoring.md`

### Code Examples

- **Unit Tests**: `tests/unit/anatomy/`
- **Integration Tests**: `tests/integration/anatomy/`
- **Test Helpers**: `tests/common/`

### External Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [JSDoc Syntax](https://jsdoc.app/about-getting-started.html)

---

## Getting Help

- **Questions**: Open discussion in repository
- **Bugs**: Create issue with reproduction steps
- **Features**: Discuss in issue before implementing
- **Security**: Report privately to maintainers

---

**Last Updated**: 2025-11-01
**Version**: 2.0 (Facade Pattern Architecture)
**Maintainers**: Living Narrative Engine Team
