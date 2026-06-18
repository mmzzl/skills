package main

import "sort"

type PositionFreq []map[int]int

type NumCount struct {
	Num int
	Cnt int
}

func buildPositionFreq(draws [][]int) PositionFreq {
	posFreq := make(PositionFreq, 7)
	for i := 0; i < 7; i++ {
		posFreq[i] = make(map[int]int)
	}
	for _, d := range draws {
		for i := 0; i < 7; i++ {
			posFreq[i][d[i]]++
		}
	}
	return posFreq
}

func posFreqTotal(freq map[int]int) int {
	total := 0
	for _, c := range freq {
		total += c
	}
	return total
}

func topN(freq map[int]int, n int) []NumCount {
	var entries []NumCount
	for k, v := range freq {
		entries = append(entries, NumCount{k, v})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Cnt > entries[j].Cnt
	})
	if len(entries) > n {
		entries = entries[:n]
	}
	return entries
}
