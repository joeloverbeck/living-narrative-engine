# ANACLOENH-008: Implement AnatomySystemFacade

## Overview
Implement the concrete AnatomySystemFacade that consolidates the complex anatomy system's 51 files and 20+ service components into a single, manageable interface.

## Current State
- **Services**: 51 files across multiple layers (services, orchestration, workflows, validation, integration)
- **Complexity**: Deep service hierarchies, complex graph operations, multiple cache layers
- **Issues**: Difficult to understand service interactions, high learning curve, complex testing

## Objectives
1. Implement concrete facade following the interface from ANACLOENH-002
2. Consolidate anatomy services behind unified interface
3. Simplify graph operations and validation
4. Optimize description generation pipeline
5. Provide clear abstraction for anatomy modifications

## Technical Requirements

### AnatomySystemFacade Implementation
```javascript
// Location: src/anatomy/facades/AnatomySystemFacade.js
import BaseFacade from '../../common/facades/BaseFacade.js';

class AnatomySystemFacade extends BaseFacade {
  #socketIndex;
  #graphBuilder;
  #graphValidator;
  #partRepository;
  #descriptionComposer;
  #constraintValidator;
  #blueprintProcessor;
  #anatomyCache;
  #entityManager;
  
  constructor({
    logger,
    eventBus,
    cache,
    circuitBreaker,
    socketIndex,
    graphBuilder,
    graphValidator,
    partRepository,
    descriptionComposer,
    constraintValidator,
    blueprintProcessor,
    anatomyCache,
    entityManager
  }) {
    super({ logger, eventBus, cache, circuitBreaker });
    
    // Validate dependencies
    this.#validateDependencies({
      socketIndex,
      graphBuilder,
      graphValidator,
      partRepository,
      descriptionComposer,
      constraintValidator,
      blueprintProcessor,
      anatomyCache,
      entityManager
    });
    
    // Assign services
    this.#socketIndex = socketIndex;
    this.#graphBuilder = graphBuilder;
    // ... assign other services
  }
  
  // Query Operations
  async getBodyParts(entityId, options = {}) {
    const { 
      includeMetadata = false,
      filterByType = null,
      includeHidden = false,
      sortBy = 'hierarchy' // 'hierarchy' | 'alphabetical' | 'type'
    } = options;
    
    return await this.executeWithResilience(
      async () => {
        const cacheKey = `anatomy:${entityId}:parts:${JSON.stringify(options)}`;
        
        return await this.cacheableOperation(cacheKey, async () => {
          const anatomy = await this.#getEntityAnatomy(entityId);
          let parts = anatomy.parts || [];
          
          // Apply filters
          if (filterByType) {
            parts = parts.filter(p => p.type === filterByType);
          }
          
          if (!includeHidden) {
            parts = parts.filter(p => !p.hidden);
          }
          
          // Sort results
          parts = this.#sortParts(parts, sortBy);
          
          // Add metadata if requested
          if (includeMetadata) {
            parts = await this.#enrichPartsWithMetadata(parts);
          }
          
          return parts;
        });
      },
      []
    );
  }
  
  async getBodyGraph(entityId) {
    return await this.executeWithResilience(
      async () => {
        const cacheKey = `anatomy:${entityId}:graph`;
        
        return await this.cacheableOperation(cacheKey, async () => {
          const anatomy = await this.#getEntityAnatomy(entityId);
          
          if (!anatomy.graph) {
            // Build graph if not exists
            const graph = await this.#graphBuilder.buildFromParts(
              anatomy.parts || []
            );
            
            // Validate graph
            const validation = await this.#graphValidator.validate(graph);
            if (!validation.valid) {
              throw new GraphValidationError(
                'Invalid anatomy graph',
                'GRAPH_INVALID',
                { entityId, errors: validation.errors }
              );
            }
            
            // Cache and return
            await this.#updateAnatomyGraph(entityId, graph);
            return graph;
          }
          
          return anatomy.graph;
        });
      },
      { nodes: [], edges: [] }
    );
  }
  
  // Modification Operations
  async attachPart(entityId, partId, parentPartId, options = {}) {
    const {
      validateConstraints = true,
      updateDescriptions = true,
      transaction = null
    } = options;
    
    return await this.executeWithResilience(
      async () => {
        const txn = transaction || await this.#beginTransaction(entityId);
        
        try {
          // Validation phase
          if (validateConstraints) {
            const constraints = await this.#constraintValidator.validate({
              entityId,
              partId,
              parentPartId,
              operation: 'attach'
            });
            
            if (!constraints.valid) {
              throw new ConstraintViolationError(
                `Cannot attach part ${partId} to ${parentPartId}`,
                'CONSTRAINT_VIOLATION',
                { violations: constraints.violations }
              );
            }
          }
          
          // Get current anatomy
          const anatomy = await this.#getEntityAnatomy(entityId);
          const part = await this.#partRepository.getPart(partId);
          const parentPart = await this.#findPart(anatomy, parentPartId);
          
          if (!parentPart) {
            throw new PartNotFoundError(
              `Parent part ${parentPartId} not found`,
              'PARENT_NOT_FOUND'
            );
          }
          
          // Check socket availability
          const socketAvailable = await this.#socketIndex.isSocketAvailable(
            parentPart,
            part.socketType
          );
          
          if (!socketAvailable) {
            throw new SocketUnavailableError(
              `No available socket of type ${part.socketType}`,
              'SOCKET_UNAVAILABLE'
            );
          }
          
          // Perform attachment
          const updatedAnatomy = await this.#performAttachment(
            anatomy,
            part,
            parentPart,
            txn
          );
          
          // Update graph
          const updatedGraph = await this.#graphBuilder.addNode(
            anatomy.graph,
            part,
            parentPartId
          );
          
          // Validate updated graph
          const validation = await this.#graphValidator.validate(updatedGraph);
          if (!validation.valid) {
            throw new GraphValidationError(
              'Graph validation failed after attachment',
              'GRAPH_INVALID_POST_ATTACH'
            );
          }
          
          // Update descriptions if requested
          if (updateDescriptions) {
            await this.#regenerateDescriptions(entityId, updatedAnatomy);
          }
          
          // Commit transaction
          if (!transaction) {
            await txn.commit();
          }
          
          // Invalidate caches
          this.#invalidateAnatomyCaches(entityId);
          
          // Dispatch event
          this.dispatchEvent('ANATOMY_PART_ATTACHED', {
            entityId,
            partId,
            parentPartId
          });
          
          return {
            success: true,
            anatomy: updatedAnatomy,
            graph: updatedGraph
          };
        } catch (error) {
          if (!transaction) {
            await txn.rollback();
          }
          throw error;
        }
      },
      null
    );
  }
  
  // Graph Operations
  async buildBodyGraph(entityId, blueprint) {
    return await this.executeWithResilience(
      async () => {
        // Process blueprint
        const processedBlueprint = await this.#blueprintProcessor.process(
          blueprint
        );
        
        // Validate blueprint
        const blueprintValidation = await this.#blueprintProcessor.validate(
          processedBlueprint
        );
        
        if (!blueprintValidation.valid) {
          throw new BlueprintValidationError(
            'Invalid anatomy blueprint',
            'BLUEPRINT_INVALID',
            { errors: blueprintValidation.errors }
          );
        }
        
        // Build graph from blueprint
        const graph = await this.#graphBuilder.buildFromBlueprint(
          processedBlueprint
        );
        
        // Validate constructed graph
        const graphValidation = await this.#graphValidator.validate(graph);
        if (!graphValidation.valid) {
          throw new GraphConstructionError(
            'Failed to construct valid graph from blueprint',
            'GRAPH_CONSTRUCTION_FAILED'
          );
        }
        
        // Create parts from blueprint
        const parts = await this.#createPartsFromBlueprint(
          processedBlueprint
        );
        
        // Save anatomy
        await this.#saveEntityAnatomy(entityId, {
          parts,
          graph,
          blueprint: processedBlueprint,
          metadata: {
            createdAt: Date.now(),
            version: '1.0.0'
          }
        });
        
        // Generate initial descriptions
        await this.#generateInitialDescriptions(entityId, parts);
        
        // Dispatch event
        this.dispatchEvent('ANATOMY_GRAPH_BUILT', {
          entityId,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length
        });
        
        return {
          success: true,
          graph,
          parts,
          stats: {
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
            maxDepth: this.#calculateGraphDepth(graph)
          }
        };
      },
      null
    );
  }
  
  // Description Operations
  async generateDescription(entityId, options = {}) {
    const {
      level = 'summary', // 'summary' | 'detailed' | 'complete'
      focus = null, // specific part or aspect to focus on
      includeHidden = false,
      format = 'text' // 'text' | 'structured' | 'markdown'
    } = options;
    
    return await this.executeWithResilience(
      async () => {
        const cacheKey = `anatomy:${entityId}:desc:${level}:${focus}:${format}`;
        
        return await this.cacheableOperation(cacheKey, async () => {
          const anatomy = await this.#getEntityAnatomy(entityId);
          const graph = await this.getBodyGraph(entityId);
          
          // Compose description
          const description = await this.#descriptionComposer.compose({
            anatomy,
            graph,
            level,
            focus,
            includeHidden
          });
          
          // Format output
          return this.#formatDescription(description, format);
        });
      },
      ''
    );
  }
  
  // Bulk Operations
  async attachMultipleParts(entityId, parts) {
    const txn = await this.#beginTransaction(entityId);
    const results = { success: [], failed: [] };
    
    try {
      // Sort parts by dependency order
      const sortedParts = await this.#sortByDependencyOrder(parts);
      
      for (const { partId, parentPartId, options } of sortedParts) {
        try {
          const result = await this.attachPart(
            entityId,
            partId,
            parentPartId,
            { ...options, transaction: txn }
          );
          results.success.push({ partId, parentPartId, result });
        } catch (error) {
          results.failed.push({
            partId,
            parentPartId,
            error: error.message
          });
          
          if (!options?.continueOnError) {
            throw error;
          }
        }
      }
      
      await txn.commit();
      
      // Regenerate descriptions once after all attachments
      await this.#regenerateDescriptions(entityId);
      
      return results;
    } catch (error) {
      await txn.rollback();
      throw error;
    }
  }
  
  // Private helper methods
  async #getEntityAnatomy(entityId) {
    const entity = await this.#entityManager.getEntity(entityId);
    return entity.components?.anatomy?.data || {};
  }
  
  #invalidateAnatomyCaches(entityId) {
    const patterns = [
      `anatomy:${entityId}:*`,
      `description:${entityId}:*`
    ];
    patterns.forEach(pattern => this.cache.invalidate(pattern));
  }
  
  async #sortByDependencyOrder(parts) {
    // Topological sort based on parent-child relationships
    const graph = new Map();
    const inDegree = new Map();
    
    // Build dependency graph
    for (const part of parts) {
      if (!graph.has(part.parentPartId)) {
        graph.set(part.parentPartId, []);
      }
      graph.get(part.parentPartId).push(part);
      
      inDegree.set(
        part.partId,
        (inDegree.get(part.partId) || 0) + 1
      );
    }
    
    // Perform topological sort
    const sorted = [];
    const queue = parts.filter(p => !inDegree.has(p.partId));
    
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      
      const children = graph.get(current.partId) || [];
      for (const child of children) {
        const degree = inDegree.get(child.partId) - 1;
        if (degree === 0) {
          queue.push(child);
        }
        inDegree.set(child.partId, degree);
      }
    }
    
    return sorted;
  }
}

export default AnatomySystemFacade;
```

