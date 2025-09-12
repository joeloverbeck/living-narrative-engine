# ANACLOENH-010: Migrate Anatomy Services to Facade Pattern

## Overview
Systematically migrate the complex anatomy system's 51 files and 20+ service components from direct usage to the new AnatomySystemFacade pattern, managing the complexity of graph operations and description generation.

## Current State
- **Service Complexity**: 51 files across multiple layers with deep interdependencies
- **Graph Operations**: Direct graph builder and validator usage throughout
- **Description Generation**: Multiple entry points for description composition
- **Cache Management**: Direct LRU cache usage in various components

## Objectives
1. Map all direct anatomy service usage across the codebase
2. Create sophisticated migration strategy for complex graph operations
3. Consolidate description generation through facade
4. Migrate cache usage to unified facade caching
5. Update blueprint processing workflows
6. Maintain performance characteristics during migration

## Technical Requirements

### Anatomy Usage Analyzer
```javascript
// Location: tools/migration/AnatomyUsageAnalyzer.js
class AnatomyUsageAnalyzer {
  constructor() {
    this.complexityMap = new Map();
    this.serviceCategories = {
      graph: [
        'IAnatomyGraphBuilder',
        'IAnatomyGraphValidator',
        'IGraphConstraintValidator'
      ],
      description: [
        'IBodyDescriptionComposer',
        'IDescriptionTemplateEngine',
        'IDescriptionFormatter'
      ],
      workflow: [
        'IBlueprintProcessor',
        'IAnatomyWorkflowOrchestrator',
        'IPartAttachmentWorkflow'
      ],
      cache: [
        'IAnatomyQueryCache',
        'IAnatomyClothingCache'
      ]
    };
  }
  
  async analyzeComplexity() {
    const files = await this.findAnatomyFiles();
    
    for (const file of files) {
      const complexity = await this.assessFileComplexity(file);
      this.complexityMap.set(file, complexity);
    }
    
    return this.generateComplexityReport();
  }
  
  async assessFileComplexity(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const ast = this.parseAST(content);
    
    return {
      serviceUsage: this.countServiceUsage(ast),
      graphOperations: this.countGraphOperations(ast),
      descriptionGeneration: this.countDescriptionOps(ast),
      cacheOperations: this.countCacheOps(ast),
      migrationRisk: this.assessMigrationRisk(ast)
    };
  }
  
  generateMigrationWaves() {
    const waves = {
      wave1: { // Low complexity, high impact
        description: 'Simple query operations and basic workflows',
        files: [],
        estimatedDays: 2
      },
      wave2: { // Medium complexity
        description: 'Description generation and cache integration',
        files: [],
        estimatedDays: 3
      },
      wave3: { // High complexity
        description: 'Graph operations and complex workflows',
        files: [],
        estimatedDays: 4
      },
      wave4: { // Critical systems
        description: 'Core integrations and blueprint processing',
        files: [],
        estimatedDays: 3
      }
    };
    
    for (const [file, complexity] of this.complexityMap.entries()) {
      const wave = this.categorizeByComplexity(complexity);
      waves[wave].files.push({ file, complexity });
    }
    
    return waves;
  }
}
```

