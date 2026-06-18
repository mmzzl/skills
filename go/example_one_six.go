package example_one_six

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	// resp, err := http.Get("https://www.baidu.com")
	// if err != nil {
	// 	fmt.Println("Error fetching page:", err)
	// 	return
	// }
	// defer resp.Body.Close()
	// body, err := io.ReadAll(resp.Body)
	// if err != nil {
	// 	fmt.Println("Error reading response body:", err)
	// 	return
	// }
	// fmt.Println("Response body:", string(body))
	req, err := http.NewRequest("GET", "https://www.baidu.com", nil)
	req.Header.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Add("Referer", "https://www.baidu.com/")
	if err != nil {
		fmt.Println("Error creating request:", err)
		return
	}
	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	fmt.Println("Response body:", string(body))
}