"""Lottery selection logic with dual-zone support."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from dataclasses import dataclass, field
from typing import Optional
import time

from physics import (
    Ball,
    Container,
    AirflowField,
    simulate_frame,
    detect_collisions,
    resolve_collision,
)


@dataclass
class LotteryConfig:
    """Configuration for lottery selection."""

    min_num: int
    max_num: int
    select_count: int
    ball_radius: float = 0.05
    container_radius: float = 1.0
    pipe_height: float = 0.9
    pipe_radius: float = 0.15
    substeps: int = 4
    dt: float = 1 / 60
    airflow_power: float = 15.0
    airflow_sigma: float = 0.5
    perturbation: float = 0.2
    timeout_per_ball: float = 10.0
    hard_timeout: float = 60.0
    max_retries: int = 3
    max_frames: int = 20000
    gravity: float = 9.8


class UnrecoverableError(Exception):
    """Exception raised when simulation cannot recover."""

    def __init__(
        self,
        message: str,
        seed: Optional[int] = None,
        ball_count: int = 0,
        airflow_params: Optional[dict] = None,
    ):
        super().__init__(message)
        self.seed = seed
        self.ball_count = ball_count
        self.airflow_params = airflow_params or {}


def create_lottery_balls(config: LotteryConfig, rng: np.random.Generator) -> list[Ball]:
    """Create balls with random initial positions in container."""
    balls = []
    container_half = config.container_radius - config.ball_radius

    for i in range(config.max_num):
        pos = rng.uniform(-container_half, container_half, 3)
        pos[1] = rng.uniform(-container_half * 0.8, container_half * 0.8)
        ball = Ball(ball_id=i + 1, position=pos, radius=config.ball_radius)
        balls.append(ball)

    return balls


def detect_pipe_ejection(ball: Ball, pipe_height: float, pipe_radius: float) -> bool:
    """Check if ball is in pipe ejection zone."""
    if not ball.active:
        return False

    in_height = ball.position[1] > pipe_height
    in_radius_x = abs(ball.position[0]) < pipe_radius
    in_radius_z = abs(ball.position[2]) < pipe_radius

    return in_height and in_radius_x and in_radius_z


class LotterySimulator:
    """Single-zone lottery simulator."""

    def __init__(self, config: LotteryConfig, seed: Optional[int] = None):
        self.config = config
        self.seed = seed if seed is not None else np.random.randint(0, 2**31)
        self.rng = np.random.default_rng(self.seed)

        self.balls = create_lottery_balls(config, self.rng)
        self.container = Container(
            center=np.array([0.0, 0.0, 0.0]),
            radius=config.container_radius,
            restitution=0.8,
        )
        self.airflow = AirflowField(
            power=config.airflow_power,
            sigma=config.airflow_sigma,
            perturbation=config.perturbation,
        )

        self.ejected_balls = []
        self.last_eject_time = 0.0
        self.current_power = config.airflow_power
        self.frame_count = 0

    def run(self) -> list[int]:
        """Run simulation until all balls selected or timeout."""
        selected = []
        start_time = time.time()

        while (
            len(selected) < self.config.select_count
            and self.frame_count < self.config.max_frames
        ):
            simulate_frame(
                self.balls,
                self.container,
                self.airflow,
                dt=self.config.dt,
                substeps=self.config.substeps,
                rng=self.rng,
            )
            self.frame_count += 1

            for ball in self.balls:
                if ball.active and detect_pipe_ejection(
                    ball, self.config.pipe_height, self.config.pipe_radius
                ):
                    ball.active = False
                    self.ejected_balls.append(ball.id)
                    selected.append(ball.id)
                    self.last_eject_time = time.time()
                    self.current_power = self.config.airflow_power
                    break

            elapsed = time.time() - start_time
            if self.frame_count % 60 == 0:
                if elapsed - self.last_eject_time > self.config.timeout_per_ball:
                    self.current_power *= 1.2
                    self.airflow.power = self.current_power
                    self.last_eject_time = elapsed

                if elapsed > self.config.hard_timeout:
                    raise UnrecoverableError(
                        f"Hard timeout exceeded: {self.config.hard_timeout}s",
                        seed=self.seed,
                        ball_count=len([b for b in self.balls if b.active]),
                        airflow_params={
                            "power": self.airflow.power,
                            "sigma": self.airflow.sigma,
                            "perturbation": self.airflow.perturbation,
                        },
                    )

        if len(selected) < self.config.select_count:
            remaining = [b.id for b in self.balls if b.active]
            fallback = list(
                self.rng.choice(
                    remaining, self.config.select_count - len(selected), replace=False
                )
            )
            selected.extend([int(x) for x in fallback])

        return sorted([int(x) for x in selected])


class LotteryRunner:
    """Dual-zone lottery runner."""

    def __init__(self, seed: Optional[int] = None):
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def run(
        self,
        front_config: LotteryConfig,
        back_config: Optional[LotteryConfig] = None,
    ) -> tuple[list[int], list[int]]:
        """Run dual-zone lottery simulation."""
        front_sim = LotterySimulator(front_config, seed=self.rng.integers(0, 2**31))
        front_result = front_sim.run()

        back_result = []
        if back_config is not None:
            back_sim = LotterySimulator(back_config, seed=self.rng.integers(0, 2**31))
            back_result = back_sim.run()

        return front_result, back_result


def run_lottery(
    front_range: tuple[int, int],
    front_count: int,
    back_range: Optional[tuple[int, int]] = None,
    back_count: int = 0,
    seed: Optional[int] = None,
) -> tuple[list[int], list[int]]:
    """Convenience function to run lottery with given parameters."""
    front_config = LotteryConfig(
        min_num=front_range[0],
        max_num=front_range[1],
        select_count=front_count,
    )

    back_config = None
    if back_range is not None and back_count > 0:
        back_config = LotteryConfig(
            min_num=back_range[0],
            max_num=back_range[1],
            select_count=back_count,
        )

    runner = LotteryRunner(seed=seed)
    return runner.run(front_config, back_config)
