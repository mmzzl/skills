package example_one_day

import ("fmt")

func add(a int, b int) int {
	return a + b
}

type Student struct {
	Name string
	Age int
}

func (s Student) String() string {
	return fmt.Sprintf("Student{Name: %s, Age: %d}", s.Name, s.Age)
}



func main() {
	var answer int
	var member []Student
	employee := make(map[string]Student)
	member = append(member, Student{Name: "Alice", Age: 20})
	member = append(member, Student{Name: "Bob", Age: 22})
	member = append(member, Student{Name: "张三", Age: 30})
	member = append(member, Student{Name: "李四", Age: 25})
	employee["Alice"] = Student{Name: "Alice", Age: 20}
	employee["Bob"] = Student{Name: "Bob", Age: 22}
	employee["张三"] = Student{Name: "张三", Age: 30}
	employee["李四"] = Student{Name: "李四", Age: 25}
	answer = add(1, 2)
	fmt.Println(answer)
	fmt.Println(member)
	fmt.Println(employee)
	fmt.Println(employee["Alice"])
	stu, ok := employee["Bob1"]
	if ok {
		fmt.Println("找到了：",stu)
	} else {
		fmt.Println("没有找到这个员工")
	}
	delete(employee, "张三")
	fmt.Println(employee)
	fmt.Println(member[0])
	// 删除第1个元素
	member = append(member[:0], member[1:]...)
	fmt.Println(member)
}