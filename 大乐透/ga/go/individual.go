package main

import (
	"math/rand"
	"sort"
)

func weightedSample(freq map[int]int, k int, rng *rand.Rand) []int {
	items := make([]int, 0, len(freq))
	weights := make([]float64, 0, len(freq))
	for num, cnt := range freq {
		items = append(items, num)
		weights = append(weights, float64(cnt))
	}
	result := make([]int, 0, k)
	for i := 0; i < k; i++ {
		result = append(result, items[weightedChoice(weights, rng)])
	}
	return result
}

func weightedChoice(weights []float64, rng *rand.Rand) int {
	total := 0.0
	for _, w := range weights {
		total += w
	}
	r := rng.Float64() * total
	sum := 0.0
	for i, w := range weights {
		sum += w
		if r <= sum {
			return i
		}
	}
	return len(weights) - 1
}

func generateIndividual(posFreq PositionFreq, rng *rand.Rand) []int {
	redCandidates := make([]int, 0, 5)
	for i := 0; i < 5; i++ {
		sample := weightedSample(posFreq[i], 1, rng)
		redCandidates = append(redCandidates, sample[0])
	}

	reds := uniqueSorted(redCandidates)
	for len(reds) < 5 {
		missing := redMissing(reds)
		allFreq := missingFreq(posFreq, missing, 0, 5)
		if len(allFreq) > 0 {
			pick := weightedSample(allFreq, 1, rng)
			reds = append(reds, pick[0])
		} else {
			pick := rng.Intn(35) + 1
			for containsInt(reds, pick) {
				pick = rng.Intn(35) + 1
			}
			reds = append(reds, pick)
		}
		sort.Ints(reds)
	}

	blueCandidates := make([]int, 0, 2)
	for i := 5; i < 7; i++ {
		sample := weightedSample(posFreq[i], 1, rng)
		blueCandidates = append(blueCandidates, sample[0])
	}

	blues := uniqueSorted(blueCandidates)
	for len(blues) < 2 {
		missing := blueMissing(blues)
		allFreq := missingFreq(posFreq, missing, 5, 7)
		if len(allFreq) > 0 {
			pick := weightedSample(allFreq, 1, rng)
			blues = append(blues, pick[0])
		} else {
			pick := rng.Intn(12) + 1
			for containsInt(blues, pick) {
				pick = rng.Intn(12) + 1
			}
			blues = append(blues, pick)
		}
		sort.Ints(blues)
	}

	return append(reds[:5], blues[:2]...)
}

func uniqueSorted(nums []int) []int {
	seen := make(map[int]bool)
	result := make([]int, 0, len(nums))
	for _, n := range nums {
		if !seen[n] {
			seen[n] = true
			result = append(result, n)
		}
	}
	sort.Ints(result)
	return result
}

func redMissing(reds []int) []int {
	redSet := make(map[int]bool)
	for _, r := range reds {
		redSet[r] = true
	}
	var missing []int
	for i := 1; i <= 35; i++ {
		if !redSet[i] {
			missing = append(missing, i)
		}
	}
	return missing
}

func blueMissing(blues []int) []int {
	blueSet := make(map[int]bool)
	for _, b := range blues {
		blueSet[b] = true
	}
	var missing []int
	for i := 1; i <= 12; i++ {
		if !blueSet[i] {
			missing = append(missing, i)
		}
	}
	return missing
}

func missingFreq(posFreq PositionFreq, missing []int, start, end int) map[int]int {
	missingSet := make(map[int]bool)
	for _, m := range missing {
		missingSet[m] = true
	}
	allFreq := make(map[int]int)
	for i := start; i < end; i++ {
		for num, cnt := range posFreq[i] {
			if missingSet[num] {
				allFreq[num] += cnt
			}
		}
	}
	return allFreq
}

func fitness(individual []int, posFreq PositionFreq) float64 {
	var score float64
	for i := 0; i < 7; i++ {
		freq := float64(posFreq[i][individual[i]])
		total := float64(posFreqTotal(posFreq[i]))
		if total > 0 {
			score += freq / total
		}
	}
	return score
}
