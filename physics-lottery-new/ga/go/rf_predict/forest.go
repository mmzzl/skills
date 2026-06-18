package main

import (
	"fmt"
	"math/rand"
	"runtime"
	"sync"
)

type RandomForest struct {
	Trees          []*DecisionTree
	NumTrees       int
	MaxDepth       int
	MinSamplesLeaf int
	NumClasses     int
	FeatureSubset  []int
}

func NewRandomForest(numTrees, maxDepth, minSamplesLeaf, numClasses int) *RandomForest {
	return &RandomForest{
		NumTrees:       numTrees,
		MaxDepth:       maxDepth,
		MinSamplesLeaf: minSamplesLeaf,
		NumClasses:     numClasses,
	}
}

func (rf *RandomForest) Fit(X [][]float64, y []int) {
	n := len(X)
	if n == 0 {
		return
	}
	numFeatures := len(X[0])

	allFeatures := make([]int, numFeatures)
	for i := 0; i < numFeatures; i++ {
		allFeatures[i] = i
	}
	rf.FeatureSubset = allFeatures

	rf.Trees = make([]*DecisionTree, rf.NumTrees)

	numWorkers := runtime.NumCPU()
	if numWorkers > rf.NumTrees {
		numWorkers = rf.NumTrees
	}
	ch := make(chan int, rf.NumTrees)
	for i := 0; i < rf.NumTrees; i++ {
		ch <- i
	}
	close(ch)

	var mu sync.Mutex
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for treeIdx := range ch {
				rng := rand.New(rand.NewSource(int64(treeIdx*137 + 42)))

				bootX, bootY := bootstrapSample(X, y, rng)

				tree := NewDecisionTree(rf.MaxDepth, rf.MinSamplesLeaf, rf.NumClasses, numFeatures)
				tree.Fit(bootX, bootY, rf.FeatureSubset, rng)

				mu.Lock()
				rf.Trees[treeIdx] = tree
				mu.Unlock()

				if treeIdx%10 == 0 || treeIdx == rf.NumTrees-1 {
					fmt.Printf("\r  训练树 %d/%d", treeIdx+1, rf.NumTrees)
				}
			}
		}()
	}
	wg.Wait()
	fmt.Printf("\r  训练完成 %d 棵决策树\n", rf.NumTrees)
}

func bootstrapSample(X [][]float64, y []int, rng *rand.Rand) ([][]float64, []int) {
	n := len(X)
	bootX := make([][]float64, n)
	bootY := make([]int, n)
	for i := 0; i < n; i++ {
		idx := rng.Intn(n)
		row := make([]float64, len(X[idx]))
		copy(row, X[idx])
		bootX[i] = row
		bootY[i] = y[idx]
	}
	return bootX, bootY
}

func (rf *RandomForest) Predict(x []float64) int {
	votes := make([]int, rf.NumClasses)
	for _, tree := range rf.Trees {
		pred := tree.Predict(x)
		votes[pred]++
	}

	best := 0
	bestCount := 0
	for cls, cnt := range votes {
		if cnt > bestCount {
			bestCount = cnt
			best = cls
		}
	}
	return best
}

func (rf *RandomForest) PredictWithConfidence(x []float64) (int, float64) {
	votes := make([]int, rf.NumClasses)
	for _, tree := range rf.Trees {
		pred := tree.Predict(x)
		votes[pred]++
	}

	best := 0
	bestCount := 0
	for cls, cnt := range votes {
		if cnt > bestCount {
			bestCount = cnt
			best = cls
		}
	}
	confidence := float64(bestCount) / float64(rf.NumTrees)
	return best, confidence
}
