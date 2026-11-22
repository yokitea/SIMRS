package bpjs

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"testing"
	"time"
)

func TestBPJSHeadersAndDecrypt(t *testing.T) {
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	h := BuildHeaders("12345", "secretXYZ", "ukey999", now)
	if h.ConsID != "12345" || h.Signature == "" || h.Timestamp == "" {
		t.Fatalf("unexpected BPJS headers: %+v", h)
	}

	// Encrypt test payload with exact BPJS AES-256-CBC scheme and verify DecryptResponse
	plain := []byte(`{"peserta":{"noKartu":"0001234567890","nama":"BUDI SANTOSO"}}`)
	padLen := aes.BlockSize - (len(plain) % aes.BlockSize)
	padded := append(append([]byte(nil), plain...), bytes.Repeat([]byte{byte(padLen)}, padLen)...)
	key := sha256.Sum256([]byte("12345" + "secretXYZ" + h.Timestamp))
	block, _ := aes.NewCipher(key[:])
	ct := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, key[:16]).CryptBlocks(ct, padded)

	got, err := DecryptResponse("12345", "secretXYZ", h.Timestamp, base64.StdEncoding.EncodeToString(ct))
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("DecryptResponse mismatch: err=%v got=%q", err, string(got))
	}

	sep := GenerateSEPNumber("0112R001", now, 42)
	if len(sep) != 19 || sep != "0112R0011126V000042" {
		t.Fatalf("unexpected SEP: %s", sep)
	}
}
