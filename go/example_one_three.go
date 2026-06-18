package example_one_three

import (
	"fmt"
	"sync"
)

// 网页数据（请求下来的原始数据）
type PageData struct {
	URL  string
	HTML string
}

// 解析结果（提取后的内容）
type ParseResult struct {
	Title string
	URL   string
}

// ------------------- 1. 爬取协程（请求网页） -------------------
func fetcher(url string, pageChan chan<- PageResult, wg *sync.WaitGroup) {
	defer wg.Done()
	fmt.Println("【请求】:", url)

	// 模拟 HTTP 请求
	html := "<html>这是" + url + "的内容</html>"

	// 发给解析协程
	pageChan <- PageData{URL: url, HTML: html}
}

// ------------------- 2. 解析协程（提取数据） -------------------
func parser(pageChan <-chan PageData, resultChan chan<- ParseResult, wg *sync.WaitGroup) {
	defer wg.Done()
	for page := range pageChan {
		fmt.Println("【解析】:", page.URL)
		// 模拟解析
		result := ParseResult{URL: page.URL, Title: "标题来自" + page.URL}
		// 发给保存协程
		resultChan <- result
	}
}

// ------------------- 3. 保存协程（写入数据库/文件） -------------------
func saver(resultChan <-chan ParseResult, wg *sync.WaitGroup) {
	defer wg.Done()
	for res := range resultChan {
		fmt.Println("【保存】:", res.URL, " → ", res.Title)
	}
}

// ------------------- 主函数：调度所有协程 -------------------
func main() {
	// 3个通道，解耦 3 个步骤
	urlChan := make(chan string, 10)
	pageChan := make(chan PageData, 10)
	resultChan := make(chan ParseResult, 10)

	var wg sync.WaitGroup

	// 1. 启动 5 个请求协程
	wg.Add(5)
	for i := 0; i < 5; i++ {
		go fetcher(urlChan, pageChan, &wg)
	}

	// 2. 启动 3 个解析协程
	wg.Add(3)
	go parser(pageChan, resultChan, &wg)

	// 3. 启动 2 个保存协程
	wg.Add(2)
	go saver(resultChan, &wg)

	// 丢入 10 个待爬 URL
	urls := []string{
		"https://aaa.com", "https://bbb.com", "https://ccc.com",
		"https://ddd.com", "https://eee.com", "https://fff.com",
	}
	for _, u := range urls {
		urlChan <- u
	}

	close(urlChan)
	wg.Wait()

	fmt.Println("🎉 爬虫全部完成！")
}