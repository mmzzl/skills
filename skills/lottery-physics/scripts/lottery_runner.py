"""Lottery physics skill runner - extracts lottery logic from SKILL.md."""

import re
import subprocess
from typing import Optional


class LotteryPhysics:
    """Wrapper for the physics lottery simulation."""

    def __init__(self):
        self.base_path = "D:\\work\\skills"

    def parse_request(self, text: str) -> dict:
        """Parse natural language lottery request."""
        params = {
            "front_min": 1,
            "front_max": 35,
            "front_count": 5,
            "back_min": 1,
            "back_max": 12,
            "back_count": 2,
            "seed": None,
        }

        front_match = re.search(r"前区(\d+)-(\d+)选(\d+)", text)
        if front_match:
            params["front_min"] = int(front_match.group(1))
            params["front_max"] = int(front_match.group(2))
            params["front_count"] = int(front_match.group(3))

        back_match = re.search(r"后区(\d+)-(\d+)选(\d+)", text)
        if back_match:
            params["back_min"] = int(back_match.group(1))
            params["back_max"] = int(back_match.group(2))
            params["back_count"] = int(back_match.group(3))

        seed_match = re.search(r"seed[=:]?\s*(\d+)", text, re.IGNORECASE)
        if seed_match:
            params["seed"] = int(seed_match.group(1))

        return params

    def run_simulation(self, params: dict, timeout: int = 60) -> str:
        """Run the physics lottery simulation."""
        cmd = [
            "python",
            "-m",
            "physics_lottery.main",
            "--front-min",
            str(params["front_min"]),
            "--front-max",
            str(params["front_max"]),
            "--front-count",
            str(params["front_count"]),
            "--back-min",
            str(params["back_min"]),
            "--back-max",
            str(params["back_max"]),
            "--back-count",
            str(params["back_count"]),
        ]

        if params["seed"] is not None:
            cmd.extend(["--seed", str(params["seed"])])

        try:
            result = subprocess.run(
                cmd, cwd=self.base_path, capture_output=True, text=True, timeout=timeout
            )
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                return f"Error: {error_msg}"
        except subprocess.TimeoutExpired:
            return "Error: 模拟超时，请重试或使用不同参数"
        except Exception as e:
            return f"Error: {str(e)}"

    def format_output(self, result: str, params: dict) -> str:
        """Format simulation result for display."""
        if result.startswith("Error:"):
            return f"Error: {result}\n\nTip: Use format like '前区1-35选5，后区1-12选2'"

        if "|" in result:
            parts = result.split("|")
            front = parts[0].strip().replace("前区:", "LOTTERY 前区:")
            back = parts[1].strip().replace("后区:", "LOTTERY 后区:")
            return f"{front} | {back}"

        return result.replace("前区:", "LOTTERY 前区:")


def execute_lottery(request: str) -> str:
    """Main entry point for the skill."""
    lottery = LotteryPhysics()
    params = lottery.parse_request(request)
    result = lottery.run_simulation(params)
    return lottery.format_output(result, params)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        request = " ".join(sys.argv[1:])
    else:
        request = "前区1-35选5，后区1-12选2"

    result = execute_lottery(request)
    print(result)
