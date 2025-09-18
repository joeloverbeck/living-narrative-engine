# COMMODMIG-007: Update JavaScript Operation Handlers

## Overview
Update JavaScript operation handlers and utility files to use the new companionship namespace. This includes updating component ID constants and all references throughout the operation handler files.

## Prerequisites
- COMMODMIG-001 through COMMODMIG-006 (all JSON migrations complete)

## Acceptance Criteria
1. ✅ Component ID constants updated to use companionship namespace
2. ✅ All 5 operation handlers updated with new component references
3. ✅ followUtils.js updated with new namespace
4. ✅ All JavaScript files use companionship:following and companionship:leading
5. ✅ No hardcoded "core:following" or "core:leading" strings remain
6. ✅ Tests still pass after updates (or are marked for update)

## Implementation Steps

### Step 1: Update Component ID Constants
Edit `src/constants/componentIds.js`:

**Before:**
```javascript
export const FOLLOWING_COMPONENT_ID = 'core:following';
export const LEADING_COMPONENT_ID = 'core:leading';
```

**After:**
```javascript
export const FOLLOWING_COMPONENT_ID = 'companionship:following';
export const LEADING_COMPONENT_ID = 'companionship:leading';
```

### Step 2: Update establishFollowRelationHandler.js
Edit `src/logic/operationHandlers/establishFollowRelationHandler.js`:

1. Check imports - ensure it imports component constants:
```javascript
import { FOLLOWING_COMPONENT_ID, LEADING_COMPONENT_ID } from '../../constants/componentIds.js';
```

2. Search for any hardcoded strings and update:
```javascript
// Replace any occurrence of:
'core:following' → FOLLOWING_COMPONENT_ID
'core:leading' → LEADING_COMPONENT_ID
```

3. Common patterns to update:
```javascript
// Before:
entityManager.addComponent(followerId, 'core:following', { leaderId });
entityManager.addComponent(leaderId, 'core:leading', { followers: [followerId] });

// After:
entityManager.addComponent(followerId, FOLLOWING_COMPONENT_ID, { leaderId });
entityManager.addComponent(leaderId, LEADING_COMPONENT_ID, { followers: [followerId] });
```

### Step 3: Update breakFollowRelationHandler.js
Edit `src/logic/operationHandlers/breakFollowRelationHandler.js`:

1. Ensure proper imports
2. Update component references:
```javascript
// Before:
const followingComponent = entityManager.getComponent(actorId, 'core:following');
entityManager.removeComponent(actorId, 'core:following');

// After:
const followingComponent = entityManager.getComponent(actorId, FOLLOWING_COMPONENT_ID);
entityManager.removeComponent(actorId, FOLLOWING_COMPONENT_ID);
```

3. Update leading component updates:
```javascript
// Before:
const leadingComponent = entityManager.getComponent(leaderId, 'core:leading');

// After:
const leadingComponent = entityManager.getComponent(leaderId, LEADING_COMPONENT_ID);
```

### Step 4: Update checkFollowCycleHandler.js
Edit `src/logic/operationHandlers/checkFollowCycleHandler.js`:

1. Update component checks:
```javascript
// Before:
const followingComp = entityManager.getComponent(currentId, 'core:following');

// After:
const followingComp = entityManager.getComponent(currentId, FOLLOWING_COMPONENT_ID);
```

### Step 5: Update autoMoveFollowersHandler.js
Edit `src/logic/operationHandlers/autoMoveFollowersHandler.js`:

1. Update component queries:
```javascript
// Before:
const leadingComponent = entityManager.getComponent(leaderId, 'core:leading');

// After:
const leadingComponent = entityManager.getComponent(leaderId, LEADING_COMPONENT_ID);
```

2. Update follower checks:
```javascript
// Before:
const hasFollowing = entityManager.hasComponent(followerId, 'core:following');

// After:
const hasFollowing = entityManager.hasComponent(followerId, FOLLOWING_COMPONENT_ID);
```

### Step 6: Update rebuildLeaderListCacheHandler.js
Edit `src/logic/operationHandlers/rebuildLeaderListCacheHandler.js`:

