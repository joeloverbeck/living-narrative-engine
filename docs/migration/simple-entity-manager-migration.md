# SimpleEntityManager Migration Guide

## Overview

This guide helps migrate tests from direct `SimpleEntityManager` usage to `TestEntityManagerAdapter` for production API compatibility.

## Why Migrate?

### Before (SimpleEntityManager)

❌ **Problem:** API drift between test and production
❌ **Problem:** Operators must defensively code for both APIs
❌ **Problem:** Runtime errors that don't surface until integration testing

### After (TestEntityManagerAdapter)

✅ **Benefit:** Same API in tests and production
✅ **Benefit:** Catch API misuse early in unit tests
✅ **Benefit:** Easier operator development

## Migration Steps

### Step 1: Update Test File Imports

**Find files using SimpleEntityManager:**
```bash
grep -r "SimpleEntityManager" tests/
```

**Before:**
```javascript
import SimpleEntityManager from '../../common/engine/SimpleEntityManager.js';

describe('My Test', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = new SimpleEntityManager({ logger });
  });
});
```

**After:**
```javascript
import { createEntityManagerAdapter } from '../../common/engine/entityManagerTestFactory.js';

describe('My Test', () => {
  let entityManager;

  beforeEach(() => {
    entityManager = createEntityManagerAdapter({ logger });
  });
});
```

### Step 2: No Logic Changes Required

All existing test code continues to work:

```javascript
// All these work the same
entityManager.addEntity({ id: 'test', components: {} });
entityManager.getEntities();
entityManager.hasComponent('test', 'core:actor');
entityManager.getComponentData('test', 'core:actor');
entityManager.clear();
```

### Step 3: (Optional) Use Production Extensions

Take advantage of new production API methods:

```javascript
// Before - manual filtering
const actors = entityManager.getEntities().filter(e =>
  entityManager.hasComponent(e.id, 'core:actor')
);

// After - production API
const actors = entityManager.getEntitiesWithComponent('core:actor');
```

## Automated Migration Script

Use this script to automate Step 1:

```bash
#!/bin/bash
# migrate-entity-manager.sh

find tests/ -name "*.test.js" -type f | while read file; do
  # Check if file uses SimpleEntityManager
  if grep -q "SimpleEntityManager" "$file"; then
    echo "Migrating: $file"

    # Update import
    sed -i 's/import SimpleEntityManager from/import { createEntityManagerAdapter } from/g' "$file"
    sed -i 's/SimpleEntityManager\.js/entityManagerTestFactory\.js/g' "$file"

    # Update instantiation
    sed -i 's/new SimpleEntityManager({ logger })/createEntityManagerAdapter({ logger })/g' "$file"

    echo "  ✓ Migrated"
  fi
done

echo "Migration complete"
```

## Validation

After migration, run tests to verify:

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Verify no warnings about SimpleEntityManager
npm run test:unit 2>&1 | grep "SimpleEntityManager is deprecated"
```

## Rollback

If migration causes issues, rollback is simple:

```bash
git checkout tests/
```

Individual files can be reverted using legacy mode:

```javascript
import { createTestEntityManager } from '../../common/engine/entityManagerTestFactory.js';

// Use legacy SimpleEntityManager
const manager = createTestEntityManager({ logger, useAdapter: false });
```

## Timeline

**Phase 1 (Weeks 1-2):** Migrate high-traffic test files
**Phase 2 (Weeks 3-4):** Migrate remaining test files
**Phase 3 (Week 5):** Remove SimpleEntityManager deprecation warnings
**Phase 4 (Week 6):** Make adapter the default (remove useAdapter flag)

## References

- **Testing Guide:** `docs/testing/entity-manager-testing-guide.md`
- **Interface Definition:** `docs/testing/entity-manager-interface.md` (from ANAPRETEST-001)
- **Adapter Code:** `tests/common/engine/TestEntityManagerAdapter.js`
