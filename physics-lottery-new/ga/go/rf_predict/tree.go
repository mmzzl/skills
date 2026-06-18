package main

import (
	"math"
	"math/rand"
	"sort"
)

type TreeNode struct {
	Left       *TreeNode
	Right      *TreeNode
	SplitFeat  int
	SplitVal   float64
	IsLeaf     bool
	Prediction int
	ClassDist  []int
	Depth      int
}

type DecisionTree struct {
	Root           *TreeNode
	MaxDepth       int
	MinSamplesLeaf int
	NumClasses     int
	NumFeatures    int
}

func NewDecisionTree(maxDepth, minSamplesLeaf, numClasses, numFeatures int) *DecisionTree {
	return &DecisionTree{
		MaxDepth:       maxDepth,
		MinSamplesLeaf: minSamplesLeaf,
		NumClasses:     numClasses,
		NumFeatures:    numFeatures,
	}
}

func giniImpurity(counts []int, total int) float64 {
	if total == 0 {
		return 1
	}
	sum := 1.0
	for _, c := range counts {
		p := float64(c) / float64(total)
		sum -= p * p
	}
	return sum
}

func (t *DecisionTree) Fit(X [][]float64, y []int, featureSubset []int, rng *rand.Rand) {
	t.Root = t.buildNode(X, y, featureSubset, 0, rng)
}

func (t *DecisionTree) buildNode(X [][]float64, y []int, featureSubset []int, depth int, rng *rand.Rand) *TreeNode {
	node := &TreeNode{Depth: depth}
	n := len(X)

	classCounts := make([]int, t.NumClasses)
	for _, label := range y {
		classCounts[label]++
	}

	mode := 0
	modeCount := 0
	for cls, cnt := range classCounts {
		if cnt > modeCount {
			modeCount = cnt
			mode = cls
		}
	}
	node.Prediction = mode
	node.ClassDist = classCounts

	if depth >= t.MaxDepth || n <= t.MinSamplesLeaf || modeCount == n {
		node.IsLeaf = true
		return node
	}

	bestFeat, bestVal := t.findBestSplit(X, y, classCounts, n, featureSubset, rng)
	if bestFeat == -1 {
		node.IsLeaf = true
		return node
	}

	node.SplitFeat = bestFeat
	node.SplitVal = bestVal

	var leftIdx, rightIdx []int
	for i := 0; i < n; i++ {
		if X[i][bestFeat] <= bestVal {
			leftIdx = append(leftIdx, i)
		} else {
			rightIdx = append(rightIdx, i)
		}
	}

	if len(leftIdx) < t.MinSamplesLeaf || len(rightIdx) < t.MinSamplesLeaf {
		node.IsLeaf = true
		return node
	}

	leftX, leftY := selectRows(X, y, leftIdx)
	rightX, rightY := selectRows(X, y, rightIdx)

	node.Left = t.buildNode(leftX, leftY, featureSubset, depth+1, rng)
	node.Right = t.buildNode(rightX, rightY, featureSubset, depth+1, rng)

	return node
}

func (t *DecisionTree) findBestSplit(X [][]float64, y []int, classCounts []int, total int, featureSubset []int, rng *rand.Rand) (int, float64) {
	bestFeat := -1
	bestVal := 0.0
	bestGini := math.Inf(1)

	currentGini := giniImpurity(classCounts, total)

	nFeats := len(featureSubset)
	subSize := int(math.Sqrt(float64(nFeats)))
	if subSize < 1 {
		subSize = 1
	}

	perm := rng.Perm(nFeats)
	selected := make([]int, subSize)
	for i := 0; i < subSize; i++ {
		selected[i] = featureSubset[perm[i]]
	}

	for _, feat := range selected {
		type pair struct {
			val   float64
			label int
		}
		sorted := make([]pair, len(X))
		for i := range X {
			sorted[i] = pair{X[i][feat], y[i]}
		}
		sort.Slice(sorted, func(i, j int) bool { return sorted[i].val < sorted[j].val })

		leftCounts := make([]int, t.NumClasses)
		rightCounts := make([]int, t.NumClasses)
		for i := range classCounts {
			rightCounts[i] = classCounts[i]
		}
		leftTotal, rightTotal := 0, total

		for j := 0; j < len(sorted)-1; j++ {
			lbl := sorted[j].label
			leftCounts[lbl]++
			leftTotal++
			rightCounts[lbl]--
			rightTotal--

			if sorted[j].val == sorted[j+1].val {
				continue
			}

			threshold := (sorted[j].val + sorted[j+1].val) / 2
			giniL := giniImpurity(leftCounts, leftTotal)
			giniR := giniImpurity(rightCounts, rightTotal)
			weighted := (float64(leftTotal)*giniL + float64(rightTotal)*giniR) / float64(total)

			if weighted < bestGini {
				bestGini = weighted
				bestFeat = feat
				bestVal = threshold
			}
		}
	}

	if bestGini >= currentGini {
		return -1, 0
	}
	return bestFeat, bestVal
}

func (t *DecisionTree) Predict(x []float64) int {
	node := t.Root
	for !node.IsLeaf {
		if x[node.SplitFeat] <= node.SplitVal {
			node = node.Left
		} else {
			node = node.Right
		}
	}
	return node.Prediction
}

func (t *DecisionTree) PredictDist(x []float64) (int, []int) {
	node := t.Root
	for !node.IsLeaf {
		if x[node.SplitFeat] <= node.SplitVal {
			node = node.Left
		} else {
			node = node.Right
		}
	}
	return node.Prediction, node.ClassDist
}

func selectRows(X [][]float64, y []int, indices []int) ([][]float64, []int) {
	n := len(indices)
	outX := make([][]float64, n)
	outY := make([]int, n)
	for i, idx := range indices {
		outX[i] = X[idx]
		outY[i] = y[idx]
	}
	return outX, outY
}
