## ADDED Requirements

### Requirement: Code extraction to external module
The skill code SHALL be extracted from SKILL.md into an external Python module at `scripts/lottery_runner.py` while maintaining the same functionality.

#### Scenario: Module exists and is importable
- **WHEN** other code imports from `scripts.lottery_runner`
- **THEN** the module loads without errors

#### Scenario: API compatibility preserved
- **WHEN** caller uses `execute_lottery("前区1-35选5")`
- **THEN** same result as before extraction

### Requirement: SKILL.md references external script
The SKILL.md SHALL reference the external script using relative path rather than containing inline code.

#### Scenario: SKILL.md contains import statement
- **WHEN** user reads SKILL.md Usage section
- **THEN** they see `from scripts.lottery_runner import execute_lottery`

#### Scenario: Clear path to script
- **WHEN** SKILL.md specifies script location
- **THEN** path is relative to SKILL.md (e.g., `scripts/lottery_runner.py`)