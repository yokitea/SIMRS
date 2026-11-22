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

// BuildORM builds an HL7 v2.5 ORM^O01 message compatible with Core RIS pacs-bridge and Core PACS hl7-sync.
func BuildORM(o RadiologyOrderHL7, now time.Time) string {
	ts := now.Format("20060102150405")
	dob := strings.ReplaceAll(o.PatientBirthDate, "-", "")
	dicomName := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(o.PatientName), " ", "^"))
	return strings.Join([]string{
		fmt.Sprintf("MSH|^~\\&|CORE_SIMRS|HOSPITAL|CORE_RIS|HOSPITAL|%s||ORM^O01|%s|P|2.5", ts, o.ControlID),
		fmt.Sprintf("PID|1||%s^^^RS||%s||%s|%s", o.PatientID, dicomName, dob, o.PatientSex),
		fmt.Sprintf("ORC|NW|%s|%s", o.ControlID, o.AccessionNumber),
		fmt.Sprintf("OBR|1|%s|%s|%s^%s||||||||||||||||||||%s", o.ControlID, o.AccessionNumber, o.ProcedureCode, o.ProcedureName, o.Modality),
		fmt.Sprintf("ZDS|%s^^Application^DICOM", o.StudyInstanceUID),
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
