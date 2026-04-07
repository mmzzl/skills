## ADDED Requirements

### Requirement: Airflow force model
The system SHALL apply an upward airflow force to each active ball, calculated as the product of a Gaussian center-weight function, a height factor, and a configurable power parameter.

#### Scenario: Center ball receives maximum airflow force
- **WHEN** a ball is at the horizontal center of the container (x=0, z=0)
- **THEN** it receives the maximum upward airflow force

### Requirement: Gaussian center concentration
The airflow force SHALL decay with horizontal distance from the container center axis using a Gaussian function: weight = exp(-d² / (2σ²)), where σ is a configurable concentration parameter (default 0.3 × container_radius).

#### Scenario: Edge ball receives minimal airflow force
- **WHEN** a ball is near the container wall horizontally
- **THEN** its airflow force is significantly reduced (near zero at container edge)

### Requirement: Height-dependent airflow factor
The airflow force SHALL increase with ball height, simulating converging airflow from bottom to top. The height factor SHALL map from ~0.3 at the bottom to ~1.5 at the top of the container.

#### Scenario: Bottom ball receives weaker airflow
- **WHEN** a ball is in the lower half of the container
- **THEN** its height factor is less than 1.0, reducing the total airflow force

### Requirement: Random perturbation
The system SHALL apply a small random perturbation to each ball's horizontal velocity (x and z axes) each frame to simulate turbulent airflow and prevent balls from settling into static configurations.

#### Scenario: Balls exhibit tumbling motion
- **WHEN** the simulation runs for multiple frames
- **THEN** balls exhibit random tumbling and never settle into a completely static state

### Requirement: Configurable airflow parameters
The system SHALL allow configuration of airflow power, Gaussian sigma (concentration), and perturbation magnitude as constructor parameters with sensible defaults.

#### Scenario: User customizes airflow strength
- **WHEN** a user sets airflow_power to a higher value
- **THEN** balls are propelled upward more aggressively, resulting in faster ball ejection
