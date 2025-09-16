Movement Mod Migration Backup
=============================

Backup Date: 20250915-182105
Purpose: Movement mod migration from core (MOVMODMIG-002)

Files Backed Up:
----------------
Core Mod:
- actions/go.action.json
- rules/go.rule.json
- conditions/event-is-action-go.condition.json
- conditions/actor-can-move.condition.json
- conditions/exit-is-unblocked.condition.json
- scopes/clear_directions.scope

Positioning Mod:
- actions/turn_around.action.json
- actions/get_close.action.json

Movement Mod:
- mod-manifest.json (existing structure)

Total Files: 9
Checksums: checksums.txt (SHA256)

Migration Analysis Reference:
reports/movement-mod-migration-analysis.md

Rollback Instructions:
To rollback this migration, execute:
./rollback.sh movement-migration-backup-20250915-182105

Notes:
- All files have been verified with SHA256 checksums
- This backup should be retained until at least 2 versions after migration
- The movement mod already exists and will be populated rather than created