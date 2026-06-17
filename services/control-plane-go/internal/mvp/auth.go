package mvp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

const launchTokenAuthMode = "medopl_launch_token"
const sessionCookieName = "opl_session"
const sessionTokenVersion = "session_v1"

type launchTokenClaims struct {
	TenantID    string `json:"tenantId"`
	WorkspaceID string `json:"workspaceId"`
	UserID      string `json:"userId"`
}

type LaunchTokenClaims = launchTokenClaims

type taskAuthError struct {
	StatusCode int
	ErrorCode  string
	Message    string
}

func (err *taskAuthError) Error() string {
	return err.Message
}

func applyTaskAuthBoundary(request *http.Request, payload TaskRequest) (TaskRequest, *taskAuthError) {
	if !tenantAuthEnforced() {
		return applyPreviewIdentity(payload), nil
	}

	claims, authErr := launchClaimsFromRequest(request)
	if authErr != nil {
		return TaskRequest{}, authErr
	}
	if identityConflicts(payload.TenantID, claims.TenantID) ||
		identityConflicts(payload.WorkspaceID, claims.WorkspaceID) ||
		identityConflicts(payload.UserID, claims.UserID) {
		return TaskRequest{}, boundaryMismatch()
	}

	payload.TenantID = claims.TenantID
	payload.WorkspaceID = claims.WorkspaceID
	payload.UserID = claims.UserID
	return payload, nil
}

func authorizeTaskLookup(request *http.Request, tenantID string, workspaceID string) (*launchTokenClaims, *taskAuthError) {
	if !tenantAuthEnforced() {
		return nil, nil
	}

	claims, authErr := launchClaimsFromRequest(request)
	if authErr != nil {
		return nil, authErr
	}
	if strings.TrimSpace(tenantID) != claims.TenantID || strings.TrimSpace(workspaceID) != claims.WorkspaceID {
		return nil, boundaryMismatch()
	}
	return &claims, nil
}

func tenantAuthEnforced() bool {
	environment := os.Getenv("OPL_WEBUI_ENV")
	return (environment == "cloud_mvp" || environment == "production") &&
		os.Getenv("OPL_TENANT_AUTH_MODE") == launchTokenAuthMode
}

func applyPreviewIdentity(payload TaskRequest) TaskRequest {
	if strings.TrimSpace(payload.TenantID) == "" {
		payload.TenantID = "tenant_demo"
	}
	if strings.TrimSpace(payload.WorkspaceID) == "" {
		payload.WorkspaceID = "workspace_demo"
	}
	if strings.TrimSpace(payload.UserID) == "" {
		payload.UserID = "user_demo"
	}
	return payload
}

func launchClaimsFromRequest(request *http.Request) (launchTokenClaims, *taskAuthError) {
	token := bearerToken(request.Header.Get("authorization"))
	if token != "" {
		return parseSignedClaimsToken(token, "v1")
	}
	cookie, err := request.Cookie(sessionCookieName)
	if err == nil && strings.TrimSpace(cookie.Value) != "" {
		return parseSignedClaimsToken(strings.TrimSpace(cookie.Value), sessionTokenVersion)
	}
	return launchTokenClaims{}, &taskAuthError{
		StatusCode: http.StatusUnauthorized,
		ErrorCode:  "AUTH_REQUIRED",
		Message:    "authorization bearer token or session cookie is required",
	}
}

func bearerToken(header string) string {
	prefix := "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func parseLaunchToken(token string) (launchTokenClaims, *taskAuthError) {
	return parseSignedClaimsToken(token, "v1")
}

func signSessionToken(claims launchTokenClaims) (string, *taskAuthError) {
	return signClaimsToken(sessionTokenVersion, claims)
}

func signClaimsToken(version string, claims launchTokenClaims) (string, *taskAuthError) {
	secret := os.Getenv("OPL_TENANT_AUTH_SECRET")
	if secret == "" {
		return "", invalidLaunchToken()
	}
	claimsPayload, err := json.Marshal(claims)
	if err != nil {
		return "", invalidLaunchToken()
	}
	payloadSegment := base64.RawURLEncoding.EncodeToString(claimsPayload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(version + "." + payloadSegment))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return version + "." + payloadSegment + "." + signature, nil
}

func parseSignedClaimsToken(token string, version string) (launchTokenClaims, *taskAuthError) {
	secret := os.Getenv("OPL_TENANT_AUTH_SECRET")
	if secret == "" {
		return launchTokenClaims{}, invalidLaunchToken()
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != version {
		return launchTokenClaims{}, invalidLaunchToken()
	}
	expectedMAC := hmac.New(sha256.New, []byte(secret))
	expectedMAC.Write([]byte(parts[0] + "." + parts[1]))
	expectedSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(expectedSignature, expectedMAC.Sum(nil)) {
		return launchTokenClaims{}, invalidLaunchToken()
	}

	claimsPayload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return launchTokenClaims{}, invalidLaunchToken()
	}
	var claims launchTokenClaims
	if err := json.Unmarshal(claimsPayload, &claims); err != nil {
		return launchTokenClaims{}, invalidLaunchToken()
	}
	claims.TenantID = strings.TrimSpace(claims.TenantID)
	claims.WorkspaceID = strings.TrimSpace(claims.WorkspaceID)
	claims.UserID = strings.TrimSpace(claims.UserID)
	if !isStableBoundaryID(claims.TenantID) ||
		!isStableBoundaryID(claims.WorkspaceID) ||
		!isStableBoundaryID(claims.UserID) {
		return launchTokenClaims{}, invalidLaunchToken()
	}
	return claims, nil
}

func identityConflicts(bodyValue string, claimValue string) bool {
	bodyValue = strings.TrimSpace(bodyValue)
	return bodyValue != "" && bodyValue != claimValue
}

func invalidLaunchToken() *taskAuthError {
	return &taskAuthError{
		StatusCode: http.StatusUnauthorized,
		ErrorCode:  "INVALID_LAUNCH_TOKEN",
		Message:    "launch token is invalid",
	}
}

func boundaryMismatch() *taskAuthError {
	return &taskAuthError{
		StatusCode: http.StatusForbidden,
		ErrorCode:  "TENANT_BOUNDARY_MISMATCH",
		Message:    "request identity does not match tenant boundary",
	}
}
