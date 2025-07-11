import { NotesSectionAssembler } from '../../../../src/prompting/assembling/notesSectionAssembler.js';
import { validateAssemblerParams } from '../../../../src/prompting/assembling/assemblerValidation.js';
import { resolveWrapper } from '../../../../src/utils/wrapperUtils.js';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';

describe('NotesSectionAssembler - Integration Tests', () => {
  let assembler;

  beforeEach(() => {
    assembler = new NotesSectionAssembler();
  });

  describe('Real Dependency Integration', () => {
    it('integrates with actual validateAssemblerParams function', () => {
      // Test that the real validation function works as expected
      const result = validateAssemblerParams({
        elementConfig: {},
        promptData: { notesArray: [] },
        placeholderResolver: { resolve: (str) => str },
        functionName: 'Integration Test',
      });

      expect(result.valid).toBe(true);
      expect(result.paramsProvided).toEqual({
        elementConfigProvided: true,
        promptDataProvider: true,
        placeholderResolverProvided: true,
      });
    });

    it('integrates with actual resolveWrapper function', () => {
      const wrappers = {
        prefix: 'Notes: ',
        suffix: ' End notes.',
      };
      const mockResolver = {
        resolve: (str, context) => {
          if (str === 'Notes: ') return 'RESOLVED_PREFIX: ';
          if (str === ' End notes.') return ' RESOLVED_SUFFIX.';
          return str;
        },
      };
      const context = { test: 'context' };

      const result = resolveWrapper(wrappers, mockResolver, context);

      expect(result.prefix).toBe('RESOLVED_PREFIX: ');
      expect(result.suffix).toBe(' RESOLVED_SUFFIX.');
    });

    it('works end-to-end with real dependencies and complex data', () => {
      const complexResolver = {
        resolve: (str, context) => {
          if (str.includes('{{')) {
            return str
              .replace('{{actor_name}}', context.actorName || 'Unknown')
              .replace('{{timestamp}}', context.currentTime || 'Unknown');
          }
          return str;
        },
      };

      const elementConfig = {
        prefix: '=== Notes for {{actor_name}} at {{timestamp}} ===',
        suffix: '=== End Notes ===',
      };

      const promptData = {
        notesArray: [
          {
            text: 'Remember to check inventory',
            subject: 'Gameplay',
            context: 'during exploration',
            tags: ['important', 'reminder'],
            timestamp: '2024-01-15T10:30:00Z',
          },
          {
            text: 'Found mysterious key in basement',
            subject: 'Discoveries',
            timestamp: '2024-01-15T09:45:00Z',
          },
          {
            text: 'NPC mentioned artifact location',
            subject: 'Gameplay',
            context: 'conversation with elder',
            tags: ['quest', 'artifact'],
            timestamp: '2024-01-15T11:00:00Z',
          },
          {
            text: 'Old journal entry without structure',
            timestamp: '2024-01-15T08:00:00Z',
          },
        ],
        // Add context data directly to promptData since that's what gets passed to resolver
        actorName: 'Aria the Explorer',
        currentTime: '2024-01-15T12:00:00Z',
      };

      const result = assembler.assemble(
        elementConfig,
        promptData,
        complexResolver,
        undefined
      );

      // Verify complex integration worked
      expect(result).toContain(
        '=== Notes for Aria the Explorer at 2024-01-15T12:00:00Z ==='
      );
      expect(result).toContain('=== End Notes ===');
      expect(result).toContain('[Discoveries]');
      expect(result).toContain('[Gameplay]');
      expect(result).toContain('[General Notes]');
      expect(result).toContain(
        '- Remember to check inventory (during exploration) [important, reminder]'
      );
      expect(result).toContain(
        '- NPC mentioned artifact location (conversation with elder) [quest, artifact]'
      );
      expect(result).toContain('- Old journal entry without structure');
    });
  });

  describe('Cross-Component Workflow Integration', () => {
    it('handles complete prompt assembly workflow', () => {
      // Simulate a complete workflow that might happen in the real application
      const gameStateData = {
        currentLocation: 'Ancient Library',
        playerLevel: 15,
        questProgress: 'investigating_artifact',
      };

      const aiMemoryData = [
        {
          text: 'Player discovered ancient tome about shadow magic',
          subject: 'Knowledge',
          context: 'Ancient Library research',
          tags: ['magic', 'lore', 'important'],
          timestamp: '2024-01-15T14:20:00Z',
        },
        {
          text: 'Librarian warned about dangers of shadow magic',
          subject: 'Warnings',
          context: 'conversation with NPC',
          tags: ['warning', 'npc_dialogue'],
          timestamp: '2024-01-15T14:25:00Z',
        },
        {
          text: 'Found hidden passage behind bookshelf',
          subject: 'Discoveries',
          timestamp: '2024-01-15T14:30:00Z',
        },
      ];

      const promptElementConfig = {
        prefix: '\\n## Character Memory and Notes\\n',
        suffix: '\\n---\\n',
      };

      const advancedResolver = {
        resolve: (str, context) => {
          return str
            .replace('{{location}}', context.location)
            .replace('{{level}}', context.level);
        },
      };

      const promptData = {
        notesArray: aiMemoryData,
        gameState: gameStateData,
      };

      const context = {
        location: gameStateData.currentLocation,
        level: gameStateData.playerLevel,
      };

      const result = assembler.assemble(
        promptElementConfig,
        promptData,
        advancedResolver,
        undefined
      );

      // Verify the workflow integration
      expect(result).toContain('## Character Memory and Notes');
      expect(result).toContain('---');
      expect(result).toContain('[Discoveries]');
      expect(result).toContain('[Knowledge]');
      expect(result).toContain('[Warnings]');

      // Verify proper ordering and formatting
      const lines = result.split('\n');
      const knowledgeIndex = lines.findIndex((line) => line === '[Knowledge]');
      const warningsIndex = lines.findIndex((line) => line === '[Warnings]');
      expect(knowledgeIndex).toBeLessThan(warningsIndex); // Alphabetical subject ordering
    });

    it('integrates with game state changes over time', () => {
      // Simulate notes being added over multiple game sessions
      const session1Notes = [
        {
          text: 'Started quest to find the Crystal of Power',
          subject: 'Quests',
          timestamp: '2024-01-10T10:00:00Z',
        },
      ];

      const session2Notes = [
        ...session1Notes,
        {
          text: 'Met the wise sage who gave cryptic clue',
          subject: 'NPCs',
          context: 'mountain village',
          timestamp: '2024-01-11T15:30:00Z',
        },
        {
          text: 'Found first piece of the crystal in cave',
          subject: 'Quests',
          context: 'dark cave exploration',
          tags: ['progress', 'crystal'],
          timestamp: '2024-01-11T18:45:00Z',
        },
      ];

      const session3Notes = [
        ...session2Notes,
        {
          text: 'Sage revealed true nature of the crystal',
          subject: 'NPCs',
          context: 'return visit to sage',
          tags: ['revelation', 'plot'],
          timestamp: '2024-01-12T12:00:00Z',
        },
        {
          text: 'Must find remaining pieces before dark moon',
          subject: 'Quests',
          context: 'urgent quest update',
          tags: ['deadline', 'urgent'],
          timestamp: '2024-01-12T12:15:00Z',
        },
      ];

      const resolver = { resolve: (str) => str };
      const config = { prefix: 'Quest Log:\\n', suffix: '\\nEnd Log' };

      // Test session progression
      const result1 = assembler.assemble(
        config,
        { notesArray: session1Notes },
        resolver,
        undefined
      );
      const result2 = assembler.assemble(
        config,
        { notesArray: session2Notes },
        resolver,
        undefined
      );
      const result3 = assembler.assemble(
        config,
        { notesArray: session3Notes },
        resolver,
        undefined
      );

      // Verify progression
      expect(result1).toContain('[Quests]');
      expect(result1).not.toContain('[NPCs]');

      expect(result2).toContain('[NPCs]');
      expect(result2).toContain('[Quests]');
      expect(result2).toContain('mountain village');

      expect(result3).toContain('dark cave exploration');
      expect(result3).toContain('return visit to sage');
      expect(result3).toContain('[deadline, urgent]');

      // Verify all sessions maintain proper ordering
      [result1, result2, result3].forEach((result) => {
        const lines = result.split('\n');
        const questIndex = lines.findIndex((line) => line === '[Quests]');
        expect(questIndex).toBeGreaterThan(-1);
      });
    });
  });

  describe('Performance Integration Tests', () => {
    it('maintains performance with realistic game data sizes', () => {
      // Simulate realistic game session data
      const realisticNotes = [];
      const subjects = [
        'Combat',
        'Exploration',
        'NPCs',
        'Quests',
        'Lore',
        'Items',
      ];
      const contexts = [
        'dungeon',
        'town',
        'wilderness',
        'conversation',
        'discovery',
      ];
      const tags = ['important', 'urgent', 'completed', 'in_progress', 'clue'];

      // Generate 500 notes simulating a long gaming session
      for (let i = 0; i < 500; i++) {
        const hasSubject = Math.random() > 0.2; // 80% structured notes
        realisticNotes.push({
          text: `Game event ${i}: ${hasSubject ? 'structured' : 'unstructured'} note with moderate length text content that represents realistic in-game events and discoveries.`,
          subject: hasSubject ? subjects[i % subjects.length] : undefined,
          context:
            Math.random() > 0.5 ? contexts[i % contexts.length] : undefined,
          tags:
            Math.random() > 0.6
              ? [tags[i % tags.length], tags[(i + 1) % tags.length]]
              : undefined,
          timestamp: new Date(
            2024,
            0,
            1,
            10 + (i % 12),
            i % 60,
            0
          ).toISOString(),
        });
      }

      const config = {
        prefix: '=== Game Session Notes ===\\n',
        suffix: '\\n=== Session End ===',
      };

      const resolver = { resolve: (str) => str };

      const start = performance.now();
      const result = assembler.assemble(
        config,
        { notesArray: realisticNotes },
        resolver,
        undefined
      );
      const duration = performance.now() - start;

      // Performance assertions
      expect(duration).toBeLessThan(200); // Should complete in under 200ms
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(10000); // Substantial output

      // Verify all subjects are present
      subjects.forEach((subject) => {
        expect(result).toContain(`[${subject}]`);
      });
      expect(result).toContain('[General Notes]'); // Unstructured notes
    });

    it('handles memory pressure gracefully in long-running scenarios', () => {
      // Simulate multiple rapid calls as might happen in a real game
      const testNote = {
        text: 'Recurring game event',
        subject: 'Performance Test',
        timestamp: '2024-01-15T12:00:00Z',
      };

      const config = { prefix: 'Test: ', suffix: ' End' };
      const resolver = { resolve: (str) => str };
      const promptData = { notesArray: [testNote] };

      // Perform many rapid calls
      for (let i = 0; i < 100; i++) {
        const result = assembler.assemble(
          config,
          promptData,
          resolver,
          undefined
        );
        expect(result).toContain('[Performance Test]');
        expect(result).toContain('- Recurring game event');
      }

      // Verify no memory leak indicators (this is basic, real leak detection would need more sophisticated testing)
      expect(typeof assembler.assemble).toBe('function');
    });
  });

  describe('Error Recovery Integration', () => {
    it('recovers gracefully from partial data corruption', () => {
      const partiallyCorruptData = {
        notesArray: [
          // Valid note
          {
            text: 'Valid note 1',
            subject: 'Valid',
            timestamp: '2024-01-15T12:00:00Z',
          },
          // Corrupted notes (missing required fields, invalid types)
          {
            // Missing text
            subject: 'Corrupt1',
            timestamp: '2024-01-15T12:01:00Z',
          },
          {
            text: 'Valid note 2',
            subject: 'Valid',
            timestamp: '2024-01-15T12:02:00Z',
          },
          // Note with invalid timestamp
          {
            text: 'Note with bad timestamp',
            subject: 'Valid',
            timestamp: 'not-a-timestamp',
          },
        ],
      };

      const config = { prefix: 'Recovery Test:\\n', suffix: '\\nEnd Test' };
      const resolver = { resolve: (str) => str };

      const result = assembler.assemble(
        config,
        partiallyCorruptData,
        resolver,
        undefined
      );

      // Should handle corruption gracefully
      expect(result).toContain('[Valid]');
      expect(result).toContain('- Valid note 1');
      expect(result).toContain('- Valid note 2');
      expect(result).toContain('- Note with bad timestamp');

      // Should handle missing text gracefully
      expect(result).toContain('[Corrupt1]');
      expect(result).toContain('- '); // Empty text becomes empty bullet point
    });

    it('handles resolver failures gracefully in integration context', () => {
      const flakyResolver = {
        resolve: (str, context) => {
          // Simulate intermittent resolver failures
          if (str.includes('FAIL')) {
            throw new Error('Resolver intentional failure');
          }
          return str.replace('{{test}}', 'resolved');
        },
      };

      const config = {
        prefix: 'Stable prefix {{test}}',
        suffix: 'FAIL suffix {{test}}', // This will cause resolver to throw
      };

      const promptData = {
        notesArray: [{ text: 'Test note', subject: 'Test' }],
      };

      // This should throw due to resolver failure
      expect(() => {
        assembler.assemble(config, promptData, flakyResolver, undefined);
      }).toThrow('Resolver intentional failure');
    });
  });
});
