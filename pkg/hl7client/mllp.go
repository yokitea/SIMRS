package hl7client

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strings"
	"time"
)

type RadiologyOrderHL7 struct {
	ControlID        string
	PatientID        string
	PatientName      string
	PatientBirthDate string
	PatientSex       string
	AccessionNumber  string
	StudyInstanceUID string
	ProcedureCode    string
	ProcedureName    string
	Modality         string
}

// sanitizeHL7 strips HL7 v2 segment/field delimiters to prevent HL7 injection.
func sanitizeHL7(s string) string {
	r := strings.NewReplacer("\r", " ", "\n", " ", "|", " ", "^", " ", "~", " ", "\\", " ", "&", " ")
	return strings.TrimSpace(r.Replace(s))
}

// BuildORM builds an HL7 v2.5 ORM^O01 message compatible with Core RIS pacs-bridge and Core PACS hl7-sync.
func BuildORM(o RadiologyOrderHL7, now time.Time) string {
	ts := now.Format("20060102150405")
	dob := sanitizeHL7(strings.ReplaceAll(o.PatientBirthDate, "-", ""))
	dicomName := strings.ToUpper(strings.ReplaceAll(sanitizeHL7(o.PatientName), " ", "^"))
	ctrl := sanitizeHL7(o.ControlID)
	pid := sanitizeHL7(o.PatientID)
	sex := sanitizeHL7(o.PatientSex)
	acc := sanitizeHL7(o.AccessionNumber)
	uid := sanitizeHL7(o.StudyInstanceUID)
	pcode := sanitizeHL7(o.ProcedureCode)
	pname := sanitizeHL7(o.ProcedureName)
	mod := sanitizeHL7(o.Modality)
	return strings.Join([]string{
		fmt.Sprintf("MSH|^~\\&|CORE_SIMRS|HOSPITAL|CORE_RIS|HOSPITAL|%s||ORM^O01|%s|P|2.5", ts, ctrl),
		fmt.Sprintf("PID|1||%s^^^RS||%s||%s|%s", pid, dicomName, dob, sex),
		fmt.Sprintf("ORC|NW|%s|%s", ctrl, acc),
		fmt.Sprintf("OBR|1|%s|%s|%s^%s||||||||||||||||||||%s", ctrl, acc, pcode, pname, mod),
		fmt.Sprintf("ZDS|%s^^Application^DICOM", uid),
	}, "\r") + "\r"
}

// SendMLLP sends a framed HL7 message (0x0B ... 0x1C 0x0D) over TCP and returns the ACK text.
func SendMLLP(ctx context.Context, addr, message string) (string, error) {
	d := net.Dialer{Timeout: 3 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

	frame := make([]byte, 0, len(message)+3)
	frame = append(frame, 0x0B)
	frame = append(frame, []byte(message)...)
	frame = append(frame, 0x1C, 0x0D)
	if _, err := conn.Write(frame); err != nil {
		return "", err
	}

	r := bufio.NewReader(conn)
	ack, err := r.ReadString(0x1C)
	if err != nil {
		return "", err
	}
	ack = strings.TrimLeft(ack, "\x0b")
	ack = strings.TrimRight(ack, "\x1c\r\n")
	return ack, nil
}
