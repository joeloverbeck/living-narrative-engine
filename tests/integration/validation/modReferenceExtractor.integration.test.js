/**
 * @file Integration tests for ModReferenceExtractor with real file system operations
 * These tests validate the extractor's behavior with actual files and directories
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModReferenceExtractor - Integration Tests', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;
  let testModPath;
  let tempDir;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);

    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator,
    });

    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mod-ref-extractor-test-')
    );
    testModPath = path.join(tempDir, 'integration_test_mod');
    await fs.mkdir(testModPath, { recursive: true });
  });

  afterEach(async () => {
    testBed.cleanup();

    // Clean up test files
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Real File System Operations', () => {
    it('should extract references from real mod files', async () => {
      // Create test mod structure
      const actionsDir = path.join(testModPath, 'actions');
      const componentsDir = path.join(testModPath, 'components');
      const rulesDir = path.join(testModPath, 'rules');

      await fs.mkdir(actionsDir, { recursive: true });
      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(rulesDir, { recursive: true });

      // Create test files with realistic content
      await fs.writeFile(
        path.join(actionsDir, 'kiss.action.json'),
        JSON.stringify(
          {
            id: 'integration_test_mod:kiss',
            name: 'Kiss',
            required_components: {
              actor: ['personal-space-states:closeness', 'affection:attraction'],
              target: ['core:actor'],
            },
            forbidden_components: {
              actor: ['violence:attacking'],
              target: ['kissing:kissing'],
            },
            targets: {
              scope: 'kissing:close_actors_facing_each_other',
            },
          },
          null,
          2
        )
      );

      await fs.writeFile(
        path.join(componentsDir, 'arousal.component.json'),
        JSON.stringify(
          {
            id: 'integration_test_mod:arousal',
            extends: 'base_mod:emotional_state',
            dataSchema: {
              type: 'object',
              properties: {
                level: {
                  type: 'number',
                  description: 'Arousal level from affection:attraction',
                },
                target: {
                  type: 'string',
                  description: 'Reference to positioning:close_partner',
                },
              },
            },
            defaultData: {
              related_stats: ['stats_mod:charisma', 'emotion_mod:happiness'],
            },
          },
          null,
          2
        )
      );

      await fs.writeFile(
        path.join(rulesDir, 'attraction_increase.rule.json'),
        JSON.stringify(
          {
            id: 'integration_test_mod:attraction_increase',
            condition: {
              and: [
                { has_component: ['actor', 'personal-space-states:closeness'] },
                { has_component: ['target', 'affection:attraction'] },
                {
                  '>=': [
                    {
                      get_component_value: [
                        'actor',
                        'stats_mod:charisma',
                        'value',
                      ],
                    },
                    30,
                  ],
                },
              ],
            },
            operations: [
              {
                type: 'modify_component_value',
                target: 'target',
                componentId: 'affection:attraction',
                field: 'level',
                operation: 'add',
                value: 5,
              },
            ],
          },
          null,
          2
        )
      );

      const references = await extractor.extractReferences(testModPath);

      // Verify all expected references are found (based on what extractor actually finds)
      const expectedRefs = [
        'positioning',
        'affection',
        'kissing',
        'violence',
        'stats_mod',
        'emotion_mod',
        'personal-space-states',
      ];

      expectedRefs.forEach((ref) => {
        expect(references.has(ref)).toBe(true);
      });

      // Verify specific component references
      expect(references.get('personal-space-states')).toContain('closeness');
      expect(references.get('positioning')).toContain('close_partner');
      expect(references.get('affection')).toContain('attraction');
      expect(references.get('kissing')).toContain(
        'close_actors_facing_each_other'
      );
      expect(references.get('violence')).toContain('attacking');
      // Note: base_mod:emotional_state in 'extends' field is not extracted by current implementation
      expect(references.get('stats_mod')).toContain('charisma');
      expect(references.get('emotion_mod')).toContain('happiness');

      // Verify filtered references (core and self-references should be excluded)
      expect(references.has('core')).toBe(false);
      expect(references.has('integration_test_mod')).toBe(false);
    });

    it('should handle mixed valid and invalid files gracefully', async () => {
      const actionsDir = path.join(testModPath, 'actions');
      await fs.mkdir(actionsDir, { recursive: true });

      // Create valid file
      await fs.writeFile(
        path.join(actionsDir, 'valid.action.json'),
        JSON.stringify({
          id: 'integration_test_mod:valid',
          required_components: {
            actor: ['positioning:standing', 'affection:arousal'],
          },
        })
      );

      // Create invalid JSON file
      await fs.writeFile(
        path.join(actionsDir, 'malformed.action.json'),
        '{ "invalid": json content without closing brace'
      );

      // Create another valid file
      await fs.writeFile(
        path.join(actionsDir, 'also_valid.action.json'),
        JSON.stringify({
          id: 'integration_test_mod:also_valid',
          forbidden_components: {
            target: ['violence:fighting'],
          },
        })
      );

      const references = await extractor.extractReferences(testModPath);

      // Should extract from valid files
      expect(references.has('positioning')).toBe(true);
      expect(references.has('affection')).toBe(true);
      expect(references.has('violence')).toBe(true);

      expect(references.get('positioning')).toContain('standing');
      expect(references.get('affection')).toContain('arousal');
      expect(references.get('violence')).toContain('fighting');

      // Should log warning for invalid file
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to process malformed.action.json (.json)'
        ),
        expect.objectContaining({
          filePath: expect.stringContaining('malformed.action.json'),
          fileType: '.json',
          error: expect.any(String),
        })
      );
    });

    it('should handle complex nested directory structures', async () => {
      // Create nested structure
      const nestedPath = path.join(
        testModPath,
        'content',
        'relationships',
        'romantic'
      );
      await fs.mkdir(nestedPath, { recursive: true });

      const conditionalPath = path.join(testModPath, 'logic', 'conditions');
      await fs.mkdir(conditionalPath, { recursive: true });

      // Create files in nested directories
      await fs.writeFile(
        path.join(nestedPath, 'flirt.action.json'),
        JSON.stringify({
          id: 'integration_test_mod:flirt',
          targets: 'affection:attracted_partners',
          required_components: {
            actor: ['social_mod:charisma', 'emotion_mod:confidence'],
          },
        })
      );

      await fs.writeFile(
        path.join(conditionalPath, 'attraction_check.condition.json'),
        JSON.stringify({
          id: 'integration_test_mod:attraction_check',
          condition: {
            '>=': [
              {
                get_component_value: [
                  'target',
                  'affection:attraction',
                  'level',
                ],
              },
              { get_component_value: ['actor', 'stats_mod:charisma', 'value'] },
            ],
          },
        })
      );

      const references = await extractor.extractReferences(testModPath);

      expect(references.has('affection')).toBe(true);
      expect(references.has('social_mod')).toBe(true);
      expect(references.has('emotion_mod')).toBe(true);
      expect(references.has('stats_mod')).toBe(true);

      expect(references.get('affection')).toContain('attracted_partners');
      expect(references.get('affection')).toContain('attraction');
      expect(references.get('social_mod')).toContain('charisma');
      expect(references.get('emotion_mod')).toContain('confidence');
      expect(references.get('stats_mod')).toContain('charisma');
    });

    it('should process scope files with real content', async () => {
      const scopesDir = path.join(testModPath, 'scopes');
      await fs.mkdir(scopesDir, { recursive: true });

      await fs.writeFile(
        path.join(scopesDir, 'close_partners.scope'),
        `// Scope definitions for close partners
affection:close_partners := actor.components.personal-space-states:closeness.partners[][{
  "and": [
    {"has_component": ["item", "affection:attraction"]},
    {">=": [{"get_component_value": ["item", "affection:attraction", "level"]}, 30]}
  ]
}]

positioning:nearby_furniture := actor.components.positioning:location.furniture + entities(furniture_mod:chair)

social_mod:conversation_partners := actor.partners | actor.components.social_mod:friends.list[]
`
      );

      const references = await extractor.extractReferences(testModPath);

      expect(references.has('affection')).toBe(true);
      expect(references.has('positioning')).toBe(true);
      expect(references.has('furniture_mod')).toBe(true);
      expect(references.has('social_mod')).toBe(true);

      expect(references.get('personal-space-states')).toContain('closeness');
      expect(references.get('positioning')).toContain('location');
      expect(references.get('affection')).toContain('attraction');
      expect(references.get('furniture_mod')).toContain('chair');
      expect(references.get('social_mod')).toContain('friends');
    });
  });

  describe('Complex Mod Ecosystems', () => {
    it('should handle a realistic multi-mod dependency scenario', async () => {
      // Simulate a realistic mod structure with multiple content types
      const dirs = ['actions', 'components', 'rules', 'events', 'conditions'];
      await Promise.all(
        dirs.map((dir) =>
          fs.mkdir(path.join(testModPath, dir), { recursive: true })
        )
      );

      // Action file
      await fs.writeFile(
        path.join(testModPath, 'actions', 'seduce.action.json'),
        JSON.stringify({
          id: 'integration_test_mod:seduce',
          required_components: {
            actor: [
              'personal-space-states:closeness',
              'affection:attraction',
              'social_mod:charisma',
            ],
            target: ['core:actor', 'positioning:facing'],
          },
          forbidden_components: {
            actor: ['violence:hostile', 'relationship_mod:married'],
            target: ['affection:unavailable'],
          },
          condition: {
            and: [
              { has_component: ['actor', 'stats_mod:charisma'] },
              {
                '>=': [
                  {
                    get_component_value: [
                      'actor',
                      'stats_mod:charisma',
                      'value',
                    ],
                  },
                  50,
                ],
              },
              { has_component: ['target', 'emotion_mod:receptive'] },
            ],
          },
          targets: {
            scope: 'affection:available_partners',
          },
        })
      );

      // Component file
      await fs.writeFile(
        path.join(testModPath, 'components', 'seduction_state.component.json'),
        JSON.stringify({
          id: 'integration_test_mod:seduction_state',
          extends: 'base_framework:state_component',
          dataSchema: {
            properties: {
              target_id: {
                description: 'ID of target from personal-space:close_actors',
              },
              technique: {
                enum: [
                  'social_mod:compliment',
                  'affection:touch',
                  'conversation_mod:flirt',
                ],
              },
              success_chance: {
                dependencies: [
                  'stats_mod:charisma',
                  'appearance_mod:attractiveness',
                ],
              },
            },
          },
        })
      );

      // Rule file
      await fs.writeFile(
        path.join(testModPath, 'rules', 'seduction_success.rule.json'),
        JSON.stringify({
          id: 'integration_test_mod:seduction_success',
          condition_ref: 'affection:seduction_successful',
          operations: [
            {
              type: 'add_component',
              target: 'target',
              component: 'affection:attracted',
              data: { source: '{actor.id}', level: 25 },
            },
            {
              type: 'modify_component_value',
              target: 'actor',
              componentId: 'relationship_mod:reputation',
              field: 'seduction_skill',
              operation: 'add',
              value: 1,
            },
            {
              type: 'dispatch_event',
              event_type: 'relationship_mod:attraction_gained',
              payload: {
                actor_id: '{actor.id}',
                target_id: '{target.id}',
              },
            },
          ],
        })
      );

      // Event file
      await fs.writeFile(
        path.join(testModPath, 'events', 'seduction_attempted.event.json'),
        JSON.stringify({
          id: 'integration_test_mod:seduction_attempted',
          payloadSchema: {
            actor_id: 'string',
            target_id: 'string',
            technique: {
              enum: [
                'social_mod:verbal',
                'affection:physical',
                'psychological_mod:manipulation',
              ],
            },
          },
          handlers: [
            {
              type: 'update_component',
              target: 'actor',
              componentId: 'stats_mod:experience',
              field: 'seduction_attempts',
              operation: 'increment',
            },
          ],
        })
      );

      // Condition file
      await fs.writeFile(
        path.join(
          testModPath,
          'conditions',
          'mutual_attraction.condition.json'
        ),
        JSON.stringify({
          id: 'integration_test_mod:mutual_attraction',
          condition: {
            and: [
              { has_component: ['actor', 'affection:attracted_to'] },
              { has_component: ['target', 'affection:attracted_to'] },
              {
                '==': [
                  {
                    get_component_value: [
                      'actor',
                      'affection:attracted_to',
                      'target',
                    ],
                  },
                  '{target.id}',
                ],
              },
              {
                '==': [
                  {
                    get_component_value: [
                      'target',
                      'affection:attracted_to',
                      'target',
                    ],
                  },
                  '{actor.id}',
                ],
              },
            ],
          },
        })
      );

      const references = await extractor.extractReferences(testModPath);

      // Verify comprehensive cross-mod references (base_framework in 'extends' field not extracted)
      const expectedMods = [
        'positioning',
        'affection',
        'social_mod',
        'violence',
        'relationship_mod',
        'stats_mod',
        'emotion_mod',
        'conversation_mod',
        'appearance_mod',
        'psychological_mod',
      ];

      expectedMods.forEach((mod) => {
        expect(references.has(mod)).toBe(true);
      });

      // Verify specific component references from different contexts
      expect(references.get('personal-space-states')).toContain('closeness');
      expect(references.get('positioning')).toContain('facing');
      expect(references.get('affection')).toContain('attraction');
      expect(references.get('affection')).toContain('available_partners');
      expect(references.get('affection')).toContain('seduction_successful');
      expect(references.get('social_mod')).toContain('charisma');
      expect(references.get('social_mod')).toContain('compliment');
      expect(references.get('relationship_mod')).toContain('married');
      expect(references.get('relationship_mod')).toContain('reputation');

      // Verify core and self-references are filtered
      expect(references.has('core')).toBe(false);
      expect(references.has('integration_test_mod')).toBe(false);
    });

    it('should handle file system errors gracefully', async () => {
      // Create a directory structure
      const actionsDir = path.join(testModPath, 'actions');
      await fs.mkdir(actionsDir, { recursive: true });

      // Create a good file
      await fs.writeFile(
        path.join(actionsDir, 'good.action.json'),
        JSON.stringify({
          required_components: { actor: ['positioning:standing'] },
        })
      );

      // Create a file that will cause read errors (simulate permission issues)
      const problemFile = path.join(actionsDir, 'problem.action.json');
      await fs.writeFile(problemFile, JSON.stringify({ test: 'content' }));

      // Mock fs.readFile to throw error for specific file
      const originalReadFile = fs.readFile;
      const mockReadFile = jest
        .fn()
        .mockImplementation(async (filePath, encoding) => {
          if (filePath.includes('problem.action.json')) {
            throw new Error('Permission denied');
          }
          return originalReadFile(filePath, encoding);
        });

      // Temporarily replace fs.readFile
      fs.readFile = mockReadFile;

      try {
        const references = await extractor.extractReferences(testModPath);

        // Should still extract from good file
        expect(references.has('positioning')).toBe(true);
        expect(references.get('positioning')).toContain('standing');

        // Should log error for problem file
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to process problem.action.json (.json)'
          ),
          expect.objectContaining({
            filePath: expect.stringContaining('problem.action.json'),
            fileType: '.json',
            error: expect.any(String),
          })
        );
      } finally {
        // Restore original fs.readFile
        fs.readFile = originalReadFile;
      }
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large directory structures efficiently', async () => {
      // Create many nested directories and files
      const numDirs = 10;
      const numFilesPerDir = 10;

      for (let i = 0; i < numDirs; i++) {
        const dirPath = path.join(testModPath, `category_${i}`);
        await fs.mkdir(dirPath, { recursive: true });

        for (let j = 0; j < numFilesPerDir; j++) {
          await fs.writeFile(
            path.join(dirPath, `file_${j}.action.json`),
            JSON.stringify({
              id: `integration_test_mod:file_${i}_${j}`,
              required_components: {
                actor: [`mod${i}:component${j}`, `shared_mod:common_component`],
              },
            })
          );
        }
      }

      const startTime = performance.now();
      const references = await extractor.extractReferences(testModPath);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 2 seconds for 100 files)
      expect(duration).toBeLessThan(2000);

      // Should extract all mod references
      for (let i = 0; i < numDirs; i++) {
        expect(references.has(`mod${i}`)).toBe(true);
        for (let j = 0; j < numFilesPerDir; j++) {
          expect(references.get(`mod${i}`)).toContain(`component${j}`);
        }
      }

      expect(references.has('shared_mod')).toBe(true);
      expect(references.get('shared_mod')).toContain('common_component');

      // Log performance metrics
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Extracted references for mod 'integration_test_mod'"
        )
      );
    });
  });

  describe('Real-world Edge Cases', () => {
    it('should handle empty directories and files', async () => {
      // Create empty directory
      const emptyDir = path.join(testModPath, 'empty');
      await fs.mkdir(emptyDir, { recursive: true });

      // Create empty file
      await fs.writeFile(path.join(testModPath, 'empty.json'), '');

      // Create file with empty JSON object
      await fs.writeFile(path.join(testModPath, 'empty_object.json'), '{}');

      // Create file with null content
      await fs.writeFile(path.join(testModPath, 'null.json'), 'null');

      const references = await extractor.extractReferences(testModPath);

      expect(references).toBeInstanceOf(Map);
      expect(references.size).toBe(0);
    });

    it('should handle files with complex JSON structures', async () => {
      await fs.writeFile(
        path.join(testModPath, 'complex.action.json'),
        JSON.stringify(
          {
            id: 'integration_test_mod:complex',
            metadata: {
              version: '1.0',
              dependencies: [
                'positioning:core_system',
                'affection:advanced_features',
              ],
              nested: {
                deep: {
                  references: ['social_mod:conversation_engine'],
                  array: [
                    { ref: 'stats_mod:calculation_system' },
                    { ref: 'emotion_mod:state_machine' },
                  ],
                },
              },
            },
            condition: {
              or: [
                {
                  and: [
                    { has_component: ['actor', 'positioning:sitting'] },
                    {
                      '>=': [
                        {
                          get_component_value: [
                            'actor',
                            'affection:comfort',
                            'level',
                          ],
                        },
                        50,
                      ],
                    },
                  ],
                },
                {
                  not: {
                    has_component: ['target', 'violence:threatening'],
                  },
                },
              ],
            },
          },
          null,
          2
        )
      );

      const references = await extractor.extractReferences(testModPath);

      // Current implementation finds references from JSON Logic conditions and action-specific fields
      // but not from nested metadata objects
      expect(references.has('positioning')).toBe(true);
      expect(references.has('affection')).toBe(true);
      expect(references.has('violence')).toBe(true);

      expect(references.get('positioning')).toContain('sitting');
      expect(references.get('affection')).toContain('comfort');
      expect(references.get('violence')).toContain('threatening');

      // Note: social_mod, stats_mod, emotion_mod references in nested metadata are not extracted
      // by current implementation as action files don't have generic object traversal
    });
  });

  describe('Logging and Debug Information', () => {
    it('should provide comprehensive logging during extraction', async () => {
      const actionsDir = path.join(testModPath, 'actions');
      await fs.mkdir(actionsDir, { recursive: true });

      await fs.writeFile(
        path.join(actionsDir, 'test.action.json'),
        JSON.stringify({
          required_components: { actor: ['positioning:standing'] },
        })
      );

      await extractor.extractReferences(testModPath);

      // Should log start of extraction
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting reference extraction for mod: integration_test_mod'
      );

      // Should log successful completion
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /Extracted references for mod 'integration_test_mod': positioning/
        )
      );

      // Should log file processing
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Processed JSON file: test.action.json'
      );

      // Should log reference discovery
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Found reference positioning:standing in required_components'
      );
    });
  });
});
