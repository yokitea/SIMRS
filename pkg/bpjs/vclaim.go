package bpjs

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// AuthHeaders contains the standard BPJS Kesehatan VClaim / Antrol HTTP headers.
type AuthHeaders struct {
	ConsID    string `json:"X-cons-id"`
	Timestamp string `json:"X-timestamp"`
	Signature string `json:"X-signature"`
	UserKey   string `json:"user_key"`
}

// BuildHeaders computes BPJS Kesehatan HMAC-SHA256 signature:
//   data = consID + "&" + unixTimestamp
//   X-signature = Base64(HMAC-SHA256(secretKey, data))
func BuildHeaders(consID, secretKey, userKey string, now time.Time) AuthHeaders {
	ts := strconv.FormatInt(now.UTC().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(consID + "&" + ts))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return AuthHeaders{
		ConsID:    consID,
		Timestamp: ts,
		Signature: sig,
		UserKey:   userKey,
	}
}

// DecryptResponse decrypts BPJS VClaim 2.0 AES-256-CBC encrypted response payload:
//   key = SHA256(consID + secretKey + timestamp)  (32 bytes)
//   iv  = key[:16]                                (16 bytes)
func DecryptResponse(consID, secretKey, timestamp, b64Ciphertext string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(b64Ciphertext)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || len(raw)%aes.BlockSize != 0 {
		return nil, errors.New("bpjs: invalid ciphertext block length")
	}
	key := sha256.Sum256([]byte(consID + secretKey + timestamp))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	plain := make([]byte, len(raw))
	cipher.NewCBCDecrypter(block, key[:16]).CryptBlocks(plain, raw)
	// Constant-time full PKCS#7 padding validation
	pad := int(plain[len(plain)-1])
	if pad == 0 || pad > aes.BlockSize || pad > len(plain) {
		return nil, errors.New("bpjs: invalid PKCS7 padding")
	}
	var diff byte
	for i := len(plain) - pad; i < len(plain); i++ {
		diff |= plain[i] ^ byte(pad)
	}
	if diff != 0 {
		return nil, errors.New("bpjs: invalid PKCS7 padding")
	}
	return plain[:len(plain)-pad], nil
}

// GenerateSEPNumber generates a standard 19-character BPJS SEP format: {PPK8}{MM}{YY}V{SEQ6}.
func GenerateSEPNumber(ppkCode string, now time.Time, seq int64) string {
	ppk := strings.TrimSpace(ppkCode)
	if len(ppk) != 8 {
		ppk = "0112R001"
	}
	if seq < 0 {
		seq = -seq
	}
	return fmt.Sprintf("%s%02d%02dV%06d", ppk, now.Month(), now.Year()%100, seq%1000000)
}

// EstimateINACBG returns a realistic Indonesian INA-CBG grouping code and tariff estimate based on ICD-10 & class.
func EstimateINACBG(icd10, serviceType, careClass string) (code string, tariffIDR int64) {
	upper := strings.ToUpper(strings.TrimSpace(icd10))
	if strings.EqualFold(serviceType, "RJ") || strings.EqualFold(serviceType, "IGD") {
		return "Q-5-44-0", 185000
	}
	switch {
	case strings.HasPrefix(upper, "J"):
		code, tariffIDR = "J-4-16-I", 3450000
	case strings.HasPrefix(upper, "I"):
		code, tariffIDR = "I-4-17-I", 4850000
	case strings.HasPrefix(upper, "K"):
		code, tariffIDR = "K-4-17-I", 3120000
	default:
		code, tariffIDR = "A-4-14-I", 2650000
	}
	switch strings.ToUpper(careClass) {
	case "KELAS_1", "VIP":
		tariffIDR = int64(float64(tariffIDR) * 1.40)
	case "KELAS_2":
		tariffIDR = int64(float64(tariffIDR) * 1.20)
	}
	return code, tariffIDR
}
