## ADDED Requirements

### Requirement: Ball representation
The system SHALL represent each ball as a 3D entity with position (Vec3), velocity (Vec3), radius, unique ID, and active status.

#### Scenario: Ball initialization
- **WHEN** a lottery is configured with range 1-35
- **THEN** 35 balls are created with IDs 1-35, each assigned random initial position within container and zero velocity

### Requirement: Ball-to-ball collision detection
The system SHALL detect collisions between all pairs of active balls by checking if the distance between centers is less than the sum of their radii.

#### Scenario: Two balls collide
- **WHEN** two balls' center-to-center distance becomes less than 2 × ball_radius
- **THEN** a collision is detected and resolved in the same frame

### Requirement: Ball-to-ball collision response
The system SHALL resolve collisions using elastic collision response: reflecting relative velocity along the collision normal and separating overlapping balls.

#### Scenario: Elastic collision between equal-mass balls
- **WHEN** two equal-mass balls collide
- **THEN** their velocity components along the collision normal are exchanged

### Requirement: Container boundary constraint
The system SHALL constrain all balls within a spherical container. When a ball's distance from the container center exceeds (container_radius - ball_radius), the ball SHALL be reflected inward with energy loss (restitution coefficient).

#### Scenario: Ball hits container wall
- **WHEN** a ball reaches the container boundary
- **THEN** its velocity is reflected along the inward normal and scaled by the restitution coefficient (default 0.7)

### Requirement: Sub-stepping for simulation accuracy
The system SHALL divide each frame into multiple sub-steps (default 4) to improve collision detection accuracy and prevent ball tunneling.

#### Scenario: High-velocity ball does not tunnel through wall
- **WHEN** a ball moves fast enough to potentially cross the container boundary in one step
- **THEN** sub-stepping ensures the collision is detected and resolved before penetration
