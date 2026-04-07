"""Unit tests for physical lottery simulator."""

import numpy as np
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from physics_lottery.physics import (
    Ball,
    Container,
    detect_collisions,
    resolve_collision,
    AirflowField,
    simulate_step,
)
from physics_lottery.lottery import (
    LotteryConfig,
    detect_pipe_ejection,
    LotterySimulator,
    LotteryRunner,
    UnrecoverableError,
)


class TestBallToBallCollision:
    def test_velocity_exchange(self):
        """Verify elastic collision exchanges velocities."""
        b1 = Ball(
            ball_id=1,
            position=np.array([0.0, 0.0, 0.0]),
            velocity=np.array([1.0, 0.0, 0.0]),
            radius=0.5,
        )
        b2 = Ball(
            ball_id=2,
            position=np.array([0.9, 0.0, 0.0]),
            velocity=np.array([-1.0, 0.0, 0.0]),
            radius=0.5,
        )

        resolve_collision(b1, b2)

        assert b1.velocity[0] < 0
        assert b2.velocity[0] > 0

    def test_overlap_separation(self):
        """Verify overlapping balls are separated."""
        b1 = Ball(
            ball_id=1,
            position=np.array([0.0, 0.0, 0.0]),
            velocity=np.zeros(3),
            radius=0.5,
        )
        b2 = Ball(
            ball_id=2,
            position=np.array([0.5, 0.0, 0.0]),
            velocity=np.zeros(3),
            radius=0.5,
        )

        resolve_collision(b1, b2)

        dist = np.linalg.norm(b1.position - b2.position)
        assert dist >= b1.radius + b2.radius - 0.01


class TestContainerBoundaryCollision:
    def test_reflection(self):
        """Verify boundary collision reflects velocity."""
        container = Container(center=np.zeros(3), radius=1.0, restitution=0.8)
        ball = Ball(
            ball_id=1,
            position=np.array([0.0, 0.95, 0.0]),
            velocity=np.array([0.0, 1.0, 0.0]),
            radius=0.05,
        )

        container.boundary_collision(ball)

        assert ball.velocity[1] < 0

    def test_position_correction(self):
        """Verify ball position is corrected after boundary collision."""
        container = Container(center=np.zeros(3), radius=1.0, restitution=0.8)
        ball = Ball(
            ball_id=1,
            position=np.array([0.0, 1.05, 0.0]),
            velocity=np.array([0.0, 1.0, 0.0]),
            radius=0.05,
        )

        container.boundary_collision(ball)

        assert np.linalg.norm(ball.position) < container.radius - ball.radius


class TestPipeEjection:
    def test_ejection_detection(self):
        """Verify pipe ejection is detected correctly."""
        ball_in_pipe = Ball(ball_id=1, position=np.array([0.0, 0.95, 0.0]), radius=0.05)
        ball_outside = Ball(ball_id=2, position=np.array([0.5, 0.5, 0.0]), radius=0.05)

        assert (
            detect_pipe_ejection(ball_in_pipe, pipe_height=0.9, pipe_radius=0.1) == True
        )
        assert (
            detect_pipe_ejection(ball_outside, pipe_height=0.9, pipe_radius=0.1)
            == False
        )

    def test_inactive_ball_not_ejected(self):
        """Verify inactive balls are not detected as ejected."""
        ball = Ball(ball_id=1, position=np.array([0.0, 0.95, 0.0]), radius=0.05)
        ball.active = False

        assert detect_pipe_ejection(ball, pipe_height=0.9, pipe_radius=0.1) is False


class TestIntegration:
    def test_deterministic_output(self):
        """Verify deterministic output with fixed seed."""
        config = LotteryConfig(min_num=1, max_num=10, select_count=3)
        sim1 = LotterySimulator(config, seed=42)
        result1 = sim1.run()

        sim2 = LotterySimulator(config, seed=42)
        result2 = sim2.run()

        assert result1 == result2

    def test_dual_zone_correct_count(self):
        """Verify dual-zone lottery produces correct number of results."""
        runner = LotteryRunner(seed=123)
        front_config = LotteryConfig(min_num=1, max_num=10, select_count=3)
        back_config = LotteryConfig(min_num=1, max_num=5, select_count=2)

        front_result, back_result = runner.run(front_config, back_config)

        assert len(front_result) == 3
        assert len(back_result) == 2

    def test_randomness_distribution(self):
        """Verify randomness distribution across multiple runs."""
        results = []
        for _ in range(10):
            config = LotteryConfig(min_num=1, max_num=15, select_count=3)
            sim = LotterySimulator(config)
            result = sim.run()
            results.append(tuple(result))

        unique_results = set(results)
        assert len(unique_results) > 1, "Should produce different results"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
