package main

import (
	"fmt"
	"os"
	"time"
)

func main() {
	text, err := loadData()
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载数据失败: %v\n", err)
		os.Exit(1)
	}

	draws := parseDraws(text)
	fmt.Printf("解析到 %d 期历史数据\n", len(draws))

	posFreq := buildPositionFreq(draws)
	for i := 0; i < 5; i++ {
		top := topN(posFreq[i], 3)
		fmt.Printf("  红球位置%d TOP3: %v\n", i+1, top)
	}
	for i := 5; i < 7; i++ {
		top := topN(posFreq[i], 3)
		fmt.Printf("  蓝球位置%d TOP3: %v\n", i-4, top)
	}

	fmt.Printf("\n启动遗传算法 (种群=%d, 代数=%d, 目标=%d)\n", populationSize, generations, targetCount)
	start := time.Now()

	pool, _, _ := runGA(posFreq)
	elapsed := time.Since(start)
	fmt.Printf("GA耗时: %.1fs, 生成: %d 组\n", elapsed.Seconds(), len(pool))

	if err := saveCSV(pool, "./data_pool/dlt_data_pool.csv"); err != nil {
		fmt.Fprintf(os.Stderr, "保存CSV失败: %v\n", err)
		os.Exit(1)
	}

	uniqueCount := 0
	seen2 := make(map[[7]int]bool)
	for _, p := range pool {
		key := uniqueKey(p)
		if !seen2[key] {
			seen2[key] = true
			uniqueCount++
		}
	}
	fmt.Printf("\n总共: %d 组 | 去重: %d 组\n", len(pool), uniqueCount)
	fmt.Printf("总耗时: %.1fs\n", time.Since(start).Seconds())
}