### Sophisticated Migration Helper
```javascript
// Location: src/anatomy/facades/helpers/AnatomyMigrationHelper.js
class AnatomyMigrationHelper {
  static createGraphOperationAdapter(facade, legacyServices) {
    return {
      buildGraph: async (entityId, blueprint) => {
        console.warn(
          'Deprecated: Direct graph building. Use facade.buildBodyGraph()'
        );
        return await facade.buildBodyGraph(entityId, blueprint);
      },
      
      validateGraph: async (graph) => {
        console.warn(
          'Deprecated: Direct graph validation. Use facade with validation options'
        );
        // Convert to facade validation pattern
        const tempEntityId = 'migration-temp';
        return await facade.validateGraph(tempEntityId, { graph });
      },
      
      attachPart: async (entityId, partId, parentId, constraints) => {
        return await facade.attachPart(entityId, partId, parentId, {
          validateConstraints: constraints !== false
        });
      }
    };
  }
  
  static createDescriptionAdapter(facade, legacyComposer) {
    return {
      compose: async (anatomyData, options = {}) => {
        console.warn(
          'Deprecated: Direct description composition. Use facade.generateDescription()'
        );
        
        // Extract entity ID from anatomy data
        const entityId = anatomyData.entityId || 'legacy-entity';
        
        return await facade.generateDescription(entityId, {
          level: options.detail || 'summary',
          format: options.format || 'text',
          includeHidden: options.includeHidden || false
        });
      },
      
      generatePartDescription: async (partData, options = {}) => {
        const entityId = partData.entityId || 'legacy-entity';
        return await facade.getPartDescription(entityId, partData.partId);
      }
    };
  }
  
  static createCacheAdapter(facade, legacyCache) {
    const deprecationWarned = new Set();
    
    return {
      get: (key, generator) => {
        if (!deprecationWarned.has('cache.get')) {
          console.warn(
            'Deprecated: Direct anatomy cache usage. ' +
            'Use facade methods which include caching.'
          );
          deprecationWarned.add('cache.get');
        }
        
        // Delegate to facade's internal caching
        return facade.cache.get(key, generator);
      },
      
      invalidate: (pattern) => {
        if (!deprecationWarned.has('cache.invalidate')) {
          console.warn(
            'Deprecated: Direct cache invalidation. ' +
            'Cache invalidation is handled automatically by facade.'
          );
          deprecationWarned.add('cache.invalidate');
        }
        
        return facade.cache.invalidate(pattern);
      }
    };
  }
}
```

### Blueprint Processing Migration
```javascript
// Location: src/anatomy/workflows/helpers/BlueprintMigrationHelper.js
class BlueprintMigrationHelper {
  static migrateWorkflowToFacade(workflow, facade) {
    return class MigratedWorkflow extends workflow {
      constructor(dependencies) {
        // Replace direct service dependencies with facade
        const facadeDependencies = {
          ...dependencies,
          anatomySystem: facade,
          // Keep other non-anatomy services
          logger: dependencies.logger,
          eventBus: dependencies.eventBus
        };
        
        super(facadeDependencies);
        
        console.warn(
          `Workflow ${this.constructor.name}: Migrated to use AnatomySystemFacade. ` +
          'Please update to use facade methods directly.'
        );
      }
      
      async processBlueprint(entityId, blueprint) {
        // Use facade instead of direct blueprint processor
        return await this.anatomySystem.buildBodyGraph(entityId, blueprint);
      }
      
      async validateBlueprint(blueprint) {
        // Create temporary entity for validation
        const tempEntityId = `validation-${Date.now()}`;
        try {
          await this.anatomySystem.buildBodyGraph(tempEntityId, blueprint);
          return { valid: true };
        } catch (error) {
          return { valid: false, errors: [error.message] };
        }
      }
    };
  }
}
```

## Implementation Steps

1. **Comprehensive Usage Analysis** (Day 1-2)
   - Map all 51 anatomy files and their dependencies
   - Identify graph operation patterns
   - Document description generation flows
   - Analyze cache usage patterns

2. **Create Migration Infrastructure** (Day 3)
   - Build sophisticated migration helpers
   - Create graph operation adapters
   - Build description generation adapters
   - Set up cache migration utilities

3. **Wave 1 Migration: Simple Operations** (Day 4-5)
   - Migrate basic query operations
   - Update simple part attachment workflows
   - Migrate straightforward cache usage

4. **Wave 2 Migration: Description System** (Day 6-8)
   - Migrate description generation workflows
   - Update template-based description systems
   - Consolidate description caching

5. **Wave 3 Migration: Graph Operations** (Day 9-12)
   - Migrate complex graph building operations
   - Update graph validation workflows
   - Migrate constraint validation systems

6. **Wave 4 Migration: Core Integrations** (Day 13-15)
   - Update blueprint processing workflows
   - Migrate EntityManager integration
   - Update core system integrations

## File Changes

### New Files
- `tools/migration/AnatomyUsageAnalyzer.js`
- `src/anatomy/facades/helpers/AnatomyMigrationHelper.js`
- `src/anatomy/workflows/helpers/BlueprintMigrationHelper.js`
- `src/anatomy/facades/adapters/GraphOperationAdapter.js`
- `src/anatomy/facades/adapters/DescriptionAdapter.js`

### Modified Files (By Wave)

#### Wave 1: Simple Operations
- `src/anatomy/services/anatomySocketIndex.js` - Use facade for queries
- Simple workflow files in `src/anatomy/workflows/`
- Basic integration points

