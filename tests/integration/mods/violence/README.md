# Violence Mod Tests

## Testing Pattern

All violence mod tests use the ModTestFixture pattern with ScopeResolverHelpers for scope registration.

### Standard Setup

```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('violence:{action} - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', '{action}');

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([{action}Action]);

    // Register positioning scopes (replaces 40+ lines of manual implementation)
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });
});
```

### Custom Scopes

For actions requiring custom scope resolvers (e.g., tear_out_throat), use factory methods:

```javascript
const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
  'positioning:custom_scope',
  { componentType: 'mod:component', sourceField: 'field', contextSource: 'actor' }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:custom_scope': customResolver }
);
```

## Migration History

- **2025-10-26**: Migrated from manual scope resolution to ScopeResolverHelpers (TEAOUTTHR-004)
  - Reduced boilerplate from 40+ lines to 1-7 lines per test
  - Improved maintainability and consistency
