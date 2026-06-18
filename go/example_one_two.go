package example_one_two

import (
	"fmt"
	"sync"
	"time"
)

// 任务结构体
type Job struct {
	ID int
}

// 结果结构体
type Result struct {
	WorkerID int
	JobID    int
	Output   string
}

func task(name string) {
	for i := 1; i <= 3; i++ {
		fmt.Printf("%s is working... (%d/3)\n", name, i)
		time.Sleep(1 * time.Second)
	}
}

// 任务处理函数
func worker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		output := fmt.Sprintf("处理完成")
		// 把结果发送到结果通道
		results <- Result{WorkerID: id, JobID: job.ID, Output: output}
	}
}
	
func main() {
	const (
		workerCount = 5 // 5个工人
		jobCount    = 100 // 100个任务
	)
	// 创建一个任务通道
	jobs := make(chan Job, jobCount)
	// 创建一个结果通道
	results := make(chan Result, jobCount)
	// 等待所有工人完成任务
	var wg sync.WaitGroup
	wg.Add(workerCount)
	// 启动工人
	for i := 1; i <= workerCount; i++ {
		go worker(i, jobs, results, &wg)
	}
	// 发送任务到通道
	for j := 1; j <= jobCount; j++ {
		jobs <- Job{ID: j}
	}
	// 关闭通道，表示没有更多任务
	close(jobs)
	// 等待所有工人完成
	// 启动一个协程，等待所有workder完成后关闭结果通道
	go func() {
		wg.Wait()
		close(results)
	}()

	// 主线程： 从results通道接收所有结果
	fmt.Println("开始接收协程返回的结果：")
	for res := range results {
		fmt.Printf("Worker %d \t完成了 任务 %d \t结果:%s\n", res.WorkerID, res.JobID, res.Output)
	}

	fmt.Println("Starting tasks...")
	// wg.Add(2)
	// go func() {
	// 	defer wg.Done()
	// 	task("Task 1")
	// }()
	// go func() {
	// 	defer wg.Done()
	// 	task("Task 2")
	// }()
	// wg.Wait()
	// fmt.Println("All tasks completed.")
}
