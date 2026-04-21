import argparse, pathlib, urllib.request
from collections import defaultdict

DATA_URL = "https://data.17500.cn/dlt_asc.txt"
CACHE_PATH = pathlib.Path("~/.cache/lottery_predictor.txt").expanduser()

def download_data():
    """Download and parse lottery data, return list of draws (7 ints each).
    Handles HTTP 429 by retrying with backoff and falls back to cached file if present.
    """
    import time
    # Ensure we have a cache directory
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Try downloading with simple retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            if not CACHE_PATH.exists():
                with urllib.request.urlopen(DATA_URL) as resp, open(CACHE_PATH, "wb") as out:
                    out.write(resp.read())
            break  # succeeded
        except Exception as e:
            # Any network error (including HTTP 429) – wait and retry
            wait = 2 ** attempt
            print(f"Network error ({e}), retry {attempt}/{max_retries} after {wait}s")
            time.sleep(wait)
            # continue to next attempt (do not break)
            continue
    # Load from cache (may be newly downloaded or existing)
    draws = []
    MIN_DATA = 50  # Minimum number of draws needed for a reliable ML model
    try:
        # Attempt to read existing cache
        with open(CACHE_PATH, "r", encoding="utf-8-sig") as f:
            for line in f:
                tokens = [t for t in line.replace(",", " ").split() if t]
                if len(tokens) == 7:
                    try:
                        draws.append([int(tok) for tok in tokens])
                    except ValueError:
                        continue
                    continue
                if len(tokens) < 9:
                    continue
                number_tokens = []
                for tok in tokens[2:]:
                    if len(number_tokens) >= 7:
                        break
                    try:
                        number_tokens.append(int(tok))
                    except ValueError:
                        break
                if len(number_tokens) == 7:
                    draws.append(number_tokens)
        # If cache is insufficient, re‑download full history
        if len(draws) < MIN_DATA:
            raise FileNotFoundError
    except FileNotFoundError:
        # Either cache missing or not enough data – fetch the full dataset
        print("Downloading full lottery history (may take a moment).")
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        import urllib.request, time
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                with urllib.request.urlopen(DATA_URL) as resp, open(CACHE_PATH, "wb") as out:
                    out.write(resp.read())
                break
            except Exception as e:
                wait = 2 ** attempt
                print(f"Network error ({e}), retry {attempt}/{max_retries} after {wait}s")
                time.sleep(wait)
                continue
        # Parse the newly downloaded file
        draws = []
        with open(CACHE_PATH, "r", encoding="utf-8-sig") as f:
            for line in f:
                tokens = [t for t in line.replace(",", " ").split() if t]
                if len(tokens) == 7:
                    try:
                        draws.append([int(tok) for tok in tokens])
                    except ValueError:
                        continue
                    continue
                if len(tokens) < 9:
                    continue
                number_tokens = []
                for tok in tokens[2:]:
                    if len(number_tokens) >= 7:
                        break
                    try:
                        number_tokens.append(int(tok))
                    except ValueError:
                        break
                if len(number_tokens) == 7:
                    draws.append(number_tokens)
        # If still insufficient, fall back to built‑in sample data
        if len(draws) < MIN_DATA:
            print("Using built‑in fallback data (no network or insufficient history).")
            draws = [
                [22, 24, 29, 31, 35, 4, 11],
                [15, 22, 31, 34, 35, 5, 12],
                [3, 4, 18, 23, 32, 1, 6],
                [6, 10, 16, 17, 25, 2, 4],
                [1, 9, 19, 20, 30, 2, 11],
                [1, 16, 20, 23, 28, 3, 6],
                [14, 16, 25, 26, 35, 4, 9],
                [2, 8, 11, 21, 23, 4, 7],
                [1, 3, 9, 19, 34, 9, 12],
                [6, 8, 18, 29, 34, 9, 11],
                [29, 32, 33, 34, 35, 9, 10],
                [3, 12, 15, 29, 34, 7, 11],
                [12, 17, 27, 29, 34, 6, 9],
                [1, 2, 7, 29, 32, 6, 7],
                [2, 8, 12, 13, 17, 11, 12],
                [5, 11, 22, 34, 35, 2, 5],
                [4, 5, 14, 25, 30, 8, 10],
                [3, 6, 16, 19, 23, 1, 4],
                [9, 13, 18, 28, 32, 2, 5],
                [10, 22, 24, 31, 33, 3, 8],
            ]
            # Overwrite cache with fallback for future runs
            with open(CACHE_PATH, "w", encoding="utf-8-sig") as out:
                for d in draws:
                    out.write(" ".join(str(n) for n in d) + "\n")
    return draws
        else:
            raise FileNotFoundError
    except FileNotFoundError:
        # Fallback: use a larger built‑in sample dataset (extracted from known historical lines)
        print("Using built-in fallback data (no network or insufficient cache).")
        draws = [
            [22, 24, 29, 31, 35, 4, 11],
            [15, 22, 31, 34, 35, 5, 12],
            [3, 4, 18, 23, 32, 1, 6],
            [6, 10, 16, 17, 25, 2, 4],
            [1, 9, 19, 20, 30, 2, 11],
            [1, 16, 20, 23, 28, 3, 6],
            [14, 16, 25, 26, 35, 4, 9],
            [2, 8, 11, 21, 23, 4, 7],
            [1, 3, 9, 19, 34, 9, 12],
            [6, 8, 18, 29, 34, 9, 11],
            [29, 32, 33, 34, 35, 9, 10],
            [3, 12, 15, 29, 34, 7, 11],
            [12, 17, 27, 29, 34, 6, 9],
            [1, 2, 7, 29, 32, 6, 7],
            [2, 8, 12, 13, 17, 11, 12],
            [5, 11, 22, 34, 35, 2, 5],
            [4, 5, 14, 25, 30, 8, 10],
            [3, 6, 16, 19, 23, 1, 4],
            [9, 13, 18, 28, 32, 2, 5],
            [10, 22, 24, 31, 33, 3, 8],
        ]
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_PATH, "w", encoding="utf-8-sig") as out:
            for d in draws:
                out.write(" ".join(str(n) for n in d) + "\n")
        return draws

    # If we successfully read the file but got no valid draws, fall back to built‑in data
    if not draws:
        print("Using built‑in fallback data (no network).")
        draws = [
            [22, 24, 29, 31, 35, 4, 11],
            [15, 22, 31, 34, 35, 5, 12],
            [3, 4, 18, 23, 32, 1, 6],
            [6, 10, 16, 17, 25, 2, 4],
            [1, 9, 19, 20, 30, 2, 11],
            [1, 16, 20, 23, 28, 3, 6],
            [14, 16, 25, 26, 35, 4, 9],
            [2, 8, 11, 21, 23, 4, 7],
            [1, 3, 9, 19, 34, 9, 12],
            [6, 8, 18, 29, 34, 9, 11],
            [29, 32, 33, 34, 35, 9, 10],
            [3, 12, 15, 29, 34, 7, 11],
            [12, 17, 27, 29, 34, 6, 9],
            [1, 2, 7, 29, 32, 6, 7],
            [2, 8, 12, 13, 17, 11, 12],
            [5, 11, 22, 34, 35, 2, 5],
            [4, 5, 14, 25, 30, 8, 10],
            [3, 6, 16, 19, 23, 1, 4],
            [9, 13, 18, 28, 32, 2, 5],
            [10, 22, 24, 31, 33, 3, 8],
        ]
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_PATH, "w", encoding="utf-8-sig") as out:
            for d in draws:
                out.write(" ".join(str(n) for n in d) + "\n")
    return draws

