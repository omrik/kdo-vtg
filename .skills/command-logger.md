# Command Logger Skill

## Description

Automatically logs all bash commands and their results to `.command_log.md` in the project root.

## Instructions

1. **Before running any bash command**: Append to `.command_log.md` with:
   - Timestamp
   - The command being run
   - Brief description of purpose

2. **After running commands**: Append a brief summary of what was accomplished

3. **Format**:
   ```markdown
   ## [ISO timestamp]
   
   **Command**: `bash command here`
   **Purpose**: Brief description
   **Result**: Success/failure + key outcome
   ```

4. The `.command_log.md` file is already in `.gitignore` and should NOT be committed.

## Example Entry

```markdown
## 2026-04-13T14:30:00

**Command**: `npm run build`
**Purpose**: Check for TypeScript errors
**Result**: Success - 3 files built in 761ms
```
