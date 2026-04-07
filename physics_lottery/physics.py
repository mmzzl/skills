"""Core physics engine classes for lottery ball simulation."""

import numpy as np
from dataclasses import dataclass
from typing import Optional


class Ball:
    """3D ball with position, velocity, radius, and active status."""

    def __init__(
        self,
        ball_id: int,
        position: np.ndarray,
        velocity: Optional[np.ndarray] = None,
        radius: float = 0.05,
    ):
        self.id = ball_id
        self.position = np.array(position, dtype=np.float64)
        self.velocity = (
            np.array(velocity, dtype=np.float64)
            if velocity is not None
            else np.zeros(3, dtype=np.float64)
        )
        self.radius = radius
        self.active = True
        self.ejection_timer = 0.0

    @property
    def mass(self) -> float:
        return 1.0

    def __repr__(self) -> str:
        return f"Ball(id={self.id}, pos={self.position}, vel={self.velocity})"


class Container:
    """Spherical container with boundary collision."""

    def __init__(self, center: np.ndarray, radius: float, restitution: float = 0.8):
        self.center = np.array(center, dtype=np.float64)
        self.radius = radius
        self.restitution = restitution

    def boundary_collision(self, ball: Ball) -> None:
        """Handle collision between ball and container boundary."""
        if not ball.active:
            return

        displacement = ball.position - self.center
        distance = np.linalg.norm(displacement)

        if distance >= self.radius - ball.radius:
            normal = (
                displacement / distance if distance > 0 else np.array([0.0, 1.0, 0.0])
            )
            penetration = distance + ball.radius - self.radius

            ball.position -= normal * (penetration + 0.001)

            rel_velocity = ball.velocity
            vel_normal = np.dot(rel_velocity, normal)

            if vel_normal > 0:
                impulse = -(1 + self.restitution) * vel_normal
                ball.velocity += impulse * normal


def detect_collisions(balls: list[Ball]) -> list[tuple[int, int]]:
    """O(N²) pairwise collision detection."""
    collisions = []
    active_balls = [b for b in balls if b.active]

    for i in range(len(active_balls)):
        for j in range(i + 1, len(active_balls)):
            b1, b2 = active_balls[i], active_balls[j]
            dist = np.linalg.norm(b1.position - b2.position)
            if dist < b1.radius + b2.radius:
                collisions.append((b1.id, b2.id))

    return collisions


def resolve_collision(b1: Ball, b2: Ball) -> None:
    """Elastic collision with overlap separation."""
    if not b1.active or not b2.active:
        return

    displacement = b2.position - b1.position
    distance = np.linalg.norm(displacement)

    if distance == 0:
        return

    normal = displacement / distance
    overlap = (b1.radius + b2.radius) - distance

    if overlap > 0:
        separation = normal * (overlap / 2)
        b1.position -= separation
        b2.position += separation

    rel_velocity = b1.velocity - b2.velocity
    vel_along_normal = np.dot(rel_velocity, normal)

    if vel_along_normal < 0:
        return

    impulse = -2 * vel_along_normal / (b1.mass + b2.mass)
    b1.velocity += impulse * b2.mass * normal
    b2.velocity -= impulse * b1.mass * normal


class AirflowField:
    """Airflow simulation with Gaussian center-weight and height factor."""

    def __init__(
        self,
        power: float = 5.0,
        sigma: float = 0.3,
        perturbation: float = 0.1,
    ):
        self.power = power
        self.sigma = sigma
        self.perturbation = perturbation

    def gaussian_center_weight(self, position: np.ndarray, center: np.ndarray) -> float:
        """Gaussian center-weight function: exp(-d² / (2σ²))."""
        d_sq = np.sum((position - center) ** 2)
        return np.exp(-d_sq / (2 * self.sigma**2))

    def height_factor(self, position: np.ndarray, container_radius: float) -> float:
        """Height-dependent airflow factor (0.3 at bottom → 1.5 at top)."""
        normalized_y = (position[1] + container_radius) / (2 * container_radius)
        normalized_y = np.clip(normalized_y, 0.0, 1.0)
        return 0.3 + normalized_y * 1.2

    def compute_force(
        self, ball: Ball, container: Container, rng: np.random.Generator
    ) -> np.ndarray:
        """Compute total force on a ball: gravity + airflow + perturbation."""
        gravity = np.array([0.0, -9.8, 0.0])

        gaussian = self.gaussian_center_weight(ball.position, container.center)
        height_fac = self.height_factor(ball.position, container.radius)
        airflow_mag = gaussian * height_fac * self.power * 2.0
        airflow = np.array([0.0, airflow_mag, 0.0])

        perturbation_xz = rng.uniform(-self.perturbation, self.perturbation, 2)
        perturbation = np.array([perturbation_xz[0], 0.0, perturbation_xz[1]])

        return gravity + airflow + perturbation


def simulate_step(
    balls: list[Ball],
    container: Container,
    airflow: AirflowField,
    dt: float,
    rng: np.random.Generator,
) -> None:
    """Simulate one physics step with sub-stepping."""
    for ball in balls:
        if not ball.active:
            continue

        force = airflow.compute_force(ball, container, rng)
        acceleration = force / ball.mass
        ball.velocity += acceleration * dt
        ball.position += ball.velocity * dt
        container.boundary_collision(ball)

    collisions = detect_collisions(balls)
    ball_map = {b.id: b for b in balls}
    for id1, id2 in collisions:
        if id1 in ball_map and id2 in ball_map:
            resolve_collision(ball_map[id1], ball_map[id2])


def simulate_frame(
    balls: list[Ball],
    container: Container,
    airflow: AirflowField,
    dt: float = 1 / 60,
    substeps: int = 4,
    rng: Optional[np.random.Generator] = None,
) -> None:
    """Simulate one frame with sub-stepping."""
    if rng is None:
        rng = np.random.default_rng()

    sub_dt = dt / substeps
    for _ in range(substeps):
        simulate_step(balls, container, airflow, sub_dt, rng)