## Implementation Steps

1. **Implement Core Facade** (Day 1-2)
   - Create AnatomySystemFacade class
   - Implement query operations
   - Add graph caching

2. **Add Modification Operations** (Day 3-4)
   - Implement attach/detach methods
   - Add constraint validation
   - Create socket management

3. **Implement Graph Operations** (Day 5-6)
   - Add blueprint processing
   - Implement graph building
   - Add validation pipeline

4. **Add Description Generation** (Day 7)
   - Integrate description composer
   - Add formatting options
   - Implement caching

5. **Create Bulk Operations** (Day 8)
   - Implement dependency sorting
   - Add batch processing
   - Handle partial failures

## File Changes

### New Files
- `src/anatomy/facades/AnatomySystemFacade.js`
- `src/anatomy/facades/AnatomyFacadeFactory.js`
- `src/anatomy/facades/helpers/DependencySorter.js`
- `src/anatomy/facades/helpers/DescriptionFormatter.js`

### Modified Files
- `src/dependencyInjection/registrations/anatomyRegistrations.js` - Register facade
- `src/dependencyInjection/tokens/tokens-anatomy.js` - Add facade token

### Test Files
- `tests/unit/anatomy/facades/AnatomySystemFacade.test.js`
- `tests/integration/anatomy/facades/anatomyFacade.integration.test.js`
- `tests/performance/anatomy/facades/facadePerformance.test.js`

