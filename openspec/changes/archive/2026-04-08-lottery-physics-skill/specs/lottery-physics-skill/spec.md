## ADDED Requirements

### Requirement: Natural language lottery request
The skill SHALL parse natural language requests containing front zone (前区) and/or back zone (后区) lottery parameters in the format "min-max选count" and execute the corresponding physical simulation.

#### Scenario: Full lottery request with front and back zones
- **WHEN** user says "前区1-35选5，后区1-12选2"
- **THEN** skill parses front_min=1, front_max=35, front_count=5, back_min=1, back_max=12, back_count=2 and executes simulation

#### Scenario: Front zone only request
- **WHEN** user says "前区1-35选5"
- **THEN** skill parses front_min=1, front_max=35, front_count=5, back_count=0 and executes front zone only

#### Scenario: Request with seed for reproducibility
- **WHEN** user says "前区1-35选5，后区1-12选2，seed=12345"
- **THEN** skill uses seed=12345 and returns deterministic result

#### Scenario: Invalid parameter format
- **WHEN** user provides malformed parameters like "前区abc选5"
- **THEN** skill returns error message explaining correct format

### Requirement: Simulation execution
The skill SHALL execute the physical lottery simulation using the physics_lottery module and return formatted results.

#### Scenario: Successful simulation
- **WHEN** simulation completes normally within timeout
- **THEN** skill returns formatted result with front and back zone numbers

#### Scenario: Simulation timeout
- **WHEN** simulation exceeds 60 seconds without completing
- **THEN** skill returns error message "模拟超时，请重试或使用不同参数"

#### Scenario: Hard timeout and retry failure
- **WHEN** simulation hits hard timeout and all retries fail
- **THEN** skill returns UnrecoverableError with diagnostic info

### Requirement: Formatted output
The skill SHALL format simulation results in a clear, readable Chinese format.

#### Scenario: Both zones have results
- **WHEN** front_count > 0 and back_count > 0
- **THEN** output format is "前区: [a, b, c] | 后区: [x, y]"

#### Scenario: Front zone only
- **WHEN** back_count = 0
- **THEN** output format is "前区: [a, b, c]"

#### Scenario: Error output
- **WHEN** simulation fails
- **THEN** output explains the error and suggests recovery actions