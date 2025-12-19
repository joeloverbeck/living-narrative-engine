import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';

// Mock the fs module for testing
jest.mock('fs/promises');

/**
 * @file Tests for ModReferenceExtractor prerequisites handling
 *
 * These tests verify that condition_ref references in action file prerequisites
 * are correctly extracted as mod dependencies.
 *
 * Bug context: The validator was reporting 'anatomy' as unused for mods like
 * 'companionship' even though actions like follow.action.json have
 * prerequisites referencing 'anatomy:actor-can-move'.
 */
describe('ModReferenceExtractor - Prerequisites Handling', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);

    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Action files with prerequisites', () => {
    it('should extract condition_ref from single prerequisite', async () => {
      const testPath = '/test/mod/path';
      const actionWithPrerequisite = {
        id: 'test:action',
        prerequisites: [
          {
            logic: {
              condition_ref: 'anatomy:actor-can-move',
            },
            failure_message: 'You cannot move.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(actionWithPrerequisite));

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('anatomy')).toBe(true);
      expect(result.get('anatomy')).toContain('actor-can-move');
    });

    it('should extract condition_ref from multiple prerequisites referencing different mods', async () => {
      const testPath = '/test/mod/path';
      const actionWithMultiplePrerequisites = {
        id: 'companionship:follow',
        prerequisites: [
          {
            logic: {
              condition_ref: 'anatomy:actor-can-move',
            },
            failure_message: 'You cannot move without functioning legs.',
          },
          {
            logic: {
              not: {
                condition_ref: 'companionship:actor-is-following',
              },
            },
            failure_message: 'You cannot follow that target right now.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'follow.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(
        JSON.stringify(actionWithMultiplePrerequisites)
      );

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      // Should find anatomy reference
      expect(result.has('anatomy')).toBe(true);
      expect(result.get('anatomy')).toContain('actor-can-move');
      // Should also find companionship reference (nested in 'not')
      expect(result.has('companionship')).toBe(true);
      expect(result.get('companionship')).toContain('actor-is-following');
    });

    it('should handle nested JSON Logic operators in prerequisites', async () => {
      const testPath = '/test/mod/path';
      const actionWithNestedLogic = {
        id: 'test:complex-action',
        prerequisites: [
          {
            logic: {
              and: [
                { condition_ref: 'positioning:is-standing' },
                {
                  not: {
                    condition_ref: 'bending:is-bent-over',
                  },
                },
              ],
            },
            failure_message: 'Complex condition not met.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'complex.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(actionWithNestedLogic));

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('positioning')).toBe(true);
      expect(result.get('positioning')).toContain('is-standing');
      expect(result.has('bending')).toBe(true);
      expect(result.get('bending')).toContain('is-bent-over');
    });

    it('should handle action files with no prerequisites (regression test)', async () => {
      const testPath = '/test/mod/path';
      const actionWithoutPrerequisites = {
        id: 'test:simple-action',
        forbidden_components: {
          actor: ['other-mod:some-component'],
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'simple.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(
        JSON.stringify(actionWithoutPrerequisites)
      );

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      // Should extract references from forbidden_components (existing behavior)
      expect(result.has('other-mod')).toBe(true);
      // Critically: no errors should occur from missing prerequisites
    });

    it('should handle empty prerequisites array', async () => {
      const testPath = '/test/mod/path';
      const actionWithEmptyPrerequisites = {
        id: 'test:action',
        prerequisites: [],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'empty.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(
        JSON.stringify(actionWithEmptyPrerequisites)
      );

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      // No errors, just no references extracted
      expect(result.size).toBe(0);
    });

    it('should handle prerequisite with malformed logic object', async () => {
      const testPath = '/test/mod/path';
      const actionWithMalformedPrerequisite = {
        id: 'test:action',
        prerequisites: [
          {
            logic: null,
            failure_message: 'Malformed prerequisite.',
          },
          {
            // Missing logic entirely
            failure_message: 'Another malformed prerequisite.',
          },
          {
            logic: {
              condition_ref: 'valid:reference',
            },
            failure_message: 'Valid prerequisite.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'malformed.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(
        JSON.stringify(actionWithMalformedPrerequisite)
      );

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      // Should still extract the valid reference
      expect(result.has('valid')).toBe(true);
      expect(result.get('valid')).toContain('reference');
    });

    it("should handle prerequisite with 'or' JSON Logic operator", async () => {
      const testPath = '/test/mod/path';
      const actionWithOrLogic = {
        id: 'test:action',
        prerequisites: [
          {
            logic: {
              or: [
                { condition_ref: 'mod-a:condition-one' },
                { condition_ref: 'mod-b:condition-two' },
              ],
            },
            failure_message: 'Either condition must be met.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'or-logic.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(actionWithOrLogic));

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('mod-a')).toBe(true);
      expect(result.get('mod-a')).toContain('condition-one');
      expect(result.has('mod-b')).toBe(true);
      expect(result.get('mod-b')).toContain('condition-two');
    });
  });

  describe('Real-world follow.action.json structure', () => {
    it('should extract anatomy reference from follow action prerequisites (actual bug scenario)', async () => {
      const testPath = '/test/mod/companionship';
      // This mirrors the actual structure from follow.action.json
      const followAction = {
        id: 'companionship:follow',
        name: 'Follow',
        description:
          'Commands your character to follow the specified target, becoming their companion and moving with them.',
        targets: {
          primary: {
            scope: 'companionship:potential_leaders',
            placeholder: 'target',
            description: 'The leader to follow',
          },
        },
        required_components: {},
        forbidden_components: {
          actor: ['bending-states:bending_over'],
        },
        template: 'follow {target}',
        prerequisites: [
          {
            logic: {
              condition_ref: 'anatomy:actor-can-move',
            },
            failure_message: 'You cannot move without functioning legs.',
          },
          {
            logic: {
              not: {
                condition_ref: 'companionship:actor-is-following',
              },
            },
            failure_message: 'You cannot follow that target right now.',
          },
          {
            logic: {
              isActorLocationLit: ['actor'],
            },
            failure_message: 'It is too dark to follow anyone.',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'follow.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(followAction));

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);

      // The key assertion: anatomy should be detected as a dependency
      // This is THE BUG we're fixing - anatomy was NOT being detected before
      expect(result.has('anatomy')).toBe(true);
      expect(result.get('anatomy')).toContain('actor-can-move');

      // Note: The nested 'not' operator with 'companionship:actor-is-following'
      // is tested in the dedicated nested JSON Logic test above.
      // The target scope extraction is tested elsewhere in the existing test suite.
    });
  });
});
