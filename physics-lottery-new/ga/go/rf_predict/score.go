package main

import (
	"fmt"
	"os"
	"sort"
	"time"
)

func runScore(draws [][]int, histFreq PositionFreq, start time.Time) {
	fmt.Print("加载 GA 数据池... ")
	gaPool := loadGAPool("../data_pool/dlt_data_pool.csv")
	fmt.Printf("%d 组\n", len(gaPool))

	type scored struct {
		combo []int
		score float64
	}

	results := make([]scored, len(gaPool))
	for i, combo := range gaPool {
		s := 0.0
		for pos := 0; pos < 7; pos++ {
			total := posFreqTotal(histFreq[pos])
			if total > 0 {
				s += float64(histFreq[pos][combo[pos]]) / float64(total)
			}
		}
		results[i] = scored{combo, s}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	topN := 100
	if topN > len(results) {
		topN = len(results)
	}

	fmt.Printf("\n=== GA池评分 TOP %d ===\n", topN)
	fmt.Println("排名 | 红1 | 红2 | 红3 | 红4 | 红5 | 蓝1 | 蓝2 | 得分")
	fmt.Println("-----|-----|-----|-----|-----|-----|-----|-----|------")
	for i := 0; i < topN; i++ {
		c := results[i].combo
		fmt.Printf("  %3d | %3d | %3d | %3d | %3d | %3d | %3d | %3d | %.4f\n",
			i+1, c[0], c[1], c[2], c[3], c[4], c[5], c[6], results[i].score)
	}

	fmt.Printf("\n保存 TOP %d 到文件...\n", topN)
	f, err := os.Create("../data_pool/ga_pool_top100.csv")
	if err != nil {
		fmt.Fprintf(os.Stderr, "创建文件失败: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	fmt.Fprintln(f, "排名,红1,红2,红3,红4,红5,蓝1,蓝2,得分")
	for i := 0; i < topN; i++ {
		c := results[i].combo
		fmt.Fprintf(f, "%d,%d,%d,%d,%d,%d,%d,%d,%.6f\n",
			i+1, c[0], c[1], c[2], c[3], c[4], c[5], c[6], results[i].score)
	}

	fmt.Printf("结果已保存: data_pool/ga_pool_top100.csv\n")
	fmt.Printf("总耗时: %.1fs\n", time.Since(start).Seconds())
}
