package example_one_four

import (
	"encoding/json"
	"fmt"
)

type Stock struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Price float64 `json:"price"`
	Volume int `json:"volume"`
}

func main() {
	stock := Stock{
		Code: "600000",
		Name: "浦发银行",
		Price: 10.5,
		Volume: 1000,
	}
	jsonBytes, err := json.Marshal(stock)
	if err != nil {
		fmt.Println("Error marshaling stock:", err)
		return
	}
	fmt.Println("JSON:", string(jsonBytes))
	// json 字符串转结构体
	var newStock Stock
	err = json.Unmarshal(jsonBytes, &newStock)
	if err != nil {
		fmt.Println("Error unmarshaling stock:", err)
		return
	}
	fmt.Println("Stock struct: %+v\n", newStock)
}