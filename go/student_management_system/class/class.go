package class

import "fmt"

type Class struct {
	Name string
	Students []string
	Teacher *teacher.Teacher
}

func (c Class) String() string {
	return "Class{Name: " + c.Name + ", Students: " + fmt.Sprint(c.Students) + ", Teacher: " + c.Teacher.String() + "}"
}

func (c *Class) AddStudent(student string) {
	c.Students = append(c.Students, student)
}

func (c *Class) RemoveStudent(student string) {
	for i, s := range c.Students {
		if s == student {
			c.Students = append(c.Students[:i], c.Students[i+1:]...)
			break
		}
	}
}

func (c *Class) ChangeTeacher(newTeacher *teacher.Teacher) {
	c.Teacher = newTeacher
	fmt.Printf("The teacher for class %s has been changed to %s\n", c.Name, c.Teacher.Name)
}