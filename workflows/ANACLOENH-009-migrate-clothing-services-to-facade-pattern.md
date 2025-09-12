# ANACLOENH-009: Migrate Clothing Services to Facade Pattern

## Overview
Systematically migrate existing code that directly uses clothing services to use the new ClothingSystemFacade, ensuring backward compatibility during the transition period.

## Current State
- **Direct Usage**: Code throughout the system directly imports and uses clothing services
- **Scattered Dependencies**: 16 files across 6 services with complex interdependencies
- **Testing Complexity**: Tests mock multiple services individually
- **Integration Points**: ScopeDsl, EntityManager, and other systems directly use services

## Objectives
1. Identify all direct usage of clothing services in the codebase
2. Create migration strategy with minimal breaking changes
3. Update core integration points (ScopeDsl, EntityManager)
4. Migrate existing tests to use facade
5. Maintain backward compatibility with deprecation warnings
6. Remove deprecated direct usage after migration period

## Technical Requirements

### Usage Analysis
```javascript
// Location: tools/migration/ClothingUsageAnalyzer.js
class ClothingUsageAnalyzer {
  constructor() {
    this.usageMap = new Map();
    this.serviceTokens = [
      'IClothingAccessibilityService',
      'IClothingManagementService',
      'IClothingInstantiationService',
      'IEquipmentDescriptionService',
      'ILayerResolutionService',
      'IEquipmentOrchestrator'
    ];
  }
  
  async analyzeCodebase() {
    const files = await this.findJavaScriptFiles();
    
    for (const file of files) {
      const usages = await this.analyzeFile(file);
      if (usages.length > 0) {
        this.usageMap.set(file, usages);
      }
    }
    
    return this.generateReport();
  }
  
  async analyzeFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const usages = [];
    
    // Find direct service imports
    const importMatches = content.match(/import.*from.*clothing\/(services|orchestration)/g);
    if (importMatches) {
      usages.push(...importMatches.map(m => ({ type: 'import', line: m })));
    }
    
    // Find DI token usage
    for (const token of this.serviceTokens) {
      const tokenRegex = new RegExp(`${token}`, 'g');
      const matches = content.match(tokenRegex);
      if (matches) {
        usages.push(...matches.map(m => ({ type: 'token', service: token })));
      }
    }
    
    return usages;
  }
  
  generateMigrationPlan() {
    const plan = {
      critical: [],     // Must migrate immediately
      standard: [],     // Migrate during normal development
      deprecated: []    // Mark for eventual removal
    };
    
    for (const [file, usages] of this.usageMap.entries()) {
      const priority = this.categorizeFile(file, usages);
      plan[priority].push({ file, usages });
    }
    
    return plan;
  }
}
```

### Migration Helper
```javascript
// Location: src/clothing/facades/helpers/MigrationHelper.js
class MigrationHelper {
  static createBackwardCompatibleFacade(facade) {
    return new Proxy(facade, {
      get(target, prop, receiver) {
        const facadeMethod = Reflect.get(target, prop, receiver);
        
        if (typeof facadeMethod === 'function') {
          return function(...args) {
            // Log deprecation warning for old method signatures
            if (MigrationHelper.isLegacyMethodSignature(prop, args)) {
              console.warn(
                `Deprecated: Legacy method signature for ${prop}. ` +
                `Please update to new facade interface.`
              );
            }
            
            return facadeMethod.apply(target, args);
          };
        }
        
        return facadeMethod;
      }
    });
  }
  
  static isLegacyMethodSignature(method, args) {
    // Define legacy method signatures that need warnings
    const legacySignatures = {
      getAccessibleItems: (args) => args.length > 2,
      equipItem: (args) => typeof args[2] !== 'object'
    };
    
    return legacySignatures[method]?.(args) || false;
  }
  
  static createServiceAdapter(serviceName, facade) {
    // Create adapter for legacy service interface
    return {
      // Map old service methods to facade methods
      getAccessibleItems: facade.getAccessibleItems.bind(facade),
      equipItem: (entityId, itemId, slot) => 
        facade.equipItem(entityId, itemId, slot, {}),
      // ... other method mappings
    };
  }
}
```

### Core Integration Updates

#### ScopeDsl Integration
```javascript
// Location: src/scopeDsl/engine.js (modifications)
class ScopeDslEngine {
  constructor({ /* existing params */ clothingSystemFacade }) {
    // ... existing constructor code
    
    // Use facade instead of direct service
    this.clothingSystem = clothingSystemFacade;
    
    // Maintain backward compatibility
    if (!clothingSystemFacade && clothingAccessibilityService) {
      console.warn(
        'ScopeDslEngine: Using deprecated clothingAccessibilityService. ' +
        'Please update to use ClothingSystemFacade.'
      );
      this.clothingSystem = MigrationHelper.createServiceAdapter(
        'ClothingAccessibilityService',
        clothingAccessibilityService
      );
    }
  }
  
  async resolveClothingQuery(entityId, query) {
    // Updated to use facade
    return await this.clothingSystem.getAccessibleItems(entityId, {
      mode: query.mode || 'all',
      includeBlocked: query.includeBlocked || false
    });
  }
}
```

