package webapp

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	SessionCookieName = "opl_session"
	sessionVersion    = "account_v1"
	AuthMode          = "public_account"
)

type SessionClaims struct {
	UserID      string `json:"userId"`
	TenantID    string `json:"tenantId"`
	WorkspaceID string `json:"workspaceId"`
	Email       string `json:"email"`
}

func hashPassword(password string) (string, error) {
	password = strings.TrimSpace(password)
	if len(password) < 12 {
		return "", errInvalidCredentialsInput
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func verifyPassword(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func signSession(claims SessionClaims) (string, error) {
	secret := os.Getenv("OPL_SESSION_SECRET")
	if secret == "" {
		return "", errSessionSecretMissing
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	segment := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(sessionVersion + "." + segment))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return sessionVersion + "." + segment + "." + signature, nil
}

func parseSessionCookie(request *http.Request) (SessionClaims, error) {
	cookie, err := request.Cookie(SessionCookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return SessionClaims{}, errAuthRequired
	}
	return parseSessionToken(strings.TrimSpace(cookie.Value))
}

func parseSessionToken(token string) (SessionClaims, error) {
	secret := os.Getenv("OPL_SESSION_SECRET")
	if secret == "" {
		return SessionClaims{}, errSessionSecretMissing
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != sessionVersion {
		return SessionClaims{}, errAuthRequired
	}
	expected := hmac.New(sha256.New, []byte(secret))
	expected.Write([]byte(parts[0] + "." + parts[1]))
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actual, expected.Sum(nil)) {
		return SessionClaims{}, errAuthRequired
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return SessionClaims{}, errAuthRequired
	}
	var claims SessionClaims
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return SessionClaims{}, errAuthRequired
	}
	if claims.UserID == "" || claims.TenantID == "" || claims.WorkspaceID == "" || claims.Email == "" {
		return SessionClaims{}, errAuthRequired
	}
	return claims, nil
}

func setSessionCookie(response http.ResponseWriter, token string) {
	http.SetCookie(response, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   os.Getenv("OPL_WEBUI_ENV") == "production" || os.Getenv("OPL_WEBUI_ENV") == "cloud_mvp",
	})
}

func clearSessionCookie(response http.ResponseWriter) {
	http.SetCookie(response, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func encryptAPIKey(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errInvalidAPIKey
	}
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(raw), nil)
	return base64.RawURLEncoding.EncodeToString(append(nonce, ciphertext...)), nil
}

func decryptAPIKey(encoded string) (string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("encrypted api key payload is invalid")
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func secretKey() []byte {
	secret := os.Getenv("OPL_API_KEY_ENCRYPTION_SECRET")
	if secret == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

func maskAPIKey(raw string) string {
	raw = strings.TrimSpace(raw)
	if len(raw) <= 7 {
		return "sk-***"
	}
	return fmt.Sprintf("%s***%s", raw[:3], raw[len(raw)-4:])
}
