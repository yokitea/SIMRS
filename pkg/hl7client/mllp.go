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

// InboundORU represents a parsed HL7 v2 ORU^R01 radiology expertise report returned from Core RIS (IHE RAD-28).
type InboundORU struct {
	ControlID       string
	AccessionNumber string
	PatientID       string
	ReportStatus    string
	RadiologistName string
	ReportText      string
}

func ParseORU(raw string) InboundORU {
	raw = strings.ReplaceAll(raw, "\r\n", "\r")
	raw = strings.ReplaceAll(raw, "\n", "\r")
	var out InboundORU
	var lines []string
	for _, seg := range strings.Split(raw, "\r") {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		f := strings.Split(seg, "|")
		get := func(i int) string {
			if i >= 0 && i < len(f) {
				return strings.TrimSpace(f[i])
			}
			return ""
		}
		switch f[0] {
		case "MSH":
			out.ControlID = get(9)
		case "PID":
			pid := get(3)
			if i := strings.IndexByte(pid, '^'); i >= 0 {
				pid = pid[:i]
			}
			out.PatientID = pid
		case "OBR":
			acc := get(3)
			if i := strings.IndexByte(acc, '^'); i >= 0 {
				acc = acc[:i]
			}
			out.AccessionNumber = acc
			st := get(25)
			if strings.EqualFold(st, "C") {
				out.ReportStatus = "AMENDED"
			} else {
				out.ReportStatus = "FINAL"
			}
			out.RadiologistName = get(32)
		case "OBX":
			txt := get(5)
			if txt != "" {
				txt = strings.ReplaceAll(txt, `\X0A\`, "\n")
				txt = strings.ReplaceAll(txt, `\.br\`, "\n")
				lines = append(lines, txt)
			}
		}
	}
	out.ReportText = strings.Join(lines, "\n\n")
	return out
}

func BuildACK(controlID, code, text string) string {
	if controlID == "" {
		controlID = "UNKNOWN"
	}
	return fmt.Sprintf("MSH|^~\\&|CORE_SIMRS|HOSPITAL|CORE_RIS|HOSPITAL|%s||ACK|%s|P|2.5\rMSA|%s|%s|%s\r",
		time.Now().Format("20060102150405"), controlID, code, controlID, text)
}

// HandleMLLPConn reads framed HL7 ORU^R01 messages from Core RIS and responds with HL7 ACK.
func HandleMLLPConn(conn net.Conn, onORU func(InboundORU) error) {
	defer conn.Close()
	r := bufio.NewReaderSize(conn, 256*1024)
	for {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		// Seek VT (0x0B)
		for {
			b, err := r.ReadByte()
			if err != nil {
				return
			}
			if b == 0x0B {
				break
			}
		}
		raw, err := r.ReadString(0x1C)
		if err != nil {
			return
		}
		_, _ = r.ReadByte() // trailing CR (0x0D)
		msg := strings.TrimRight(raw, "\x1c")
		oru := ParseORU(msg)
		ack := BuildACK(oru.ControlID, "AA", "Radiology report attached to SIMRS RME")
		if err := onORU(oru); err != nil {
			ack = BuildACK(oru.ControlID, "AE", err.Error())
		}
		frame := append([]byte{0x0B}, []byte(ack)...)
		frame = append(frame, 0x1C, 0x0D)
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if _, err := conn.Write(frame); err != nil {
			return
		}
	}
}