1. Update cache building logic:
```javascript
// Before:
const entitiesWithLeading = entityManager.getEntitiesWithComponent('core:leading');
const entitiesWithFollowing = entityManager.getEntitiesWithComponent('core:following');

// After:
const entitiesWithLeading = entityManager.getEntitiesWithComponent(LEADING_COMPONENT_ID);
const entitiesWithFollowing = entityManager.getEntitiesWithComponent(FOLLOWING_COMPONENT_ID);
```

### Step 7: Update followUtils.js
Edit `src/utils/followUtils.js`:

1. Update all utility functions:
```javascript
// Before:
export function isFollowing(entityManager, entityId) {
  return entityManager.hasComponent(entityId, 'core:following');
}

export function getLeader(entityManager, followerId) {
  const following = entityManager.getComponent(followerId, 'core:following');
  return following?.leaderId;
}

// After:
import { FOLLOWING_COMPONENT_ID, LEADING_COMPONENT_ID } from '../constants/componentIds.js';

export function isFollowing(entityManager, entityId) {
  return entityManager.hasComponent(entityId, FOLLOWING_COMPONENT_ID);
}

export function getLeader(entityManager, followerId) {
  const following = entityManager.getComponent(followerId, FOLLOWING_COMPONENT_ID);
  return following?.leaderId;
}
```

### Step 8: Search for Additional References
Run a comprehensive search to find any missed references:

```bash
# Search for hardcoded core:following or core:leading
grep -r "core:following" src/
grep -r "core:leading" src/

# Should only find them in componentIds.js comments or test files
```

### Step 9: Run Initial Tests
Run tests to identify what breaks:

```bash
# Run specific operation handler tests
npm run test:unit -- src/logic/operationHandlers/

# Run tests that might use these components
npm run test:integration -- --grep "follow"
```

## Testing Requirements

### Code Verification
1. No hardcoded component IDs:
   ```bash
   # Should return no results in src/ (except maybe tests)
   grep -r '"core:following"' src/
   grep -r '"core:leading"' src/
   grep -r "'core:following'" src/
   grep -r "'core:leading'" src/
   ```

2. Verify imports are correct:
   ```bash
   # Check that operation handlers import from componentIds
   grep -l "componentIds" src/logic/operationHandlers/*.js
   ```

### Unit Tests
The following test files will need updates (handled in COMMODMIG-009):
- `tests/unit/logic/operationHandlers/establishFollowRelationHandler.test.js`
- `tests/unit/logic/operationHandlers/breakFollowRelationHandler.test.js`
- `tests/unit/logic/operationHandlers/checkFollowCycleHandler.test.js`
- `tests/unit/logic/operationHandlers/autoMoveFollowersHandler.test.js`
- `tests/unit/logic/operationHandlers/rebuildLeaderListCacheHandler.test.js`

For now, note which tests fail after the changes.

### Integration Tests
1. Follow action should create companionship:following component
2. Leading component should be created/updated correctly
3. Auto-movement should still work with new namespaces

## Common Patterns to Update

### Component Addition
```javascript
// Before:
entityManager.addComponent(entityId, 'core:following', data);

// After:
entityManager.addComponent(entityId, FOLLOWING_COMPONENT_ID, data);
```

### Component Query
```javascript
// Before:
const component = entityManager.getComponent(entityId, 'core:leading');

// After:
const component = entityManager.getComponent(entityId, LEADING_COMPONENT_ID);
```

### Component Check
```javascript
// Before:
if (entityManager.hasComponent(entityId, 'core:following')) {

// After:
if (entityManager.hasComponent(entityId, FOLLOWING_COMPONENT_ID)) {
```

## Notes
- Always use the imported constants, never hardcode the strings
- The constants provide a single source of truth
- Some test files may have hardcoded values that need separate updates
- Event types remain unchanged (e.g., FOLLOW_RELATION_ESTABLISHED)

## Dependencies
- Blocks: COMMODMIG-008, COMMODMIG-009, COMMODMIG-010
- Blocked by: COMMODMIG-001 through COMMODMIG-006

## Estimated Effort
- 2 hours

## Risk Assessment
- **High Risk**: These handlers are core to the following functionality
- **Wide Impact**: Changes affect runtime behavior
- **Mitigation**: Systematic update using constants, comprehensive testing

## Success Metrics
- All operation handlers use imported constants
- No hardcoded "core:following" or "core:leading" strings
- followUtils uses new namespace
- Basic functionality works (detailed testing in COMMODMIG-009)