def build_position_maps(draws):
    maps = [defaultdict(int) for _ in range(7)]
    for draw in draws:
        for pos, num in enumerate(draw):
            maps[pos][num] += 1
    return maps

def predict_next_draw(draws, history_limit=None, exclude_history=1, exclude_red=30, exclude_blue=10, use_ml=False):
    """Predict next draw.

    Args:
        draws: list of draws (each a list of 7 ints).
        history_limit: limit for frequency weighting (None => all draws).
        exclude_history: number of recent draws to aggregate for exclusion.
        exclude_red: maximum total red numbers to exclude (positions 1‑5).
        exclude_blue: maximum total blue numbers to exclude (positions 6‑7).
        use_ml: if True, use a trained RandomForest model (requires scikit‑learn).
    """
    recent = draws[-1]
    # If we don't have enough historical data, fall back to the classic frequency method
    MIN_DATA = 50  # arbitrary threshold for a reasonable ML model
    if use_ml and len(draws) >= MIN_DATA:
        # Machine‑learning prediction path
        import joblib
        model_path = CACHE_PATH.parent / "rf_models.joblib"
        if not model_path.exists():
            # Train models on all historical data (except the last draw which is target)
            import pandas as pd
            import numpy as np
            from sklearn.ensemble import RandomForestClassifier
            X = []
            y = [[] for _ in range(7)]
            for i in range(len(draws) - 1):
                X.append(draws[i])
                nxt = draws[i + 1]
                for pos in range(7):
                    y[pos].append(nxt[pos])
            X = np.array(X)
            models = []
            for pos in range(7):
                clf = RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=-1)
                clf.fit(X, y[pos])
                models.append(clf)
            # Save the list of models
            joblib.dump(models, model_path)
        else:
            models = joblib.load(model_path)
        # Predict next draw using the last draw as input; also compute probability distribution
        X_last = np.array([recent])
        pred = []
        prob_candidates = []
        for clf in models:
            pred.append(int(clf.predict(X_last)[0]))
            probs = clf.predict_proba(X_last)[0]
            prob_dict = {int(cls): float(p) for cls, p in zip(clf.classes_, probs)}
            prob_candidates.append(prob_dict)
        return recent, [set() for _ in range(7)], prob_candidates
    # ---- Frequency‑based path (fallback) ----
    # Build exclusion sets from the last `exclude_history` draws (cap to available draws)
    exclude_draws = draws[-exclude_history:] if exclude_history <= len(draws) else draws
    exclusions = [set() for _ in range(7)]
    for d in exclude_draws:
        for pos, num in enumerate(d):
            exclusions[pos].add(num)
    # Ensure we don't exclude *all* possible numbers for any position
    for pos in range(7):
        if pos < 5:
            all_nums = set(range(1, 36))  # red balls range
        else:
            all_nums = set(range(1, 13))  # blue balls range
        if exclusions[pos] >= all_nums:
            exclusions[pos] = set()
    # Cap red exclusions to `exclude_red`
    red_total = sum(len(exclusions[pos]) for pos in range(5))
    if red_total > exclude_red:
        kept = 0
        new_exclusions = [set() for _ in range(7)]
        for pos in range(5):
            for n in sorted(exclusions[pos]):
                if kept < exclude_red:
                    new_exclusions[pos].add(n)
                    kept += 1
                else:
                    break
        for pos in range(5, 7):
            new_exclusions[pos] = exclusions[pos]
        exclusions = new_exclusions
    # Cap blue exclusions to `exclude_blue`
    blue_total = sum(len(exclusions[pos]) for pos in range(5, 7))
    if blue_total > exclude_blue:
        kept = 0
        new_exclusions = [set() for _ in range(7)]
        for pos in range(5, 7):
            for n in sorted(exclusions[pos]):
                if kept < exclude_blue:
                    new_exclusions[pos].add(n)
                    kept += 1
                else:
                    break
        for pos in range(5):
            new_exclusions[pos] = exclusions[pos]
        exclusions = new_exclusions
    # Frequency weighting (as before)
    considered = draws[-history_limit:] if history_limit else draws
    maps = build_position_maps(considered)
    candidates = []
    for pos in range(7):
        freq = dict(maps[pos])
        for ex in exclusions[pos]:
            freq.pop(ex, None)
        # If exclusions removed all numbers, fall back to full frequency map
        if not freq:
            freq = dict(maps[pos])
        total = sum(freq.values()) or 1
        candidates.append({n: cnt/total for n, cnt in freq.items()})
    return recent, exclusions, candidates

