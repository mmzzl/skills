package main

import (
	"strconv"
	"strings"
)

func parseDraws(text string) [][]int {
	var draws [][]int
	lines := strings.Split(strings.TrimSpace(text), "\n")

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 9 {
			continue
		}

		reds := make([]int, 0, 5)
		valid := true
		for i := 2; i < 7; i++ {
			v, err := strconv.Atoi(parts[i])
			if err != nil || v < 1 || v > 35 {
				valid = false
				break
			}
			reds = append(reds, v)
		}
		if !valid {
			continue
		}
		sortInts(reds)

		blues := make([]int, 0, 2)
		for i := 7; i < 9; i++ {
			v, err := strconv.Atoi(parts[i])
			if err != nil || v < 1 || v > 12 {
				valid = false
				break
			}
			blues = append(blues, v)
		}
		if !valid {
			continue
		}
		sortInts(blues)

		draw := append(reds, blues...)
		draws = append(draws, draw)
	}

	return draws
}
