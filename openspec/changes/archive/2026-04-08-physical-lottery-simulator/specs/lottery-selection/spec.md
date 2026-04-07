## ADDED Requirements

### Requirement: Lottery configuration
The system SHALL accept a lottery configuration specifying: number range (min, max), number of balls to select, and optional physical parameters (container radius, ball radius, airflow settings, gravity, restitution, max frames).

#### Scenario: Configure standard lottery
- **WHEN** user configures range 1-35, select 5
- **THEN** the system creates 35 balls and runs simulation until 5 balls are ejected

### Requirement: Pipe ejection detection
The system SHALL detect when a ball exits through the top-center pipe. A ball is ejected when its y-position exceeds the pipe height threshold AND its horizontal position (x, z) is within the pipe radius.

#### Scenario: Center ball escapes through pipe
- **WHEN** a ball reaches y > pipe_height AND |x| < pipe_radius AND |z| < pipe_radius
- **THEN** the ball is marked as ejected and its ID is recorded in selection order

### Requirement: Ejected ball removal
The system SHALL immediately remove an ejected ball from the active simulation upon detection, preventing it from interacting with remaining balls.

#### Scenario: Ejected ball no longer affects simulation
- **WHEN** a ball is ejected through the pipe
- **THEN** it is removed from collision detection and force calculations in subsequent frames

### Requirement: Ordered selection output
The system SHALL return selected ball IDs in the order they were ejected, as a sorted list (ascending numeric order) for display purposes.

#### Scenario: Return sorted results
- **WHEN** balls with IDs [23, 7, 31, 15, 3] are ejected in that order
- **THEN** the final output returns [3, 7, 15, 23, 31] (sorted ascending)

### Requirement: Dual-zone lottery support
The system SHALL support running two independent lottery zones (e.g., front zone and back zone) sequentially, each with its own number range and selection count.

#### Scenario: Run front and back zone lottery
- **WHEN** user requests front zone 1-35 select 5 and back zone 1-12 select 2
- **THEN** the system runs two independent simulations and returns both result sets

### Requirement: Per-ball ejection time constraint
The system SHALL enforce a strict per-ball ejection time limit of 10 seconds (600 frames at dt=1/60s). Each ball MUST be ejected within 10 seconds of the previous ball's ejection (or simulation start for the first ball). If a ball is not ejected within 10 seconds, the system SHALL automatically increase airflow power in 20% increments until ejection occurs.

#### Scenario: Ball ejected within normal time
- **WHEN** a ball is ejected within 10 seconds of simulation start (or previous ejection)
- **THEN** the simulation continues with normal airflow parameters for the next ball

#### Scenario: Ball takes too long, airflow auto-boost
- **WHEN** no ball is ejected within 10 seconds
- **THEN** airflow power is increased by 20% and the timer resets for the next 10-second window

### Requirement: Hard timeout and restart
If a ball is not ejected within 20 seconds (1200 frames) despite airflow auto-boost, the system SHALL declare the simulation a failure and automatically restart from the beginning with a new random seed. The system SHALL retry up to 3 times before raising an unrecoverable error.

#### Scenario: Simulation fails and restarts
- **WHEN** no ball is ejected within 20 seconds of simulation start (or previous ejection)
- **THEN** the simulation is marked as failed, a new random seed is generated, and the simulation restarts from scratch

#### Scenario: Max retries exceeded
- **WHEN** the simulation fails 3 consecutive times
- **THEN** the system raises an UnrecoverableError with diagnostic information (last seed, ball count, airflow parameters)

### Requirement: Maximum frame limit with fallback
The system SHALL enforce a maximum total frame limit (default 10000). If not all balls are ejected by this limit, the system SHALL select remaining balls randomly from the active set as a fallback.

#### Scenario: Simulation exceeds max frames
- **WHEN** the simulation reaches 10000 frames with only 3 of 5 balls ejected
- **THEN** the remaining 2 balls are randomly selected from active balls and the simulation terminates

### Requirement: Reproducible results with seed
The system SHALL accept an optional random seed parameter. When the same seed is provided, the simulation SHALL produce identical results across runs.

#### Scenario: Same seed produces same results
- **WHEN** the simulation is run twice with seed=42
- **THEN** both runs produce identical ejected ball sequences
