package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const dltURL = "http://www.17500.cn/getData/dlt.TXT"
const cacheFile = "./dlt_cache.txt"

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

func loadData() (string, error) {
	data, err := os.ReadFile(cacheFile)
	if err == nil && len(data) > 0 {
		text := string(data)
		if len(text) > 0 {
			fmt.Printf("使用缓存数据: %s\n", cacheFile)
			return text, nil
		}
	}
	return downloadData()
}
