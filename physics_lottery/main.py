"""CLI entry point for physical lottery simulator."""

import sys
import os

# Add parent directory to path for module imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import argparse

from lottery import (
    LotteryConfig,
    LotteryRunner,
    UnrecoverableError,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Physical Lottery Simulator - 3D physics-based lottery ball selection"
    )
    parser.add_argument(
        "--front-min", type=int, default=1, help="Front zone minimum number"
    )
    parser.add_argument(
        "--front-max", type=int, default=35, help="Front zone maximum number"
    )
    parser.add_argument(
        "--front-count", type=int, default=5, help="Front zone selection count"
    )
    parser.add_argument(
        "--back-min", type=int, default=1, help="Back zone minimum number"
    )
    parser.add_argument(
        "--back-max", type=int, default=12, help="Back zone maximum number"
    )
    parser.add_argument(
        "--back-count", type=int, default=2, help="Back zone selection count"
    )
    parser.add_argument(
        "--seed", type=int, default=None, help="Random seed for reproducibility"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    front_config = LotteryConfig(
        min_num=args.front_min,
        max_num=args.front_max,
        select_count=args.front_count,
    )

    back_config = None
    if args.back_count > 0:
        back_config = LotteryConfig(
            min_num=args.back_min,
            max_num=args.back_max,
            select_count=args.back_count,
        )

    try:
        runner = LotteryRunner(seed=args.seed)
        front_result, back_result = runner.run(front_config, back_config)

        print(f"前区: {front_result} | 后区: {back_result}")
        return 0

    except UnrecoverableError as e:
        print(f"Error: {e}", file=sys.stderr)
        if e.seed:
            print(f"Seed: {e.seed}", file=sys.stderr)
        if e.ball_count:
            print(f"Active balls: {e.ball_count}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