def format_output(recent, exclusions, candidates, show_probs=False):
    lines = [f"最近一期: {' '.join(f'{n:02d}' for n in recent)}", "每个位排除:"]
    for i, ex in enumerate(exclusions, 1):
        lines.append(f"  第{i}位: {sorted(ex)}")
    if show_probs:
        lines.append("每个位概率分布 (号码 -> 概率):")
        for i, cand in enumerate(candidates, 1):
            line = ", ".join(f"{n:02d}:{p:.3f}" for n, p in sorted(cand.items()))
            lines.append(f"  第{i}位: {line}")
    else:
        suggestion = [max(cand, key=cand.get) for cand in candidates]
        lines.append("建议下一期: " + " ".join(f"{n:02d}" for n in suggestion))
    return "\n".join(lines)

def main():
    p = argparse.ArgumentParser(description="Lottery predictor")
    p.add_argument("--probabilities", action="store_true")
    p.add_argument("--history", type=int, default=None, help="limit frequency weighting to last N draws")
    p.add_argument("--exclude-history", type=int, default=1, help="number of recent draws to aggregate for exclusion")
    p.add_argument("--exclude-red", type=int, default=30, help="max total red numbers to exclude (positions 1‑5)")
    p.add_argument("--exclude-blue", type=int, default=10, help="max total blue numbers to exclude (positions 6‑7)")
    p.add_argument("--ml", action="store_true", help="use RandomForest model for prediction (requires scikit-learn)")
    args = p.parse_args()
    draws = download_data()
    print(f"Loaded {len(draws) if draws else 0} draws")
    recent, exclusions, candidates = predict_next_draw(
        draws,
        args.history,
        args.exclude_history,
        args.exclude_red,
        args.exclude_blue,
        use_ml=args.ml,
    )
    print(format_output(recent, exclusions, candidates, show_probs=args.probabilities))

if __name__ == "__main__":
    main()
