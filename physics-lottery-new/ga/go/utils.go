package main

import "sort"

func sortInts(a []int) {
	sort.Ints(a)
}

func containsInt(a []int, v int) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}

func uniqueKey(ind []int) [7]int {
	var key [7]int
	copy(key[:], ind)
	return key
}
