package main

import (
	"fmt"
	"math/rand"
	"runtime"
	"sort"
	"sync"
)

const populationSize = 2000
const generations = 100000
const targetCount = 20_000_000
const mutateRate = 0.05
const tournamentK = 3

func tournamentSelect(population [][]int, fitnesses []float64, rng *rand.Rand) []int {
	bestIdx := -1
	bestFit := -1.0
	for i := 0; i < tournamentK; i++ {
		idx := rng.Intn(len(population))
		if fitnesses[idx] > bestFit {
			bestFit = fitnesses[idx]
			bestIdx = idx
		}
	}
	result := make([]int, 7)
	copy(result, population[bestIdx])
	return result
}

func crossover(p1, p2 []int, rng *rand.Rand) ([]int, []int) {
	redC1, redC2 := orderCrossover(p1[:5], p2[:5], rng)
	blueC1, blueC2 := orderCrossover(p1[5:], p2[5:], rng)
	sort.Ints(redC1)
	sort.Ints(redC2)
	sort.Ints(blueC1)
	sort.Ints(blueC2)
	c1 := append(redC1, blueC1...)
	c2 := append(redC2, blueC2...)
	return c1, c2
}

func orderCrossover(a, b []int, rng *rand.Rand) ([]int, []int) {
	n := len(a)
	if n <= 1 {
		c1 := make([]int, n)
		c2 := make([]int, n)
		copy(c1, a)
		copy(c2, b)
		return c1, c2
	}

	positions := rng.Perm(n)
	cut1 := positions[0]
	cut2 := positions[1]
	if cut1 > cut2 {
		cut1, cut2 = cut2, cut1
	}

	child1 := make([]int, n)
	child2 := make([]int, n)
	for i := range child1 {
		child1[i] = -1
		child2[i] = -1
	}

	set1 := make(map[int]bool)
	set2 := make(map[int]bool)
	for i := cut1; i <= cut2; i++ {
		child1[i] = a[i]
		child2[i] = b[i]
		set1[a[i]] = true
		set2[b[i]] = true
	}

	rem1 := make([]int, 0)
	rem2 := make([]int, 0)
	for _, x := range b {
		if !set1[x] {
			rem1 = append(rem1, x)
		}
	}
	for _, x := range a {
		if !set2[x] {
			rem2 = append(rem2, x)
		}
	}

	idx1, idx2 := 0, 0
	for i := 0; i < n; i++ {
		if child1[i] == -1 {
			child1[i] = rem1[idx1]
			idx1++
		}
		if child2[i] == -1 {
			child2[i] = rem2[idx2]
			idx2++
		}
	}

	return child1, child2
}

func mutate(individual []int, posFreq PositionFreq, rng *rand.Rand) []int {
	newInd := make([]int, 7)
	copy(newInd, individual)

	for i := 0; i < 7; i++ {
		if rng.Float64() < mutateRate {
			if len(posFreq[i]) > 0 {
				sample := weightedSample(posFreq[i], 1, rng)
				newInd[i] = sample[0]
			}
		}
	}

	reds := uniqueSorted(newInd[:5])
	blues := uniqueSorted(newInd[5:])

	for len(reds) < 5 {
		pick := rng.Intn(35) + 1
		for containsInt(reds, pick) {
			pick = rng.Intn(35) + 1
		}
		reds = append(reds, pick)
	}
	for len(blues) < 2 {
		pick := rng.Intn(12) + 1
		for containsInt(blues, pick) {
			pick = rng.Intn(12) + 1
		}
		blues = append(blues, pick)
	}

	sort.Ints(reds)
	sort.Ints(blues)
	result := make([]int, 7)
	copy(result[:5], reds[:5])
	copy(result[5:], blues[:2])
	return result
}

func runGA(posFreq PositionFreq) ([][]int, *sync.Map, *rand.Rand) {
	fmt.Printf("\n初始化种群: %d (并发 workers: %d)\n", populationSize, runtime.NumCPU())

	source := rand.NewSource(42)
	rng := rand.New(source)

	population := make([][]int, populationSize)
	for i := range population {
		population[i] = generateIndividual(posFreq, rng)
	}

	seen := &sync.Map{}
	for _, ind := range population {
		key := uniqueKey(ind)
		seen.Store(key, true)
	}

	var pool [][]int
	eliteCount := populationSize / 20
	if eliteCount < 1 {
		eliteCount = 1
	}

	progressTicks := generations / 20
	if progressTicks < 1 {
		progressTicks = 1
	}

	numWorkers := runtime.NumCPU()
	if numWorkers > 8 {
		numWorkers = 8
	}

	for gen := 0; gen < generations; gen++ {
		fitnesses := parallelFitness(population, posFreq, numWorkers)

		type indexed struct {
			idx int
			ind []int
			fit float64
		}
		sorted := make([]indexed, len(population))
		for i, ind := range population {
			sorted[i] = indexed{i, ind, fitnesses[i]}
		}
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].fit > sorted[j].fit
		})

		newPopulation := make([][]int, 0, populationSize)
		for j := 0; j < eliteCount; j++ {
			ind := make([]int, 7)
			copy(ind, sorted[j].ind)
			newPopulation = append(newPopulation, ind)
		}

		for len(newPopulation) < populationSize {
			p1 := tournamentSelect(population, fitnesses, rng)
			p2 := tournamentSelect(population, fitnesses, rng)
			c1, c2 := crossover(p1, p2, rng)
			c1 = mutate(c1, posFreq, rng)
			c2 = mutate(c2, posFreq, rng)
			newPopulation = append(newPopulation, c1)
			if len(newPopulation) < populationSize {
				newPopulation = append(newPopulation, c2)
			}
		}

		population = newPopulation[:populationSize]

		for _, ind := range population {
			key := uniqueKey(ind)
			if _, ok := seen.Load(key); !ok {
				seen.Store(key, true)
				pool = append(pool, ind)
			}
		}

		if gen%progressTicks == 0 || gen == generations-1 {
			pct := (gen + 1) * 20 / generations
			if pct > 20 {
				pct = 20
			}
			bar := ""
			for i := 0; i < pct; i++ {
				bar += "="
			}
			for i := pct; i < 20; i++ {
				bar += "-"
			}
			fmt.Printf("\r  [%s] 第 %d/%d 代, 已收集: %d 组", bar, gen+1, generations, len(pool))
		}
	}
	fmt.Println()

	return pool, seen, rng
}

func parallelFitness(population [][]int, posFreq PositionFreq, numWorkers int) []float64 {
	n := len(population)
	fitnesses := make([]float64, n)

	if numWorkers > n {
		numWorkers = n
	}

	chunkSize := (n + numWorkers - 1) / numWorkers
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		start := w * chunkSize
		end := start + chunkSize
		if end > n {
			end = n
		}
		if start >= end {
			continue
		}

		wg.Add(1)
		go func(start, end int) {
			defer wg.Done()
			for i := start; i < end; i++ {
				fitnesses[i] = fitness(population[i], posFreq)
			}
		}(start, end)
	}

	wg.Wait()
	return fitnesses
}

func fillToTarget(pool [][]int, seen *sync.Map, posFreq PositionFreq, rng *rand.Rand) [][]int {
	for len(pool) < targetCount {
		ind := generateIndividual(posFreq, rng)
		key := uniqueKey(ind)
		if _, ok := seen.Load(key); !ok {
			seen.Store(key, true)
			pool = append(pool, ind)
		}
	}
	if len(pool) > targetCount {
		pool = pool[:targetCount]
	}
	return pool
}
