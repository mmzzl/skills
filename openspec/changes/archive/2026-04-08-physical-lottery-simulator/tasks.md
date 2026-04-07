## 1. Project Setup

- [x] 1.1 Create `physics_lottery/` package directory with `__init__.py`
- [x] 1.2 Add `numpy` to project dependencies (requirements.txt or pyproject.toml)
- [x] 1.3 Create `main.py` entry point for standalone execution

## 2. Core Physics Engine

- [x] 2.1 Implement `Ball` class with position (np.array), velocity (np.array), radius, id, and active status
- [x] 2.2 Implement `Container` class with center, radius, restitution coefficient, and boundary collision method
- [x] 2.3 Implement ball-to-ball collision detection (O(N²) pairwise distance check)
- [x] 2.4 Implement elastic collision response with overlap separation correction
- [x] 2.5 Implement sub-stepping loop (default 4 substeps per frame) with dt = 1/60s

## 3. Airflow Simulation

- [x] 3.1 Implement Gaussian center-weight function: exp(-d² / (2σ²))
- [x] 3.2 Implement height-dependent airflow factor (0.3 at bottom → 1.5 at top)
- [x] 3.3 Implement random perturbation for horizontal velocity (x, z axes)
- [x] 3.4 Combine gravity, airflow force, and perturbation into per-ball force application
- [x] 3.5 Make airflow parameters (power, sigma, perturbation magnitude) configurable via constructor

## 4. Lottery Selection Logic

- [x] 4.1 Implement `LotteryConfig` dataclass with range (min, max), select_count, and physical parameters
- [x] 4.2 Implement pipe ejection detection (y > pipe_height AND |x| < pipe_radius AND |z| < pipe_radius)
- [x] 4.3 Implement ejected ball removal from active simulation
- [x] 4.4 Implement ordered selection output (ejection order recorded, final result sorted ascending)
- [x] 4.5 Implement per-ball 10-second ejection timer with auto-boost (airflow power *= 1.2 on timeout)
- [x] 4.6 Implement 20-second hard timeout: declare failure, restart with new seed (max 3 retries)
- [x] 4.7 Implement `UnrecoverableError` exception with diagnostic info (seed, ball count, airflow params)
- [x] 4.8 Implement maximum frame limit (default 10000) with random fallback selection
- [x] 4.9 Implement random seed support for reproducible results

## 5. Dual-Zone Lottery Runner

- [x] 5.1 Implement `LotteryRunner` class that orchestrates the full simulation loop
- [x] 5.2 Add support for dual-zone configuration (front zone + back zone) running sequentially
- [x] 5.3 Implement result formatting: return both zones' selected numbers as sorted lists

## 6. Entry Point & CLI

- [x] 6.1 Create `main.py` with CLI argument parsing (front range, front count, back range, back count, optional seed)
- [x] 6.2 Add default configuration for standard lottery (1-35选5 + 1-12选2)
- [x] 6.3 Print results in formatted output (e.g., "前区: [3, 7, 15, 23, 31] | 后区: [2, 9]")

## 7. Testing & Validation

- [x] 7.1 Write unit test for ball-to-ball collision response (verify velocity exchange)
- [x] 7.2 Write unit test for container boundary collision (verify reflection)
- [x] 7.3 Write unit test for pipe ejection detection
- [x] 7.4 Write integration test: run full simulation with seed, verify deterministic output
- [x] 7.5 Write integration test: dual-zone lottery produces correct number of results
- [x] 7.6 Run simulation multiple times without seed to verify randomness distribution
