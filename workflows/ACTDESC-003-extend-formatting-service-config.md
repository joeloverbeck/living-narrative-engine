# ACTDESC-003: Extend AnatomyFormattingService Configuration

## Status
🟡 **Pending**

## Phase
**Phase 1: Foundation** (Week 1)

## Description
Add activity-specific configuration to `AnatomyFormattingService` to control how activity descriptions are formatted and integrated into the body description pipeline.

## Background
Following the Equipment service pattern, the activity description system needs centralized configuration for formatting rules, prefixes/suffixes, and behavior settings. This allows configuration changes without modifying service code.

**Reference**: Design document lines 1733-1753 (Configuration Service Extension)

## Objectives
- Add `getActivityIntegrationConfig()` method to AnatomyFormattingService
- Define configuration structure for activity descriptions
- Support Phase 1, 2, and 3 features through config
- Maintain backward compatibility

## Technical Specification

### File to Modify
`src/services/anatomyFormattingService.js`

### New Method to Add
```javascript
/**
 * Get activity integration configuration.
 * Controls how activity descriptions are formatted and displayed.
 *
 * @returns {object} Activity configuration
 */
getActivityIntegrationConfig() {
  return {
    // Formatting
    prefix: 'Activity: ',
    suffix: '',
    separator: '. ',

    // Name resolution (Phase 2)
    nameResolution: {
      usePronounsWhenAvailable: false,  // Enable in Phase 2
      fallbackToNames: true
    },

    // Priority filtering (Phase 2)
    maxActivities: 10,
    respectPriorityTiers: true,  // Enable in Phase 3

    // Performance (Phase 3)
    enableCaching: false,  // Enable in Phase 3
    cacheTimeout: 5000  // 5 seconds
  };
}
```

### Configuration Properties

| Property | Type | Default | Phase | Description |
|----------|------|---------|-------|-------------|
| `prefix` | string | `"Activity: "` | 1 | Text before activity description |
| `suffix` | string | `""` | 1 | Text after activity description |
| `separator` | string | `". "` | 1 | Separator between multiple activities |
| `nameResolution.usePronounsWhenAvailable` | boolean | `false` | 2 | Use pronouns (him/her/them) when possible |
| `nameResolution.fallbackToNames` | boolean | `true` | 2 | Use entity names if pronouns unavailable |
| `maxActivities` | integer | `10` | 2 | Maximum activities to show |
| `respectPriorityTiers` | boolean | `true` | 3 | Use tier-based priority filtering |
| `enableCaching` | boolean | `false` | 3 | Enable description caching |
| `cacheTimeout` | integer | `5000` | 3 | Cache timeout in milliseconds |

## Acceptance Criteria
- [ ] Method added to AnatomyFormattingService
- [ ] Configuration object matches specification
- [ ] All properties have appropriate defaults
- [ ] JSDoc documentation complete
- [ ] Method is accessible to ActivityDescriptionService
- [ ] Phase 1 properties are functional
- [ ] Phase 2/3 properties are defined but inactive (flags set to false)

## Dependencies
- None (can be done independently)

## Testing Requirements
- Unit test verifies method returns correct config object
- Test that all required properties are present
- Test that defaults are appropriate for Phase 1
- Verify config can be retrieved by other services

## Implementation Notes
1. Follow the pattern used by `getEquipmentIntegrationConfig()` (if exists)
2. Start with Phase 1 defaults (simple, safe)
3. Add Phase 2/3 properties with disabled flags for future activation
4. Consider making configuration overridable through external config file (future enhancement)

## Code Example
```javascript
describe('AnatomyFormattingService', () => {
  it('should provide activity integration config', () => {
    const service = new AnatomyFormattingService({ /* deps */ });
    const config = service.getActivityIntegrationConfig();

    expect(config.prefix).toBe('Activity: ');
    expect(config.separator).toBe('. ');
    expect(config.maxActivities).toBe(10);
    expect(config.nameResolution.usePronounsWhenAvailable).toBe(false); // Phase 2
  });
});
```

## Reference Files
- Service to modify: `src/services/anatomyFormattingService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1733-1753)
- Similar pattern: `EquipmentDescriptionService` configuration

## Success Metrics
- Configuration method is callable
- All Phase 1 properties functional
- Phase 2/3 properties properly disabled
- Code is well-documented and testable

## Related Tickets
- **Blocks**: ACTDESC-005 (ActivityDescriptionService implementation)
- **Used By**: ACTDESC-008 (Basic phrase generation)
- **Used By**: ACTDESC-016 (Priority filtering)
- **Used By**: ACTDESC-017 (Pronoun resolution)
