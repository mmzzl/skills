package main

func featureCountNextGA(pos int) int {
	return numRangeForPos(pos)*4 + 7
}

func buildNextDrawTrainingDataGA(draws [][]int, pos int, gaPoolFreq PositionFreq) ([][]float64, []int) {
	nr := numRangeForPos(pos)
	n := len(draws)
	nFeat := featureCountNextGA(pos)

	expFreq := make([][]int, n+1)
	for i := range expFreq {
		expFreq[i] = make([]int, 36)
	}
	expAny := make([][]int, n+1)
	for i := range expAny {
		expAny[i] = make([]int, 36)
	}

	for t := 0; t < n; t++ {
		copy(expFreq[t+1], expFreq[t])
		expFreq[t+1][draws[t][pos]]++

		copy(expAny[t+1], expAny[t])
		if pos < 5 {
			for p := 0; p < 5; p++ {
				expAny[t+1][draws[t][p]]++
			}
		} else {
			for p := 5; p < 7; p++ {
				expAny[t+1][draws[t][p]]++
			}
		}
	}

	gaPosTotal := posFreqTotal(gaPoolFreq[pos])
	if gaPosTotal == 0 {
		gaPosTotal = 1
	}
	var gaAnyTotal int
	if pos < 5 {
		for p := 0; p < 5; p++ {
			gaAnyTotal += posFreqTotal(gaPoolFreq[p])
		}
	} else {
		for p := 5; p < 7; p++ {
			gaAnyTotal += posFreqTotal(gaPoolFreq[p])
		}
	}
	if gaAnyTotal == 0 {
		gaAnyTotal = 1
	}

	gaFreqAt := make([]float64, nr+1)
	for num := 1; num <= nr; num++ {
		gaFreqAt[num] = float64(gaPoolFreq[pos][num]) / float64(gaPosTotal)
	}
	gaFreqAny := make([]float64, nr+1)
	for num := 1; num <= nr; num++ {
		sum := 0
		if pos < 5 {
			for p := 0; p < 5; p++ {
				sum += gaPoolFreq[p][num]
			}
		} else {
			sum = gaPoolFreq[5][num] + gaPoolFreq[6][num]
		}
		gaFreqAny[num] = float64(sum) / float64(gaAnyTotal)
	}

	var X [][]float64
	var y []int

	for t := 1; t < n; t++ {
		feats := make([]float64, nFeat)
		offset := 0
		denom := float64(t)

		for num := 1; num <= nr; num++ {
			feats[offset] = float64(expFreq[t][num]) / denom
			offset++
		}
		for num := 1; num <= nr; num++ {
			anyD := denom * 5
			if pos >= 5 {
				anyD = denom * 2
			}
			feats[offset] = float64(expAny[t][num]) / anyD
			offset++
		}

		prev := draws[t-1]
		for j := 0; j < 5; j++ {
			feats[offset] = float64(prev[j]) / 35.0
			offset++
		}
		for j := 5; j < 7; j++ {
			feats[offset] = float64(prev[j]) / 12.0
			offset++
		}

		for num := 1; num <= nr; num++ {
			feats[offset] = gaFreqAt[num] - (float64(expFreq[t][num]) / denom)
			offset++
		}
		for num := 1; num <= nr; num++ {
			anyD := denom * 5
			if pos >= 5 {
				anyD = denom * 2
			}
			feats[offset] = gaFreqAny[num] - (float64(expAny[t][num]) / anyD)
			offset++
		}

		X = append(X, feats)
		y = append(y, draws[t][pos]-1)
	}

	return X, y
}

func extractNextDrawFeaturesGA(lastDraw []int, pos int, histFreq PositionFreq, gaPoolFreq PositionFreq) []float64 {
	nr := numRangeForPos(pos)
	nFeat := featureCountNextGA(pos)

	histPosTotal := posFreqTotal(histFreq[pos])
	if histPosTotal == 0 {
		histPosTotal = 1
	}
	var histAnyTotal int
	if pos < 5 {
		for p := 0; p < 5; p++ {
			histAnyTotal += posFreqTotal(histFreq[p])
		}
	} else {
		for p := 5; p < 7; p++ {
			histAnyTotal += posFreqTotal(histFreq[p])
		}
	}
	if histAnyTotal == 0 {
		histAnyTotal = 1
	}

	gaPosTotal := posFreqTotal(gaPoolFreq[pos])
	if gaPosTotal == 0 {
		gaPosTotal = 1
	}
	var gaAnyTotal int
	if pos < 5 {
		for p := 0; p < 5; p++ {
			gaAnyTotal += posFreqTotal(gaPoolFreq[p])
		}
	} else {
		for p := 5; p < 7; p++ {
			gaAnyTotal += posFreqTotal(gaPoolFreq[p])
		}
	}
	if gaAnyTotal == 0 {
		gaAnyTotal = 1
	}

	feats := make([]float64, nFeat)
	offset := 0

	for num := 1; num <= nr; num++ {
		feats[offset] = float64(histFreq[pos][num]) / float64(histPosTotal)
		offset++
	}
	for num := 1; num <= nr; num++ {
		sum := 0
		if pos < 5 {
			for p := 0; p < 5; p++ {
				sum += histFreq[p][num]
			}
		} else {
			sum = histFreq[5][num] + histFreq[6][num]
		}
		feats[offset] = float64(sum) / float64(histAnyTotal)
		offset++
	}

	for j := 0; j < 5; j++ {
		feats[offset] = float64(lastDraw[j]) / 35.0
		offset++
	}
	for j := 5; j < 7; j++ {
		feats[offset] = float64(lastDraw[j]) / 12.0
		offset++
	}

	for num := 1; num <= nr; num++ {
		ga := float64(gaPoolFreq[pos][num]) / float64(gaPosTotal)
		hist := float64(histFreq[pos][num]) / float64(histPosTotal)
		feats[offset] = ga - hist
		offset++
	}
	for num := 1; num <= nr; num++ {
		sum := 0
		if pos < 5 {
			for p := 0; p < 5; p++ {
				sum += gaPoolFreq[p][num]
			}
		} else {
			sum = gaPoolFreq[5][num] + gaPoolFreq[6][num]
		}
		ga := float64(sum) / float64(gaAnyTotal)
		histSum := 0
		if pos < 5 {
			for p := 0; p < 5; p++ {
				histSum += histFreq[p][num]
			}
		} else {
			histSum = histFreq[5][num] + histFreq[6][num]
		}
		hist := float64(histSum) / float64(histAnyTotal)
		feats[offset] = ga - hist
		offset++
	}

	return feats
}
