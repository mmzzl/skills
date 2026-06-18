package main

import (
	"fmt"
	"time"
)

func runEnsemble(draws [][]int, histFreq PositionFreq, start time.Time) {
	lastDraw := draws[len(draws)-1]
	fmt.Printf("最近一期开奖: 红%v 蓝%v\n\n", lastDraw[:5], lastDraw[5:])

	fmt.Print("加载 GA 数据池... ")
	gaPool := loadGAPool("../data_pool/dlt_data_pool.csv")
	gaFreq := buildPositionFreq(gaPool)
	fmt.Printf("%d 组\n\n", len(gaPool))

	gaModeAtPos := make([]int, 7)
	for pos := 0; pos < 7; pos++ {
		bestNum, bestCnt := 0, 0
		for num, cnt := range gaFreq[pos] {
			if cnt > bestCnt {
				bestCnt = cnt
				bestNum = num
			}
		}
		gaModeAtPos[pos] = bestNum
	}

	models := make([]*RandomForest, 7)
	for _, cfg := range posConfigs {
		fmt.Printf("=== 训练 %s (集成模式) ===\n", cfg.Name)
		buildFn := func(d [][]int, p int) ([][]float64, []int) {
			return buildNextDrawTrainingDataGA(d, p, gaFreq)
		}
		models[cfg.Pos] = trainModels(draws, cfg.Pos, cfg.Classes, featureCountNextGA(cfg.Pos), buildFn)
	}

	fmt.Println("\n=== 下期号码推荐（GA + RF 集成）===")
	fmt.Println("位置 | GA推荐 | GA频率 | RF预测 | 置信度 | 集成推荐")
	fmt.Println("------|--------|--------|--------|--------|--------")

	var finalCombo [7]int
	for _, cfg := range posConfigs {
		rfFeats := extractNextDrawFeaturesGA(lastDraw, cfg.Pos, histFreq, gaFreq)
		rfPred, rfConf := models[cfg.Pos].PredictWithConfidence(rfFeats)
		rfNum := rfPred + 1
		gaNum := gaModeAtPos[cfg.Pos]
		gaPct := float64(gaFreq[cfg.Pos][gaNum]) / float64(len(gaPool)) * 100

		gaWeight := gaPct / 100.0
		rfWeight := rfConf
		finalNum := rfNum
		if rfWeight < gaWeight {
			finalNum = gaNum
		}

		finalCombo[cfg.Pos] = finalNum

		fmt.Printf("  %-4s |  %02d     | %5.1f%% |  %02d     |  %5.1f%% |   %02d\n",
			cfg.Name, gaNum, gaPct, rfNum, rfConf*100, finalNum)
	}

	fmt.Printf("\nGA推荐:   ")
	for pi := 0; pi < 7; pi++ {
		if pi == 5 {
			fmt.Printf("  ")
		}
		fmt.Printf("%02d(%5.1f%%) ", gaModeAtPos[pi],
			float64(gaFreq[pi][gaModeAtPos[pi]])/float64(len(gaPool))*100)
	}
	fmt.Printf("\nRF预测:   ")
	for pi, cfg := range posConfigs {
		feats := extractNextDrawFeaturesGA(lastDraw, cfg.Pos, histFreq, gaFreq)
		pred, conf := models[cfg.Pos].PredictWithConfidence(feats)
		if pi == 5 {
			fmt.Printf("  ")
		}
		fmt.Printf("%02d(%5.1f%%) ", pred+1, conf*100)
	}
	fmt.Printf("\n集成推荐: [")
	for pi := 0; pi < 5; pi++ {
		fmt.Printf("%02d ", finalCombo[pi])
	}
	fmt.Printf("] [")
	for pi := 5; pi < 7; pi++ {
		fmt.Printf("%02d ", finalCombo[pi])
	}
	fmt.Printf("]\n")
	fmt.Printf("总耗时: %.1fs\n", time.Since(start).Seconds())
}
