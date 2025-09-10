# CHACOMENH-008: Create Unit Tests for Character Data Formatting

**Phase**: Testing  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: CHACOMENH-005 (formatting implementation)  
**Estimated Time**: 3-4 hours

## Summary

Create comprehensive unit tests for the CharacterDataFormatter service to verify that the three new psychological component formatting methods work correctly and integrate properly into the character persona generation.

## Background

The CharacterDataFormatter is responsible for converting raw character data into markdown-formatted text for LLM prompts. Testing ensures proper formatting, graceful handling of edge cases, and correct integration into the overall persona structure.

## Technical Requirements

### Files to Create/Modify

1. **tests/unit/prompting/CharacterDataFormatter.test.js**
   - Add test suites for new formatting methods
   - Test integration with formatCharacterPersona
   - Verify markdown output structure

### Testing Approach

- Test each formatting method in isolation
- Test integration with full persona formatting
- Verify markdown structure and spacing
- Test edge cases and error conditions

## Test Implementation

### 1. Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CharacterDataFormatter from '../../../src/prompting/CharacterDataFormatter.js';

describe('CharacterDataFormatter - Psychological Components', () => {
  let testBed;
  let formatter;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    formatter = new CharacterDataFormatter({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('formatMotivationsSection', () => {
    // Motivations tests
  });

  describe('formatInternalTensionsSection', () => {
    // Internal tensions tests
  });

  describe('formatCoreDilemmasSection', () => {
    // Core dilemmas tests
  });

  describe('formatCharacterPersona integration', () => {
    // Integration tests
  });
});
```

### 2. Test formatMotivationsSection

```javascript
describe('formatMotivationsSection', () => {
  it('should format valid motivations text with proper markdown', () => {
    // Arrange
    const motivationsText =
      'I seek power because I fear being powerless again.';

    // Act
    const result = formatter.formatMotivationsSection(motivationsText);

    // Assert
    expect(result).toBe(
      '## Your Core Motivations\nI seek power because I fear being powerless again.\n'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: Formatted motivations section',
      expect.objectContaining({ textLength: 49 })
    );
  });

  it('should return empty string for null input', () => {
    // Act
    const result = formatter.formatMotivationsSection(null);

    // Assert
    expect(result).toBe('');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: No motivations text provided'
    );
  });

  it('should return empty string for undefined input', () => {
    // Act
    const result = formatter.formatMotivationsSection(undefined);

    // Assert
    expect(result).toBe('');
  });

  it('should return empty string for empty string input', () => {
    // Act
    const result = formatter.formatMotivationsSection('');

    // Assert
    expect(result).toBe('');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: No motivations text provided'
    );
  });

  it('should handle whitespace-only input', () => {
    // Act
    const result = formatter.formatMotivationsSection('   \n\t   ');

    // Assert
    expect(result).toBe('');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: Empty motivations text after trimming'
    );
  });

  it('should preserve internal formatting and special characters', () => {
    // Arrange
    const complexText = `I have **multiple** reasons:
- First, I need to prove myself
- Second, I can't let them win
- Third, it's _who I am_`;

    // Act
    const result = formatter.formatMotivationsSection(complexText);

    // Assert
    expect(result).toContain('**multiple**');
    expect(result).toContain('- First');
    expect(result).toContain('_who I am_');
  });

  it('should handle very long text', () => {
    // Arrange
    const longText = 'A'.repeat(1000);

    // Act
    const result = formatter.formatMotivationsSection(longText);

    // Assert
    expect(result).toContain('A'.repeat(1000));
    expect(result.length).toBeGreaterThan(1000);
  });
});
```

### 3. Test formatInternalTensionsSection

```javascript
describe('formatInternalTensionsSection', () => {
  it('should format valid tensions text with proper markdown', () => {
    // Arrange
    const tensionsText = 'I want revenge but also want to forgive.';

    // Act
    const result = formatter.formatInternalTensionsSection(tensionsText);

    // Assert
    expect(result).toBe(
      '## Your Internal Tensions\nI want revenge but also want to forgive.\n'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: Formatted internal tensions section',
      expect.objectContaining({ textLength: 41 })
    );
  });

  it('should handle complex emotional conflicts', () => {
    // Arrange
    const complexTensions = `I crave independence, yet I fear being alone.
I want to trust, but betrayal has taught me otherwise.
I seek peace while being drawn to conflict.`;

    // Act
    const result = formatter.formatInternalTensionsSection(complexTensions);

    // Assert
    expect(result).toContain('I crave independence');
    expect(result).toContain('I want to trust');
    expect(result).toContain('I seek peace');
    expect(result.split('\n').length).toBeGreaterThan(3);
  });

  it('should return empty string for non-string input', () => {
    // Act
    const resultNumber = formatter.formatInternalTensionsSection(123);
    const resultObject = formatter.formatInternalTensionsSection({});
    const resultArray = formatter.formatInternalTensionsSection([]);

    // Assert
    expect(resultNumber).toBe('');
    expect(resultObject).toBe('');
    expect(resultArray).toBe('');
  });
});
```

### 4. Test formatCoreDilemmasSection

```javascript
describe('formatCoreDilemmasSection', () => {
  it('should format valid dilemmas text with proper markdown', () => {
    // Arrange
    const dilemmasText = 'Can I achieve justice without becoming a monster?';

    // Act
    const result = formatter.formatCoreDilemmasSection(dilemmasText);

    // Assert
    expect(result).toBe(
      '## Your Core Dilemmas\nCan I achieve justice without becoming a monster?\n'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CharacterDataFormatter: Formatted core dilemmas section',
      expect.objectContaining({ textLength: 50 })
    );
  });

  it('should handle multiple questions', () => {
    // Arrange
    const multipleQuestions = `Is loyalty to friends more important than loyalty to principles?
Can I be true to myself while meeting others' expectations?
Does redemption require forgetting the past or embracing it?`;

    // Act
    const result = formatter.formatCoreDilemmasSection(multipleQuestions);

    // Assert
    expect(result).toContain('Is loyalty to friends');
    expect(result).toContain('Can I be true to myself');
    expect(result).toContain('Does redemption require');
    expect((result.match(/\?/g) || []).length).toBe(3);
  });

  it('should preserve question marks and formatting', () => {
    // Arrange
    const formattedQuestions =
      "What if I'm wrong? What if **everything** I believe is a lie?";

    // Act
    const result = formatter.formatCoreDilemmasSection(formattedQuestions);

    // Assert
    expect(result).toContain('?');
    expect(result).toContain('**everything**');
  });
});
```

### 5. Test formatCharacterPersona Integration

```javascript
describe('formatCharacterPersona integration', () => {
  it('should include all psychological components in correct order', () => {
    // Arrange
    const characterData = {
      name: 'Complex Character',
      description: 'A troubled soul',
      personality: 'Conflicted and deep',
      profile: 'A long history of struggles',
      motivations: 'I seek meaning in chaos',
      internalTensions: 'I want peace but create conflict',
      coreDilemmas: 'Can one person change the world?',
      likes: 'Solitude',
      dislikes: 'Crowds',
    };

    // Act
    const result = formatter.formatCharacterPersona(characterData);

    // Assert
    const sections = result.split('##');
    const sectionTitles = sections.map((s) => s.split('\n')[0].trim());

    expect(sectionTitles).toContain('Your Profile');
    expect(sectionTitles).toContain('Your Core Motivations');
    expect(sectionTitles).toContain('Your Internal Tensions');
    expect(sectionTitles).toContain('Your Core Dilemmas');
    expect(sectionTitles).toContain('Your Likes');

    // Verify order
    const profileIndex = sectionTitles.indexOf('Your Profile');
    const motivationsIndex = sectionTitles.indexOf('Your Core Motivations');
    const likesIndex = sectionTitles.indexOf('Your Likes');

    expect(motivationsIndex).toBeGreaterThan(profileIndex);
    expect(likesIndex).toBeGreaterThan(motivationsIndex);
  });

  it('should handle missing psychological components gracefully', () => {
    // Arrange
    const characterData = {
      name: 'Simple Character',
      description: 'Basic description',
      personality: 'Simple personality',
      // No psychological components
    };

    // Act
    const result = formatter.formatCharacterPersona(characterData);

    // Assert
    expect(result).toContain('YOU ARE Simple Character');
    expect(result).toContain('## Your Description');
    expect(result).toContain('## Your Personality');
    expect(result).not.toContain('## Your Core Motivations');
    expect(result).not.toContain('## Your Internal Tensions');
    expect(result).not.toContain('## Your Core Dilemmas');
  });

  it('should include only present psychological components', () => {
    // Arrange
    const characterData = {
      name: 'Partial Character',
      motivations: 'I must find my purpose',
      // No internal tensions
      coreDilemmas: 'What is my purpose?',
    };

    // Act
    const result = formatter.formatCharacterPersona(characterData);

    // Assert
    expect(result).toContain('## Your Core Motivations');
    expect(result).toContain('I must find my purpose');
    expect(result).not.toContain('## Your Internal Tensions');
    expect(result).toContain('## Your Core Dilemmas');
    expect(result).toContain('What is my purpose?');
  });

  it('should maintain proper spacing between sections', () => {
    // Arrange
    const characterData = {
      name: 'Test Character',
      profile: 'Background',
      motivations: 'My motivations',
      internalTensions: 'My tensions',
      coreDilemmas: 'My questions?',
      likes: 'Things I like',
    };

    // Act
    const result = formatter.formatCharacterPersona(characterData);

    // Assert
    // Check for single newline between sections
    expect(result).toMatch(/## Your Profile\n.*\n\n## Your Core Motivations/s);
    expect(result).toMatch(
      /## Your Core Motivations\n.*\n\n## Your Internal Tensions/s
    );
    expect(result).toMatch(
      /## Your Internal Tensions\n.*\n\n## Your Core Dilemmas/s
    );
    expect(result).toMatch(/## Your Core Dilemmas\n.*\n\n## Your Likes/s);
  });
});
```

### 6. Edge Cases and Error Handling

```javascript
describe('edge cases and error handling', () => {
  it('should not throw on any input type', () => {
    // Arrange
    const inputs = [
      null,
      undefined,
      '',
      123,
      true,
      false,
      {},
      [],
      () => {},
      Symbol('test'),
    ];

    // Act & Assert
    inputs.forEach((input) => {
      expect(() => formatter.formatMotivationsSection(input)).not.toThrow();
      expect(() =>
        formatter.formatInternalTensionsSection(input)
      ).not.toThrow();
      expect(() => formatter.formatCoreDilemmasSection(input)).not.toThrow();
    });
  });

  it('should handle special markdown characters', () => {
    // Arrange
    const specialText =
      '# Not a header\n* Not a list\n> Not a quote\n`Not code`';

    // Act
    const result = formatter.formatMotivationsSection(specialText);

    // Assert
    expect(result).toContain('# Not a header');
    expect(result).toContain('* Not a list');
    expect(result).toContain('> Not a quote');
    expect(result).toContain('`Not code`');
  });

  it('should handle unicode and emoji', () => {
    // Arrange
    const unicodeText = "I feel 😊 but also 😢. C'est la vie! 你好";

    // Act
    const result = formatter.formatMotivationsSection(unicodeText);

    // Assert
    expect(result).toContain('😊');
    expect(result).toContain('😢');
    expect(result).toContain("C'est la vie");
    expect(result).toContain('你好');
  });
});
```

### 7. Performance Tests

```javascript
describe('performance', () => {
  it('should format large personas efficiently', () => {
    // Arrange
    const largeData = {
      name: 'Performance Test',
      description: 'A'.repeat(1000),
      personality: 'B'.repeat(1000),
      profile: 'C'.repeat(1000),
      motivations: 'D'.repeat(1000),
      internalTensions: 'E'.repeat(1000),
      coreDilemmas: 'F?'.repeat(500),
      likes: 'G'.repeat(1000),
      dislikes: 'H'.repeat(1000),
    };

    // Act
    const startTime = performance.now();
    const result = formatter.formatCharacterPersona(largeData);
    const endTime = performance.now();

    // Assert
    expect(endTime - startTime).toBeLessThan(50); // Should complete quickly
    expect(result.length).toBeGreaterThan(7000);
  });
});
```

## Test Coverage Requirements

### Coverage Targets

- Branch coverage: ≥ 80%
- Function coverage: ≥ 90%
- Line coverage: ≥ 90%

### Critical Paths

1. Valid input with content
2. Null/undefined inputs
3. Empty string inputs
4. Whitespace-only inputs
5. Integration with full persona
6. Section ordering
7. Markdown preservation

## Acceptance Criteria

- [ ] All formatting methods have dedicated test suites
- [ ] Each method tested with valid and invalid inputs
- [ ] Integration tests verify section ordering
- [ ] Edge cases and error conditions covered
- [ ] Performance benchmarks met
- [ ] Code coverage targets achieved
- [ ] Tests follow project patterns
- [ ] Clear, descriptive test names
- [ ] No test interdependencies
- [ ] Mock logger used appropriately

## Running the Tests

```bash
# Run specific test file
npm run test:unit tests/unit/prompting/CharacterDataFormatter.test.js

# Run with coverage
npm run test:unit -- --coverage tests/unit/prompting/CharacterDataFormatter.test.js

# Run in watch mode
npm run test:unit -- --watch tests/unit/prompting/CharacterDataFormatter.test.js

# Run all prompting tests
npm run test:unit tests/unit/prompting/
```

## Debugging Tips

### Console Output

```javascript
// Temporarily add to see formatted output
console.log('Formatted result:\n', result);
console.log('Section count:', result.split('##').length);
```

### Focused Testing

```javascript
// Use during development
it.only('specific test to debug', () => {
  // Test implementation
});
```

## Notes

- Markdown formatting is critical for LLM understanding
- Section order affects prompt coherence
- Graceful handling prevents runtime errors
- Performance matters for real-time generation
- Tests should be readable as documentation

---

_Ticket created from character-components-analysis.md report_
