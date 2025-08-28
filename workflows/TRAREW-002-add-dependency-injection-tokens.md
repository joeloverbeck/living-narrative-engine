# TRAREW-002: Add Dependency Injection Tokens

## Priority: 🚨 CRITICAL (URGENT)

**Phase**: 1 - Critical Runtime Fix  
**Story Points**: 1  
**Estimated Time**: 15-20 minutes

## Problem Statement

The TraitsRewriter services require proper dependency injection tokens to be registered and resolved within the application's DI container. The codebase uses a modular token system where character builder services are defined in `tokens-core.js`.

## Requirements

Add all required TraitsRewriter service tokens to the character builder section of the tokens-core.js file, following the established pattern for other character builder services.

## Acceptance Criteria

- [ ] **Token Location**: Tokens added to `/src/dependencyInjection/tokens/tokens-core.js`
- [ ] **Pattern Adherence**: Follows existing character builder token structure
- [ ] **Complete Set**: All 4 TraitsRewriter service tokens defined
- [ ] **Naming Convention**: Consistent with existing service naming patterns
- [ ] **Grouping**: Properly placed in character builder services section

## Implementation Details

### File to Modify
**Path**: `/src/dependencyInjection/tokens/tokens-core.js`

### Tokens to Add
Add after the existing `SpeechPatternsResponseProcessor` token:

```javascript
  SpeechPatternsResponseProcessor: 'SpeechPatternsResponseProcessor',
  // Traits Rewriter Services
  TraitsRewriterController: 'TraitsRewriterController',
  TraitsRewriterGenerator: 'TraitsRewriterGenerator', 
  TraitsRewriterResponseProcessor: 'TraitsRewriterResponseProcessor',
  TraitsRewriterDisplayEnhancer: 'TraitsRewriterDisplayEnhancer',
  CharacterDatabase: 'CharacterDatabase',
```

### Integration Point
The tokens should be added in the existing character builder services section, maintaining alphabetical grouping and consistent formatting.

## Dependencies

**Blocking**:
- None

**Required By**:
- TRAREW-003 (Service Registration)
- TRAREW-008 (Complete Controller Implementation)

## Testing Requirements

### Manual Verification
1. **Token Export**: Verify tokens are properly exported in consolidated `tokens` object
2. **Import Resolution**: Confirm tokens can be imported in other files
3. **DI Container**: Validate tokens work with dependency injection system

### Automated Testing
- No specific automated tests required for token definitions
- Integration testing covered in subsequent tickets

## Validation Steps

### Step 1: Verify Token Structure
```bash
# Check tokens file structure
grep -A 10 -B 2 "TraitsRewriter" src/dependencyInjection/tokens/tokens-core.js
```

### Step 2: Verify Token Export
```javascript
// Test in Node.js environment or browser console
import { tokens } from './src/dependencyInjection/tokens.js';
console.log('TraitsRewriter tokens:', {
  controller: tokens.TraitsRewriterController,
  generator: tokens.TraitsRewriterGenerator,
  processor: tokens.TraitsRewriterResponseProcessor,
  enhancer: tokens.TraitsRewriterDisplayEnhancer
});
```

### Step 3: Test Container Registration
Will be validated in TRAREW-003 when services are registered.

## Files Modified

### Modified Files
- `/src/dependencyInjection/tokens/tokens-core.js` - Add TraitsRewriter service tokens

### Files Not Modified
- Main `/src/dependencyInjection/tokens.js` - Automatically includes via import
- Service files - Will use these tokens in subsequent tickets

## Implementation

### Current Character Builder Services Section
```javascript
// Current structure in tokens-core.js
  ThematicDirectionGenerator: 'ThematicDirectionGenerator',
  ClicheGenerator: 'ClicheGenerator',
  ICoreMotivationsGenerator: 'ICoreMotivationsGenerator',
  CoreMotivationsGenerator: 'CoreMotivationsGenerator',
  CoreMotivationsDisplayEnhancer: 'CoreMotivationsDisplayEnhancer',
  TraitsGenerator: 'TraitsGenerator',
  TraitsDisplayEnhancer: 'TraitsDisplayEnhancer',
  SpeechPatternsGenerator: 'SpeechPatternsGenerator',
  SpeechPatternsDisplayEnhancer: 'SpeechPatternsDisplayEnhancer',
  SpeechPatternsResponseProcessor: 'SpeechPatternsResponseProcessor',
```

### After Modification
```javascript
  SpeechPatternsResponseProcessor: 'SpeechPatternsResponseProcessor',
  // Traits Rewriter Services
  TraitsRewriterController: 'TraitsRewriterController',
  TraitsRewriterGenerator: 'TraitsRewriterGenerator', 
  TraitsRewriterResponseProcessor: 'TraitsRewriterResponseProcessor',
  TraitsRewriterDisplayEnhancer: 'TraitsRewriterDisplayEnhancer',
  CharacterDatabase: 'CharacterDatabase',
```

## Success Metrics

- **Token Availability**: All 4 TraitsRewriter tokens accessible via `tokens` object
- **Naming Consistency**: Token names follow established character builder patterns
- **Import Success**: Tokens can be imported and used in service registration
- **No Breaking Changes**: Existing token structure remains intact

## Next Steps

After completion:
- **TRAREW-003**: Register TraitsRewriter services using these tokens
- **TRAREW-008**: Use tokens in controller implementation
- **TRAREW-005-007**: Use tokens in service implementations

## Notes

- The codebase uses a modular token system with separate files for different domains
- Character builder tokens are centralized in `tokens-core.js`
- Tokens are string constants that prevent typos in dependency injection
- The `freeze` utility is used to make the token object immutable

## Implementation Checklist

- [ ] Open `/src/dependencyInjection/tokens/tokens-core.js`
- [ ] Locate the character builder services section
- [ ] Find the `SpeechPatternsResponseProcessor` token
- [ ] Add the 4 TraitsRewriter service tokens after it
- [ ] Maintain consistent formatting and indentation
- [ ] Verify no syntax errors in the file
- [ ] Test token import resolution
- [ ] Confirm tokens are available in main tokens object