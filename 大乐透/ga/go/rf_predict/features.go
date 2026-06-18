package main

const windowSize = 20

func numRangeForPos(pos int) int {
	if pos < 5 {
		return 35
	}
	return 12
}

func featureCountForPos(pos int) int {
	nr := numRangeForPos(pos)
	return nr*2 + 7
}

func buildTrainingData(draws [][]int, pos int) ([][]float64, []int) {
	nr := numRangeForPos(pos)
	n := len(draws)

	posCounts := make([][]int, n+1)
	for i := range posCounts {
		posCounts[i] = make([]int, nr+1)
	}

	var anyCounts [][]int
	if pos < 5 {
		anyCounts = make([][]int, n+1)
		for i := range anyCounts {
			anyCounts[i] = make([]int, nr+1)
		}
	} else {
		anyCounts = make([][]int, n+1)
		for i := range anyCounts {
			anyCounts[i] = make([]int, nr+1)
		}
	}

	anyPosCount := 5
	if pos >= 5 {
		anyPosCount = 2
	}

	for t := 0; t < n; t++ {
		copy(posCounts[t+1], posCounts[t])
		posCounts[t+1][draws[t][pos]]++

		copy(anyCounts[t+1], anyCounts[t])
		if pos < 5 {
			for p := 0; p < 5; p++ {
				anyCounts[t+1][draws[t][p]]++
			}
		} else {
			for p := 5; p < 7; p++ {
				anyCounts[t+1][draws[t][p]]++
			}
		}

		if t >= windowSize {
			posCounts[t+1][draws[t-windowSize][pos]]--
			if pos < 5 {
				for p := 0; p < 5; p++ {
					anyCounts[t+1][draws[t-windowSize][p]]--
				}
			} else {
				for p := 5; p < 7; p++ {
					anyCounts[t+1][draws[t-windowSize][p]]--
				}
			}
		}
	}

	nFeat := featureCountForPos(pos)
	var X [][]float64
	var y []int

	for t := windowSize; t < n; t++ {
		feats := make([]float64, nFeat)
		offset := 0

		for num := 1; num <= nr; num++ {
			feats[offset] = float64(posCounts[t][num]) / float64(windowSize)
			offset++
		}

		for num := 1; num <= nr; num++ {
			feats[offset] = float64(anyCounts[t][num]) / float64(windowSize*anyPosCount)
			offset++
		}

		curr := draws[t]
		for j := 0; j < 5; j++ {
			if j == pos {
				feats[offset] = 0
			} else {
				feats[offset] = float64(curr[j]) / 35.0
			}
			offset++
		}
		for j := 5; j < 7; j++ {
			if j == pos {
				feats[offset] = 0
			} else {
				feats[offset] = float64(curr[j]) / 12.0
			}
			offset++
		}

		X = append(X, feats)
		y = append(y, draws[t][pos]-1)
	}

	return X, y
}

func extractGlobalFeatures(combo []int, pos int, globalFreq PositionFreq) []float64 {
	nr := numRangeForPos(pos)
	nFeat := featureCountForPos(pos)
	feats := make([]float64, nFeat)

	posTotal := posFreqTotal(globalFreq[pos])
	if posTotal == 0 {
		posTotal = 1
	}

	var anyTotal int
	if pos < 5 {
		for p := 0; p < 5; p++ {
			anyTotal += posFreqTotal(globalFreq[p])
		}
	} else {
		for p := 5; p < 7; p++ {
			anyTotal += posFreqTotal(globalFreq[p])
		}
	}
	if anyTotal == 0 {
		anyTotal = 1
	}

	offset := 0

	for num := 1; num <= nr; num++ {
		feats[offset] = float64(globalFreq[pos][num]) / float64(posTotal)
		offset++
	}

	for num := 1; num <= nr; num++ {
		sum := 0
		if pos < 5 {
			for p := 0; p < 5; p++ {
				sum += globalFreq[p][num]
			}
		} else {
			sum = globalFreq[5][num] + globalFreq[6][num]
		}
		feats[offset] = float64(sum) / float64(anyTotal)
		offset++
	}

	for j := 0; j < 5; j++ {
		if j == pos {
			feats[offset] = 0
		} else {
			feats[offset] = float64(combo[j]) / 35
		}
		offset++
	}
	for j := 5; j < 7; j++ {
		if j == pos {
			feats[offset] = 0
		} else {
			feats[offset] = float64(combo[j]) / 12
		}
		offset++
	}

	return feats
}
