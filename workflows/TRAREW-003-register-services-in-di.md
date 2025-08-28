# TRAREW-003: Register TraitsRewriter Services in DI Container

## Priority: 🚨 CRITICAL (URGENT)

**Phase**: 1 - Critical Runtime Fix  
**Story Points**: 2  
**Estimated Time**: 30-40 minutes

## Problem Statement

The TraitsRewriter services need to be registered in the dependency injection container to be properly instantiated and resolved. The application uses a sophisticated factory-based registration system in `characterBuilderRegistrations.js` that must be extended to include the new services.

## Requirements

1. Add service imports for all TraitsRewriter components
2. Register service factories following established patterns  
3. Configure proper dependency resolution for each service
4. Ensure controller can be instantiated by the DI system

## Acceptance Criteria

- [ ] **Service Imports**: All TraitsRewriter service classes imported
- [ ] **Factory Registration**: All services registered with `registrar.singletonFactory`
- [ ] **Dependency Resolution**: Proper dependency injection configuration
- [ ] **Pattern Adherence**: Follows existing character builder service patterns
- [ ] **Logger Integration**: Appropriate debug logging for service registration
- [ ] **Controller Registration**: TraitsRewriterController properly registered with all dependencies

## Implementation Details

### File to Modify
**Path**: `/src/dependencyInjection/registrations/characterBuilderRegistrations.js`

### Service Imports to Add
Add to existing imports section:
```javascript
import { TraitsRewriterController } from '../../characterBuilder/controllers/TraitsRewriterController.js';
import { TraitsRewriterGenerator } from '../../characterBuilder/services/TraitsRewriterGenerator.js';
import { TraitsRewriterResponseProcessor } from '../../characterBuilder/services/TraitsRewriterResponseProcessor.js';
import { TraitsRewriterDisplayEnhancer } from '../../characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
```

### Service Registrations to Add
Add to `registerCharacterBuilderServices` function after SpeechPatternsDisplayEnhancer registration:

```javascript
  // Traits Rewriter Services
  registrar.singletonFactory(tokens.TraitsRewriterGenerator, (c) => {
    return new TraitsRewriterGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter),
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      tokenEstimator: c.resolve(tokens.ITokenEstimator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterGenerator}.`
  );

  registrar.singletonFactory(tokens.TraitsRewriterResponseProcessor, (c) => {
    return new TraitsRewriterResponseProcessor({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterResponseProcessor}.`
  );

  registrar.singletonFactory(tokens.TraitsRewriterDisplayEnhancer, (c) => {
    return new TraitsRewriterDisplayEnhancer({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterDisplayEnhancer}.`
  );

  registrar.singletonFactory(tokens.TraitsRewriterController, (c) => {
    return new TraitsRewriterController({
      logger: c.resolve(tokens.ILogger),
      characterBuilderService: c.resolve(tokens.CharacterBuilderService),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
      traitsRewriterGenerator: c.resolve(tokens.TraitsRewriterGenerator),
      traitsRewriterDisplayEnhancer: c.resolve(tokens.TraitsRewriterDisplayEnhancer),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.TraitsRewriterController}.`
  );
```

## Dependencies

**Blocking**:
- TRAREW-001 (Minimal Controller Stub) - Must exist for import
- TRAREW-002 (DI Tokens) - Required for service registration

**Required By**:
- TRAREW-004 (Verify Application Startup)
- TRAREW-008 (Complete Controller Implementation)

## Testing Requirements

### Manual Verification
1. **Import Resolution**: Verify all service imports resolve correctly
2. **Registration Success**: Confirm services register without errors
3. **Dependency Resolution**: Validate all dependencies can be resolved
4. **Controller Creation**: Test controller instantiation through DI

### Automated Testing
```javascript
// Basic DI container test
const container = createTestContainer();
const controller = container.resolve(tokens.TraitsRewriterController);
expect(controller).toBeDefined();
expect(controller.constructor.name).toBe('TraitsRewriterController');
```

## Validation Steps

### Step 1: Verify Service Registration
```bash
npm run build
# Check for registration errors in console
```

### Step 2: Test Dependency Resolution
```bash
npm run start
# Check application logs for successful service registration
```

### Step 3: Verify Controller Bootstrap
```bash
# Navigate to traits-rewriter.html
# Check browser console for successful controller instantiation
```

## Files Modified

### Modified Files
- `/src/dependencyInjection/registrations/characterBuilderRegistrations.js` - Add service registrations

### Service Dependencies Map

#### TraitsRewriterGenerator Dependencies
- `ILogger` - Core logging service
- `LlmJsonService` - JSON-safe LLM interaction
- `LLMAdapter` - ConfigurableLLMAdapter for content generation
- `ILLMConfigurationManager` - LLM configuration management
- `ISafeEventDispatcher` - Event system integration
- `ITokenEstimator` - Token usage estimation

#### TraitsRewriterResponseProcessor Dependencies  
- `ILogger` - Core logging service
- `LlmJsonService` - JSON parsing and validation
- `ISchemaValidator` - Response schema validation

#### TraitsRewriterDisplayEnhancer Dependencies
- `ILogger` - Core logging service (minimal dependencies)

#### TraitsRewriterController Dependencies
- `ILogger` - Core logging service (from base controller)
- `CharacterBuilderService` - Character management service
- `ISafeEventDispatcher` - Event system integration  
- `ISchemaValidator` - Input validation
- `TraitsRewriterGenerator` - Main generation service
- `TraitsRewriterDisplayEnhancer` - Display formatting service

## Success Metrics

- **Import Success**: All service imports resolve without errors
- **Registration Success**: All services register in DI container
- **Dependency Resolution**: All dependencies resolve correctly
- **Application Startup**: No DI-related errors on application start
- **Controller Bootstrap**: TraitsRewriterController can be instantiated

## Next Steps

After completion:
- **TRAREW-004**: Verify complete application startup functionality
- **TRAREW-005-007**: Implement full service functionality
- **TRAREW-008**: Complete controller implementation

## Notes

- Services will initially be stubs (except controller) until Phase 2 implementation
- Focus on proper DI registration patterns following existing character builder services
- The registration order matches dependency hierarchy (services before controller)
- Logger integration ensures proper debugging during development

## Implementation Checklist

- [ ] Add TraitsRewriter service imports to file header
- [ ] Locate `registerCharacterBuilderServices` function
- [ ] Add TraitsRewriterGenerator factory registration
- [ ] Add TraitsRewriterResponseProcessor factory registration  
- [ ] Add TraitsRewriterDisplayEnhancer factory registration
- [ ] Add TraitsRewriterController factory registration
- [ ] Include debug logging for each registration
- [ ] Test application build for import errors
- [ ] Verify service registration in application logs
- [ ] Test controller instantiation through bootstrap process

## Error Handling

### Potential Issues
1. **Import Errors**: Service files don't exist yet (except controller)
2. **Dependency Errors**: Missing required services in DI container
3. **Registration Errors**: Incorrect factory configuration

### Solutions  
1. Create placeholder service stubs if needed
2. Verify all dependency tokens are registered
3. Follow exact pattern from existing service registrations