## Dependencies
- **Prerequisites**: 
  - ANACLOENH-001 (Unified Cache)
  - ANACLOENH-002 (Base Facade)
  - ANACLOENH-004 (Error Handling)
- **Internal**: All anatomy services, EntityManager

## Acceptance Criteria
1. ✅ All facade methods implemented
2. ✅ Graph operations validated correctly
3. ✅ Description generation cached effectively
4. ✅ Constraint validation enforced
5. ✅ Bulk operations handle dependencies
6. ✅ Performance overhead <5%
7. ✅ Error messages are helpful
8. ✅ 95% test coverage

## Testing Requirements

### Unit Tests
- Test all facade methods
- Verify graph validation
- Test dependency sorting
- Validate error scenarios

### Integration Tests
- Test with real anatomy data
- Verify blueprint processing
- Test description generation
- Validate bulk operations

### Performance Tests
- Measure facade overhead
- Test graph operation speed
- Benchmark description caching

## Risk Assessment

### Risks
1. **Graph complexity**: Graph operations are computationally expensive
2. **Validation overhead**: Multiple validation layers
3. **Memory usage**: Large graphs consume memory

### Mitigation
1. Implement graph operation caching
2. Parallelize validation where possible
3. Use streaming for large graphs

## Estimated Effort
- **Development**: 7-8 days
- **Testing**: 3 days
- **Integration**: 1 day
- **Total**: 11-12 days

## Success Metrics
- 70% reduction in direct service usage
- 40% improvement in graph operation speed
- 50% reduction in anatomy-related bugs
- 100% of new features use facade

## Notes
- Consider implementing graph visualization helpers
- Add graph diff capabilities for debugging
- Create anatomy template system
- Consider WebGL integration for 3D visualization