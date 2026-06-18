package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const dltURL = "http://www.17500.cn/getData/dlt.TXT"
const cacheFile = "../../../dlt_cache.txt"

func loadData(refresh bool) (string, error) {
	if !refresh {
		data, err := os.ReadFile(cacheFile)
		if err == nil && len(data) > 0 {
			text := string(data)
			if len(text) > 0 {
				fmt.Printf("使用缓存数据: %s\n", cacheFile)
				return text, nil
			}
		}
	}
	return downloadData()
}

func downloadData() (string, error) {
	fmt.Println("下载大乐透历史数据...")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(dltURL)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	text := string(body)
	if err := os.WriteFile(cacheFile, body, 0644); err != nil {
		return "", fmt.Errorf("写入缓存失败: %w", err)
	}

	return text, nil
}

func parseDraws(text string) [][]int {
	var draws [][]int
	lines := strings.Split(strings.TrimSpace(text), "\n")

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 9 {
			continue
		}

		valid := true
		reds := make([]int, 0, 5)
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

func loadGAPool(path string) [][]int {
	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "打开GA池失败: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	records, err := reader.ReadAll()
	if err != nil {
		fmt.Fprintf(os.Stderr, "读取GA池失败: %v\n", err)
		os.Exit(1)
	}

	pool := make([][]int, 0, len(records)-1)
	for i, row := range records {
		if i == 0 {
			continue // skip header
		}
		if len(row) < 8 {
			continue
		}
		nums := make([]int, 7)
		valid := true
		for j := 1; j <= 7; j++ {
			v, err := strconv.Atoi(strings.TrimSpace(row[j]))
			if err != nil {
				valid = false
				break
			}
			nums[j-1] = v
		}
		if valid {
			pool = append(pool, nums)
		}
	}

	return pool
}

type PositionFreq []map[int]int

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

func sortInts(a []int) {
	for i := 0; i < len(a); i++ {
		for j := i + 1; j < len(a); j++ {
			if a[i] > a[j] {
				a[i], a[j] = a[j], a[i]
			}
		}
	}
}
