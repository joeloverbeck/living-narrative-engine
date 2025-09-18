# COMMODMIG-006: Migrate Scope Definitions

## Overview
Migrate the followers and potential_leaders scope definition files from core mod to companionship mod. Update namespace references and ensure the Scope DSL syntax remains valid.

## Prerequisites
- COMMODMIG-001 (mod structure must exist)
- COMMODMIG-002 (components migrated - referenced in scopes)
- All other JSON migrations should be complete

## Acceptance Criteria
1. ✅ Both scope files are moved to companionship mod
2. ✅ Namespace references updated in scope definitions
3. ✅ Scope DSL syntax validates correctly
4. ✅ Component references use companionship namespace
5. ✅ Original files removed from core mod

## Implementation Steps

### Step 1: Copy Scope Files
Copy the scope files to their new locations:

```bash
cp data/mods/core/scopes/followers.scope data/mods/companionship/scopes/followers.scope
cp data/mods/core/scopes/potential_leaders.scope data/mods/companionship/scopes/potential_leaders.scope
```

### Step 2: Update followers.scope
Edit `data/mods/companionship/scopes/followers.scope`:

The scope file needs to be updated to reference the companionship namespace. The exact syntax depends on the current implementation, but it will likely look like:

**Before:**
```
# Scope: core:followers
# Description: All entities following the actor

actor.companionship:leading.followers[]
```

**After:**
```
# Scope: companionship:followers
# Description: All entities following the actor

actor.companionship:leading.followers[]
```

Or if the scope uses a different syntax:

**Before:**
```
entity[{"has": ["core:following"]}].filter[{"==": [{"var": "following.leaderId"}, {"var": "actor.id"}]}]
```

**After:**
```
entity[{"has": ["companionship:following"]}].filter[{"==": [{"var": "following.leaderId"}, {"var": "actor.id"}]}]
```

### Step 3: Update potential_leaders.scope
Edit `data/mods/companionship/scopes/potential_leaders.scope`:

**Before:**
```
# Scope: core:potential_leaders
# Description: Entities that can be followed

entity[{"and": [
  {"!=": [{"var": "id"}, {"var": "actor.id"}]},
  {"not": {"has": ["core:following", {"leaderId": {"var": "actor.id"}}]}}
]}]
```

**After:**
```
# Scope: companionship:potential_leaders
# Description: Entities that can be followed

entity[{"and": [
  {"!=": [{"var": "id"}, {"var": "actor.id"}]},
  {"not": {"has": ["companionship:following", {"leaderId": {"var": "actor.id"}}]}}
]}]
```

### Step 4: Validate Scope DSL Syntax
Run the scope linter to ensure syntax is valid:

```bash
npm run scope:lint data/mods/companionship/scopes/followers.scope
npm run scope:lint data/mods/companionship/scopes/potential_leaders.scope
```

### Step 5: Remove Original Files
After confirming successful migration:

```bash
rm data/mods/core/scopes/followers.scope
rm data/mods/core/scopes/potential_leaders.scope
```

### Step 6: Update Core Mod Manifest
Edit `data/mods/core/mod-manifest.json`:

```json
{
  "scopes": [
    // Remove these lines:
    // "core:followers",
    // "core:potential_leaders",
    // ... keep other core scopes
  ]
}
```

## Scope DSL Syntax Reference

The Scope DSL supports the following operators:
- `.` - Field access (e.g., `actor.name`)
- `[]` - Array iteration (e.g., `actor.items[]`)
- `[{...}]` - JSON Logic filters (e.g., `actor.items[{"==": [{"var": "type"}, "weapon"]}]`)
- `+` or `|` - Union operators (e.g., `actor.followers | actor.partners`)
- `:` - Component namespacing (e.g., `companionship:following`)

Both `+` and `|` produce identical union behavior.

## Testing Requirements

### Syntax Validation
1. Run scope linter:
   ```bash
   npm run scope:lint data/mods/companionship/scopes/*.scope
   ```

2. Verify namespace updates:
   ```bash
   # Should find no core component references
   grep -r "core:following" data/mods/companionship/scopes/
   grep -r "core:leading" data/mods/companionship/scopes/

   # Should find companionship references
   grep -r "companionship:" data/mods/companionship/scopes/
   ```

### Runtime Tests
1. Load the scopes in the scope engine
2. Verify they resolve to correct entity sets
3. Test with entities that have following/leading components

### Integration Tests
1. Verify scopes can be used in other mod files
2. Test scope references in conditions or rules (if any)
3. Ensure scope resolution works with new namespaces

## Common Scope Patterns

### Get Followers of Actor
```
actor.companionship:leading.followers[]
```

### Get All Entities with Following Component
```
entity[{"has": ["companionship:following"]}]
```

### Filter by Component Data
```
entity[{"==": [{"var": "companionship:following.leaderId"}, "some-id"]}]
```

### Complex Filtering
```
entity[{"and": [
  {"has": ["companionship:following"]},
  {"!=": [{"var": "id"}, {"var": "actor.id"}]}
]}]
```

## Notes
- Scope files use a custom DSL that must be preserved
- Component namespacing uses `:` separator
- The scope engine must be aware of the new namespace (handled in JavaScript updates)
- Scope IDs themselves also need the namespace update
- Comments in scope files should be preserved

## Dependencies
- Blocks: None (scopes are the last JSON migration)
- Blocked by: COMMODMIG-001 through COMMODMIG-005

## Estimated Effort
- 45 minutes

## Risk Assessment
- **Low Risk**: Scopes are relatively isolated
- **DSL Complexity**: Must preserve exact syntax
- **Mitigation**: Use scope linter to validate syntax

## Success Metrics
- Both scope files exist in companionship mod
- Scope DSL syntax validates successfully
- Component references use companionship namespace
- No references to core components remain
- Scopes resolve correctly at runtime