# ACTDESC-009: Implement Entity Name Resolution with Caching

## Status
🟡 **Pending**

## Phase
**Phase 2: Core Service Implementation** (Week 1-2)

## Description
Implement `#resolveEntityName()` method with caching to efficiently convert entity IDs to display names for use in activity descriptions.

## Background
Activity descriptions reference entities by name. Caching prevents repeated lookups of the same entity names during description generation.

**Reference**: Design document lines 1643-1658, 883-898 (Entity Name Resolution)

## Technical Specification

### Method to Implement

```javascript
/**
 * Resolve entity name from ID with caching.
 *
 * @param {string} entityId - Entity ID
 * @returns {string} Entity name or ID if not found
 * @private
 */
#resolveEntityName(entityId) {
  // Check cache
  if (this.#entityNameCache.has(entityId)) {
    return this.#entityNameCache.get(entityId);
  }

  // Resolve from entity manager
  const entity = this.#entityManager.getEntityInstance(entityId);
  const nameComponent = entity?.getComponentData('core:name');
  const name = nameComponent?.text || entityId;

  // Cache for future use
  this.#entityNameCache.set(entityId, name);

  return name;
}
```

### Cache Management
- Cache is `Map<string, string>` (entityId → name)
- Cache persists for service lifetime
- No automatic invalidation (Phase 1)
- Event-driven invalidation in Phase 3 (ACTDESC-021)

## Acceptance Criteria
- [ ] Method implemented in ActivityDescriptionService
- [ ] Checks cache before entity lookup
- [ ] Retrieves `core:name` component from entity
- [ ] Returns `text` property from name component
- [ ] Falls back to entityId if entity not found
- [ ] Falls back to entityId if name component missing
- [ ] Caches resolved names for future use
- [ ] Uses `#entityNameCache` private field (already declared in class)

## Dependencies
- **Requires**: ACTDESC-005 (Service class structure)
- **Blocks**: ACTDESC-008 (Phrase generation needs names)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Entity Name Resolution', () => {
  it('should resolve entity name from core:name component', () => {
    const mockEntity = createMockEntity({
      id: 'jon',
      components: {
        'core:name': { text: 'Jon Ureña' },
      },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('Jon Ureña');
  });

  it('should cache resolved names', () => {
    const mockEntity = createMockEntity({
      components: {
        'core:name': { text: 'Jon Ureña' },
      },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    // First call
    service['#resolveEntityName']('jon');

    // Second call - should use cache
    const name = service['#resolveEntityName']('jon');

    expect(name).toBe('Jon Ureña');
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1); // Only once
  });

  it('should fallback to entityId if entity not found', () => {
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    const name = service['#resolveEntityName']('unknown_entity');
    expect(name).toBe('unknown_entity');
  });

  it('should fallback to entityId if name component missing', () => {
    const mockEntity = createMockEntity({
      components: {}, // No core:name
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('jon');
  });

  it('should fallback to entityId if name.text is empty', () => {
    const mockEntity = createMockEntity({
      components: {
        'core:name': { text: '' },
      },
    });
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    const name = service['#resolveEntityName']('jon');
    expect(name).toBe('jon');
  });

  it('should handle different entities independently', () => {
    mockEntityManager.getEntityInstance.mockImplementation(id => {
      if (id === 'jon') return createMockEntity({ name: 'Jon Ureña' });
      if (id === 'alicia') return createMockEntity({ name: 'Alicia Western' });
      return null;
    });

    expect(service['#resolveEntityName']('jon')).toBe('Jon Ureña');
    expect(service['#resolveEntityName']('alicia')).toBe('Alicia Western');
  });
});
```

## Implementation Notes
1. **Cache Structure**: Use existing `#entityNameCache` Map field from constructor
2. **Fallback Chain**:
   - Try cache → Try entity lookup → Try name component → Fallback to entityId
3. **Empty String Handling**: Treat empty string as invalid, fallback to entityId
4. **Optional Chaining**: Use `?.` for safe property access
5. **No Cache Invalidation**: Phase 1 doesn't handle name changes (acceptable for MVP)

## Performance Considerations
- Cache prevents repeated entity manager lookups
- Especially important when same entity appears in multiple activities
- Example: "Jon is kneeling before Alicia. Jon is holding hands with Alicia"
  - Without cache: 4 lookups (Jon×2, Alicia×2)
  - With cache: 2 lookups (Jon×1, Alicia×1)

## Future Enhancements (Phase 3)
- Event-based cache invalidation on name changes (ACTDESC-021)
- Cache size limits and LRU eviction
- Configurable cache timeout

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Name component: `data/schemas/components/core/name.component.json`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1643-1658, 883-898)

## Success Metrics
- Correctly resolves entity names
- Cache reduces redundant lookups
- Graceful fallback for missing entities
- All tests pass with 100% coverage

## Related Tickets
- **Requires**: ACTDESC-005 (Service class)
- **Blocks**: ACTDESC-008 (Phrase generation)
- **Enhanced By**: ACTDESC-021 (Cache invalidation - Phase 3)
