package main

import (
	"bufio"
	"fmt"
	"os"
)

func saveCSV(data [][]int, path string) error {
	dir := "./data_pool"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	bw := bufio.NewWriterSize(f, 1<<20)

	bom := []byte{0xEF, 0xBB, 0xBF}
	if _, err := bw.Write(bom); err != nil {
		return err
	}

	if _, err := fmt.Fprintln(bw, "序号,红1,红2,红3,红4,红5,蓝1,蓝2"); err != nil {
		return err
	}

	for idx, row := range data {
		if _, err := fmt.Fprintf(bw, "%d,%d,%d,%d,%d,%d,%d,%d\n",
			idx+1, row[0], row[1], row[2], row[3], row[4], row[5], row[6]); err != nil {
			return err
		}
	}

	if err := bw.Flush(); err != nil {
		return err
	}

	fmt.Printf("\n已保存: %s (%d 组)\n", path, len(data))
	return nil
}
