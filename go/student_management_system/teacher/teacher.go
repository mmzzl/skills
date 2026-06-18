package teacher

import "fmt"

type Teacher struct {
	Name string
	Subject string
}

func (t Teacher) String() string {
	return "Teacher{Name: " + t.Name + ", Subject: " + t.Subject + "}"
}

func (t *Teacher) ChangeSubject(newSubject string) {
	t.Subject = newSubject
	fmt.Printf("%s's subject has been changed to %s\n", t.Name, t.Subject)
}

