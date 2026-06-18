package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"os"
	"time"
)

type PosConfig struct {
	Name    string
	Pos     int
	Classes int
}

var posConfigs = []PosConfig{
	{"红1", 0, 35},
	{"红2", 1, 35},
	{"红3", 2, 35},
	{"红4", 3, 35},
	{"红5", 4, 35},
	{"蓝1", 5, 12},
	{"蓝2", 6, 12},
}

var predictNext bool
var refreshData bool
var ensembleMode bool
var scoreGA bool

func init() {
	flag.BoolVar(&predictNext, "next", false, "Predict the next draw instead of GA pool")
	flag.BoolVar(&refreshData, "refresh", false, "Force re-download historical data")
	flag.BoolVar(&ensembleMode, "ensemble", false, "Use GA pool distribution to augment prediction")
	flag.BoolVar(&scoreGA, "score", false, "Score and rank GA pool combinations")
}

func main() {
	flag.Parse()
	start := time.Now()

	fmt.Print("加载历史数据... ")
	text, err := loadData(refreshData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "失败: %v\n", err)
		os.Exit(1)
	}
	draws := parseDraws(text)
	fmt.Printf("%d 期\n", len(draws))

	globalFreq := buildPositionFreq(draws)

	if scoreGA {
		runScore(draws, globalFreq, start)
	} else if predictNext && ensembleMode {
		runEnsemble(draws, globalFreq, start)
	} else if predictNext {
		runNextDraw(draws, globalFreq, start)
	} else {
		runGAPool(draws, globalFreq, start)
	}
}

func trainModels(draws [][]int, pos int, classes int, nFeat int, buildFn func([][]int, int) ([][]float64, []int)) *RandomForest {
	X, y := buildFn(draws, pos)

	nTest := 1000
	if nTest > len(X) {
		nTest = len(X)
	}
	trainX := X[:len(X)-nTest]
	trainY := y[:len(X)-nTest]
	testX := X[len(X)-nTest:]
	testY := y[len(X)-nTest:]

	rf := NewRandomForest(50, 10, 5, classes)
	rf.Fit(trainX, trainY)

	correct := 0
	for i := range testX {
		pred := rf.Predict(testX[i])
		if pred == testY[i] {
			correct++
		}
	}
	fmt.Printf("  样本数: %d, 特征数: %d, 测试准确率: %.2f%% (随机: %.2f%%)\n",
		len(X), nFeat, float64(correct)/float64(nTest)*100, 100.0/float64(classes))

	return rf
}