#### Wave 2: Description System
- `src/anatomy/services/bodyDescriptionComposer.js` - Integrate with facade
- Template files in `src/anatomy/templates/`
- Description workflow files

#### Wave 3: Graph Operations
- `src/anatomy/orchestration/` files - Use facade for graph operations
- `src/anatomy/validation/` files - Use facade validation
- Complex workflow orchestration files

#### Wave 4: Core Integrations
- `src/entities/entityManager.js` - Use anatomy facade
- Blueprint processing workflows
- Core system integration points

### Test Files (All Waves)
- `tests/unit/anatomy/` - Update to use facade mocks
- `tests/integration/anatomy/` - Verify facade integration
- `tests/performance/anatomy/` - Ensure performance maintained

## Dependencies
- **Prerequisites**: ANACLOENH-008 (AnatomySystemFacade implementation)
- **External**: AST parsing tools, graph analysis utilities
- **Internal**: All 51 anatomy system files

## Acceptance Criteria
1. ✅ All 51 anatomy files analyzed for complexity
2. ✅ Wave-based migration plan executed successfully
3. ✅ Graph operations maintain performance characteristics
4. ✅ Description generation consolidated through facade
5. ✅ Cache operations unified under facade
6. ✅ All tests pass after migration
7. ✅ 90% of direct service usage eliminated
8. ✅ Migration documentation complete

## Testing Requirements

### Wave-Specific Testing
- **Wave 1**: Simple operation regression tests
- **Wave 2**: Description generation accuracy tests
- **Wave 3**: Graph operation performance tests
- **Wave 4**: End-to-end integration tests

### Performance Validation
- Graph building performance maintained
- Description generation speed preserved
- Cache hit rates improved or maintained
- Memory usage within acceptable bounds

### Migration Verification
- Before/after functionality comparison
- Performance benchmark comparison
- Error handling consistency validation

## Risk Assessment

### Risks by Wave
1. **Wave 1**: Low risk - simple operations
2. **Wave 2**: Medium risk - description format changes
3. **Wave 3**: High risk - complex graph operations
4. **Wave 4**: Critical risk - core system functionality

### Mitigation Strategies
1. **Feature flags**: Enable/disable facade usage per operation
2. **A/B testing**: Run old and new implementations in parallel
3. **Rollback capability**: Quick revert mechanism for each wave
4. **Extensive testing**: Comprehensive test coverage for each wave

## Estimated Effort
- **Analysis**: 2 days
- **Infrastructure**: 1 day
- **Wave 1 Migration**: 2 days
- **Wave 2 Migration**: 3 days
- **Wave 3 Migration**: 4 days
- **Wave 4 Migration**: 3 days
- **Total**: 15 days

## Success Metrics
- 90% of direct anatomy service usage eliminated
- Graph operation performance within 5% of baseline
- Description generation speed maintained or improved
- Zero critical functionality regressions
- All 51 files successfully migrated

## Migration Wave Timeline
```
Phase 1: Analysis and Setup (Days 1-3)
├─ Comprehensive usage analysis
├─ Complexity assessment
└─ Migration infrastructure

Phase 2: Wave-Based Migration (Days 4-12)
├─ Wave 1: Simple operations (Days 4-5)
├─ Wave 2: Description system (Days 6-8)
└─ Wave 3: Graph operations (Days 9-12)

Phase 3: Core Integration (Days 13-15)
├─ Wave 4: Critical systems (Days 13-15)
├─ Final testing and validation
└─ Documentation completion
```

## Migration Validation Checklist
```
Pre-Migration:
□ All 51 files categorized by complexity
□ Migration helpers implemented and tested
□ Feature flags configured for rollback
□ Performance baselines established

Wave 1 (Simple Operations):
□ Basic queries migrated
□ Simple workflows updated
□ Cache usage patterns migrated
□ All tests passing

Wave 2 (Description System):
□ Description generation migrated
□ Template system updated
□ Caching consolidated
□ Description accuracy verified

Wave 3 (Graph Operations):
□ Graph building migrated
□ Validation systems updated
□ Performance maintained
□ Complex workflows migrated

Wave 4 (Core Integration):
□ EntityManager integration complete
□ Blueprint processing updated
□ Core systems functional
□ End-to-end testing passed
```

## Notes
- Consider implementing graph diff utilities for debugging migrations
- Add comprehensive logging for migration tracking
- Create performance monitoring dashboards for each wave
- Implement automated rollback triggers for performance regressions