#### EntityManager Integration
```javascript
// Location: src/entities/entityManager.js (modifications)
class EntityManager {
  constructor({ /* existing params */ clothingSystemFacade }) {
    // ... existing constructor code
    this.clothingSystem = clothingSystemFacade;
  }
  
  async equipItemToEntity(entityId, itemId, slot) {
    // Use facade instead of direct orchestrator calls
    return await this.clothingSystem.equipItem(entityId, itemId, slot);
  }
  
  async getEntityEquipment(entityId, options = {}) {
    return await this.clothingSystem.getEquippedItems(entityId, options);
  }
}
```

## Implementation Steps

1. **Analyze Current Usage** (Day 1)
   - Run usage analyzer on entire codebase
   - Categorize files by migration priority
   - Document current integration patterns

2. **Create Migration Infrastructure** (Day 2)
   - Implement migration helper utilities
   - Create backward compatibility layer
   - Add deprecation warning system

3. **Update Core Integrations** (Day 3-4)
   - Migrate ScopeDsl engine to use facade
   - Update EntityManager integration
   - Update any other core system integrations

4. **Migrate High-Priority Files** (Day 5-6)
   - Update critical system files
   - Migrate main workflow files
   - Update dependency injection configurations

5. **Update Test Infrastructure** (Day 7-8)
   - Create facade test utilities
   - Migrate critical tests to use facade
   - Update test helper functions

6. **Gradual Migration** (Day 9-12)
   - Migrate standard priority files
   - Add deprecation warnings to legacy usage
   - Update documentation and examples

## File Changes

### New Files
- `tools/migration/ClothingUsageAnalyzer.js`
- `src/clothing/facades/helpers/MigrationHelper.js`
- `src/clothing/facades/adapters/LegacyServiceAdapter.js`
- `docs/migration/clothing-facade-migration.md`

### Modified Files
- `src/scopeDsl/engine.js` - Use facade instead of direct service
- `src/scopeDsl/nodes/arrayIterationResolver.js` - Update clothing integration
- `src/entities/entityManager.js` - Use facade for equipment operations
- `src/dependencyInjection/registrations/clothingRegistrations.js` - Register facade
- All test files using clothing services
- Documentation and example files

### Analysis Output Files
- `reports/clothing-usage-analysis.json`
- `reports/migration-plan.json`
- `reports/migration-progress.json`

## Dependencies
- **Prerequisites**: ANACLOENH-007 (ClothingSystemFacade implementation)
- **External**: AST parsing tools for code analysis
- **Internal**: All files currently using clothing services

## Acceptance Criteria
1. ✅ All direct clothing service usage identified
2. ✅ Core integrations (ScopeDsl, EntityManager) use facade
3. ✅ Backward compatibility maintained during migration
4. ✅ Deprecation warnings show for legacy usage
5. ✅ All tests pass with facade
6. ✅ Performance remains consistent
7. ✅ 80% of codebase migrated to facade
8. ✅ Migration documentation complete

## Testing Requirements

### Migration Verification Tests
- Test that old and new interfaces produce same results
- Verify backward compatibility works
- Test deprecation warnings fire correctly

### Regression Tests
- Ensure existing functionality unchanged
- Verify performance characteristics maintained
- Test error handling consistency

### Integration Tests
- Test ScopeDsl with facade
- Verify EntityManager operations work
- Test end-to-end workflows

## Risk Assessment

### Risks
1. **Breaking changes**: Migration might break existing functionality
2. **Performance regression**: Facade might introduce overhead
3. **Incomplete migration**: Some usage might be missed

### Mitigation
1. Maintain backward compatibility during transition
2. Performance test before and after migration
3. Use automated tools for comprehensive analysis

## Estimated Effort
- **Analysis**: 1 day
- **Infrastructure**: 2 days
- **Core Migrations**: 2 days
- **Test Migration**: 2 days
- **Gradual Migration**: 4 days
- **Total**: 11 days

## Success Metrics
- 80% of direct service usage eliminated
- Zero breaking changes during migration
- All existing tests continue to pass
- Performance within 5% of baseline

## Migration Timeline
```
Week 1: Analysis and Infrastructure
├─ Day 1: Usage analysis and categorization
├─ Day 2: Migration helper implementation
└─ Day 3-4: Core system integration

Week 2: Test Migration and Gradual Rollout
├─ Day 5-6: High-priority file migration
├─ Day 7-8: Test infrastructure update
└─ Day 9-10: Standard priority migration

Week 3: Completion and Documentation
├─ Day 11-12: Remaining migrations
├─ Day 13: Documentation updates
└─ Day 14: Final verification
```

## Migration Checklist
```
Pre-Migration:
□ Run usage analyzer
□ Create migration plan
□ Set up backward compatibility
□ Prepare test infrastructure

Core Migration:
□ Update ScopeDsl integration
□ Update EntityManager integration
□ Update DI registrations
□ Migrate critical workflows

Test Migration:
□ Update test utilities
□ Migrate high-priority tests
□ Verify no test failures
□ Update mock factories

Final Steps:
□ Add deprecation warnings
□ Update documentation
□ Monitor for issues
□ Plan removal of legacy support
```

## Notes
- Consider creating automated migration scripts
- Add metrics to track migration progress
- Create rollback plan in case of issues
- Consider feature flags for gradual rollout