func runGAPool(draws [][]int, globalFreq PositionFreq, start time.Time) {
	models := make([]*RandomForest, 7)
	for _, cfg := range posConfigs {
		fmt.Printf("\n=== 训练 %s (GA池模式) ===\n", cfg.Name)
		models[cfg.Pos] = trainModels(draws, cfg.Pos, cfg.Classes, featureCountForPos(cfg.Pos), buildTrainingData)
	}

	fmt.Println("\n=== 加载 GA 数据池 ===")
	gaPool := loadGAPool("../data_pool/dlt_data_pool.csv")
	fmt.Printf("共 %d 组\n", len(gaPool))

	fmt.Println("=== 预测 GA 池 ===")
	outCSV := "../../../data_pool/rf_predictions.csv"
	f, err := os.Create(outCSV)
	if err != nil {
		fmt.Fprintf(os.Stderr, "创建CSV失败: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()
	w := csv.NewWriter(f)

	header := []string{"序号"}
	for _, cfg := range posConfigs {
		header = append(header, cfg.Name+"_GA", cfg.Name+"_RF", cfg.Name+"_置信")
	}
	w.Write(header)

	totalMatch := make([]int, 7)
	totalConf := make([]float64, 7)

	batchSize := 10000
	for batchStart := 0; batchStart < len(gaPool); batchStart += batchSize {
		batchEnd := batchStart + batchSize
		if batchEnd > len(gaPool) {
			batchEnd = len(gaPool)
		}
		for idx := batchStart; idx < batchEnd; idx++ {
			combo := gaPool[idx]
			row := []string{fmt.Sprintf("%d", idx+1)}
			for pi, cfg := range posConfigs {
				feats := extractGlobalFeatures(combo, cfg.Pos, globalFreq)
				pred, conf := models[cfg.Pos].PredictWithConfidence(feats)
				gaNum := combo[cfg.Pos]
				predNum := pred + 1
				row = append(row,
					fmt.Sprintf("%d", gaNum),
					fmt.Sprintf("%d", predNum),
					fmt.Sprintf("%.4f", conf),
				)
				if gaNum == predNum {
					totalMatch[pi]++
				}
				totalConf[pi] += conf
			}
			w.Write(row)
		}
		fmt.Printf("\r  已预测 %d/%d 组 (%.1f%%)", batchEnd, len(gaPool),
			float64(batchEnd)/float64(len(gaPool))*100)
	}
	w.Flush()
	f.Close()
	fmt.Println()

	fmt.Println("\n=== 预测结果汇总 ===")
	n := len(gaPool)
	for pi, cfg := range posConfigs {
		matchRate := float64(totalMatch[pi]) / float64(n) * 100
		avgConf := totalConf[pi] / float64(n) * 100
		fmt.Printf("  %s: 匹配率 %.2f%%, 平均置信度 %.2f%%\n", cfg.Name, matchRate, avgConf)
	}
	avgMatch := float64(0)
	for _, m := range totalMatch {
		avgMatch += float64(m)
	}
	avgMatch /= float64(len(posConfigs))
	fmt.Printf("\n  平均匹配率: %.2f%% (随机基准: 红球=%.2f%%, 蓝球=%.2f%%)\n",
		avgMatch/float64(n)*100, 100.0/35, 100.0/12)
	fmt.Printf("\n结果已保存: %s\n", outCSV)
	fmt.Printf("总耗时: %.1fs\n", time.Since(start).Seconds())
}

func runNextDraw(draws [][]int, globalFreq PositionFreq, start time.Time) {
	lastDraw := draws[len(draws)-1]
	fmt.Printf("最近一期开奖: 红%v 蓝%v\n\n", lastDraw[:5], lastDraw[5:])

	fmt.Print("加载 GA 数据池... ")
	gaPool := loadGAPool("../data_pool/dlt_data_pool.csv")
	gaFreq := buildPositionFreq(gaPool)
	fmt.Printf("%d 组\n\n", len(gaPool))

	models := make([]*RandomForest, 7)
	for _, cfg := range posConfigs {
		fmt.Printf("=== 训练 %s (下期预测+GA池特征) ===\n", cfg.Name)
		buildFn := func(d [][]int, p int) ([][]float64, []int) {
			return buildNextDrawTrainingDataGA(d, p, gaFreq)
		}
		models[cfg.Pos] = trainModels(draws, cfg.Pos, cfg.Classes, featureCountNextGA(cfg.Pos), buildFn)
	}

	fmt.Println("\n=== 下期开奖预测 ===")
	fmt.Println("位置 | 历史频次      | GA池频次      | 预测号码 | 置信度")
	fmt.Println("------|---------------|---------------|---------|--------")
	for _, cfg := range posConfigs {
		feats := extractNextDrawFeaturesGA(lastDraw, cfg.Pos, globalFreq, gaFreq)
		pred, conf := models[cfg.Pos].PredictWithConfidence(feats)
		predNum := pred + 1

		histFreq := globalFreq[cfg.Pos][predNum]
		gaFreqPos := gaFreq[cfg.Pos][predNum]
		histStr := fmt.Sprintf("%d期/%d次", len(draws), histFreq)
		gaStr := fmt.Sprintf("%d组/%d次", len(gaPool), gaFreqPos)

		fmt.Printf("  %-4s | %-13s | %-13s | %3d       | %.1f%%\n",
			cfg.Name, histStr, gaStr, predNum, conf*100)
	}
	fmt.Printf("\n预测号码: ")
	for pi, cfg := range posConfigs {
		feats := extractNextDrawFeaturesGA(lastDraw, cfg.Pos, globalFreq, gaFreq)
		pred, conf := models[cfg.Pos].PredictWithConfidence(feats)
		if pi == 5 {
			fmt.Printf("  ")
		}
		fmt.Printf("%02d(%.0f%%) ", pred+1, conf*100)
	}
	fmt.Println()
	fmt.Printf("总耗时: %.1fs\n", time.Since(start).Seconds())
}
