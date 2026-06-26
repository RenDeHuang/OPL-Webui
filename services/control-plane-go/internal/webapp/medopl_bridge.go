package webapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

const defaultMedOPLTimeout = 10 * time.Second

var (
	apiKeyPattern     = regexp.MustCompile(`sk-[A-Za-z0-9_-]+`)
	medoplDatabaseURL = regexp.MustCompile(`(?i)postgres(?:ql)?://\S+`)
)

type runtimeTaskRequest struct {
	TaskIntent     string         `json:"taskIntent"`
	Marker         string         `json:"marker"`
	Prompt         string         `json:"prompt"`
	ConversationID string         `json:"conversationId,omitempty"`
	GateRefs       map[string]any `json:"gateRefs,omitempty"`
}

type medoplFailure struct {
	Status int
	Code   string
	Err    error
}

type medoplLocalBlocker struct {
	ErrorCode string
	Kind      string
	Title     string
	DeepLink  string
}

type runtimeTaskContext struct {
	User User
	Task runtimeTaskRequest
}

func (failure medoplFailure) Error() string {
	if failure.Err != nil {
		return failure.Err.Error()
	}
	return failure.Code
}

func (server Server) HandleRuntimeGate(response http.ResponseWriter, request *http.Request) {
	runtimeContext, ok := server.runtimeRequestContext(response, request)
	if !ok {
		return
	}
	if blocker, blocked := server.runtimeTaskBlocker(runtimeContext.User.ID); blocked {
		server.recordRuntimeAudit(runtimeContext.User.ID, "runtime_gate.blocked", runtimeContext.Task, blocker.Kind)
		writeJSON(response, http.StatusFailedDependency, localRuntimeBlocker(blocker))
		return
	}

	body, _, err := server.postMedOPL(request.Context(), "/api/opl/runtime-gate", medoplRuntimePayload(runtimeContext.Task, runtimeContext.User))
	if err != nil {
		writeMedOPLFailure(response, err)
		return
	}
	projection := runtimeGateProjection(body)
	status := http.StatusOK
	if projection["ok"] == false {
		status = http.StatusFailedDependency
	}
	server.recordRuntimeAudit(runtimeContext.User.ID, auditKindForGateProjection(projection), runtimeContext.Task, "")
	writeJSON(response, status, projection)
}

func (server Server) HandleRuntimeRun(response http.ResponseWriter, request *http.Request) {
	runtimeContext, ok := server.runtimeRequestContext(response, request)
	if !ok {
		return
	}
	if blocker, blocked := server.runtimeTaskBlocker(runtimeContext.User.ID); blocked {
		writeJSON(response, http.StatusFailedDependency, localRuntimeBlocker(blocker))
		return
	}

	body, upstreamStatus, err := server.postMedOPL(request.Context(), "/api/opl/runs", medoplRuntimePayload(runtimeContext.Task, runtimeContext.User))
	if err != nil {
		writeMedOPLFailure(response, err)
		return
	}
	projection := runtimeRunProjection(body)
	status := http.StatusOK
	if projection["ok"] == false || upstreamStatus == http.StatusFailedDependency {
		status = http.StatusFailedDependency
	}
	server.recordRuntimeAudit(runtimeContext.User.ID, auditKindForRunProjection(projection), runtimeContext.Task, "")
	writeJSON(response, status, projection)
}

func (server Server) runtimeRequestContext(response http.ResponseWriter, request *http.Request) (runtimeTaskContext, bool) {
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return runtimeTaskContext{}, false
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return runtimeTaskContext{}, false
	}
	task, ok := decodeRuntimeTask(response, request)
	if !ok {
		return runtimeTaskContext{}, false
	}
	return runtimeTaskContext{User: user, Task: task}, true
}

func (server Server) runtimeTaskBlocker(userID string) (medoplLocalBlocker, bool) {
	if _, ok := server.Store.GetAPIKeyBinding(userID); !ok {
		return medoplLocalBlocker{
			ErrorCode: "API_KEY_REQUIRED",
			Kind:      "api_key_required",
			Title:     "需要绑定 API Key",
			DeepLink:  MedOPLURL + "/account/api-key",
		}, true
	}
	if medoplAPIBaseURL() == "" {
		return medoplLocalBlocker{
			ErrorCode: "MEDOPL_ENDPOINT_REQUIRED",
			Kind:      "medopl_endpoint_required",
			Title:     "MedOPL endpoint 未配置",
			DeepLink:  MedOPLURL + "/runtime",
		}, true
	}
	return medoplLocalBlocker{}, false
}

func (server Server) recordRuntimeAudit(userID string, eventKind string, task runtimeTaskRequest, blocker string) {
	metadata := map[string]string{"taskIntent": task.TaskIntent, "marker": task.Marker}
	if blocker != "" {
		metadata["blocker"] = blocker
	}
	server.recordAudit(userID, eventKind, metadata)
}

func decodeRuntimeTask(response http.ResponseWriter, request *http.Request) (runtimeTaskRequest, bool) {
	var task runtimeTaskRequest
	if !decodeStrict(response, request, &task) {
		return runtimeTaskRequest{}, false
	}
	task = normalizedRuntimeTask(task)
	if !validRuntimeTask(task) {
		writeError(response, http.StatusBadRequest, "INVALID_CHAT_MESSAGE", "runtime task intent, marker, and prompt are required")
		return runtimeTaskRequest{}, false
	}
	return task, true
}

func normalizedRuntimeTask(task runtimeTaskRequest) runtimeTaskRequest {
	task.TaskIntent = strings.TrimSpace(task.TaskIntent)
	task.Marker = strings.TrimSpace(task.Marker)
	task.Prompt = strings.TrimSpace(task.Prompt)
	return task
}

func validRuntimeTask(task runtimeTaskRequest) bool {
	return task.TaskIntent != "" && task.Marker != "" && task.Prompt != "" && isRuntimeRequiredMarker(task.Marker)
}

func isRuntimeRequiredMarker(marker string) bool {
	for _, candidate := range []string{"@论文", "@基金", "@综述", "@文件", "@PPT", "@书"} {
		if marker == candidate {
			return true
		}
	}
	return false
}

func medoplRuntimePayload(task runtimeTaskRequest, user User) map[string]any {
	payload := map[string]any{
		"taskIntent":     task.TaskIntent,
		"marker":         task.Marker,
		"prompt":         task.Prompt,
		"conversationId": task.ConversationID,
		"invocationMode": "runtime_required",
		"productOwner":   "one-person-lab-web",
		"consumerRole":   "entry_and_chat_surface",
		"user": map[string]any{
			"userId":   user.ID,
			"email":    user.Email,
			"tenantId": user.TenantID,
		},
		"workspace": map[string]any{
			"tenantId":    user.TenantID,
			"workspaceId": user.WorkspaceID,
		},
		"providerKey": map[string]any{
			"provider":       ProviderName,
			"status":         "bound",
			"providerKeyRef": "opl_webui_provider_key_ref",
		},
	}
	if len(task.GateRefs) > 0 {
		payload["gateRefs"] = task.GateRefs
	}
	return payload
}

func (server Server) postMedOPL(ctx context.Context, path string, payload map[string]any) (map[string]any, int, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return server.doMedOPL(ctx, http.MethodPost, path, encoded)
}

func (server Server) getMedOPL(ctx context.Context, path string) (map[string]any, int, error) {
	return server.doMedOPL(ctx, http.MethodGet, path, nil)
}

func (server Server) doMedOPL(ctx context.Context, method string, path string, encoded []byte) (map[string]any, int, error) {
	client := &http.Client{Timeout: defaultMedOPLTimeout}
	req, err := newMedOPLRequest(ctx, method, path, encoded)
	if err != nil {
		return nil, 0, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, medoplNetworkFailure(ctx, err)
	}
	defer resp.Body.Close()

	return decodeMedOPLResponse(resp)
}

func newMedOPLRequest(ctx context.Context, method string, path string, encoded []byte) (*http.Request, error) {
	base := medoplAPIBaseURL()
	if base == "" {
		return nil, medoplFailure{Status: http.StatusFailedDependency, Code: "MEDOPL_ENDPOINT_REQUIRED"}
	}
	req, err := http.NewRequestWithContext(ctx, method, base+path, bytes.NewReader(encoded))
	if err != nil {
		return nil, medoplFailure{Status: http.StatusFailedDependency, Code: "MEDOPL_ENDPOINT_REQUIRED", Err: err}
	}
	if encoded != nil {
		req.Header.Set("content-type", "application/json")
	}
	return req, nil
}

func medoplNetworkFailure(ctx context.Context, err error) medoplFailure {
	status := http.StatusBadGateway
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		status = http.StatusGatewayTimeout
	}
	return medoplFailure{Status: status, Code: "MEDOPL_UPSTREAM_FAILED", Err: err}
}

func decodeMedOPLResponse(resp *http.Response) (map[string]any, int, error) {
	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, resp.StatusCode, medoplFailure{Status: http.StatusBadGateway, Code: "MEDOPL_UPSTREAM_FAILED", Err: err}
	}
	if resp.StatusCode >= 500 {
		return payload, resp.StatusCode, medoplFailure{Status: http.StatusBadGateway, Code: "MEDOPL_UPSTREAM_FAILED"}
	}
	return payload, resp.StatusCode, nil
}

func medoplAPIBaseURL() string {
	raw := strings.TrimSpace(os.Getenv("MEDOPL_API_BASE_URL"))
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || !validMedOPLBaseURL(parsed) {
		return ""
	}
	return strings.TrimRight(raw, "/")
}

func validMedOPLBaseURL(parsed *url.URL) bool {
	return parsed.Scheme != "" && parsed.Host != "" && medoplAPIScheme(parsed.Scheme)
}

func medoplAPIScheme(scheme string) bool {
	return scheme == "http" || scheme == "https"
}

func writeMedOPLFailure(response http.ResponseWriter, err error) {
	var failure medoplFailure
	if errors.As(err, &failure) {
		writeJSON(response, failure.Status, map[string]any{
			"ok": false, "errorCode": failure.Code, "message": "MedOPL bridge is unavailable",
			"gateState": map[string]any{
				"ready": false,
				"blockers": []map[string]any{{
					"kind": "medopl_endpoint_required", "title": "MedOPL 暂时不可用", "deepLink": MedOPLURL + "/runtime",
				}},
				"nextAction": map[string]any{"id": "open_medopl", "label": "去 MedOPL", "deepLink": MedOPLURL + "/runtime"},
			},
			"webuiRuntimeExecution": "forbidden",
		})
		return
	}
	writeError(response, http.StatusBadGateway, "MEDOPL_UPSTREAM_FAILED", "MedOPL bridge is unavailable")
}

func localRuntimeBlocker(blocker medoplLocalBlocker) map[string]any {
	return map[string]any{
		"ok": false, "errorCode": blocker.ErrorCode, "message": blocker.Title, "owner": "MedOPL",
		"gateState": map[string]any{
			"ready": false,
			"blockers": []map[string]any{{
				"kind": blocker.Kind, "title": blocker.Title, "deepLink": safeMedOPLLink(blocker.DeepLink),
			}},
			"nextAction": map[string]any{"id": blocker.Kind, "label": "去 MedOPL", "deepLink": safeMedOPLLink(blocker.DeepLink)},
		},
		"webuiRuntimeExecution": "forbidden",
	}
}

func runtimeGateProjection(body map[string]any) map[string]any {
	consumer := mapValue(body, "consumerProjection")
	ready := boolValue(consumer, "ready") || boolValue(body, "ok")
	gateState := map[string]any{
		"ready":             ready,
		"productOwner":      stringValue(body, "productOwner"),
		"primaryConsumer":   stringValue(body, "primaryConsumer"),
		"consumerRole":      stringValue(body, "consumerRole"),
		"runtimeState":      stringValue(body, "runtimeState"),
		"storageState":      stringValue(body, "storageState"),
		"providerKeyStatus": stringValue(body, "providerKeyStatus"),
		"billing":           sanitizedMap(mapValue(body, "billing"), "state", "deepLink"),
		"release":           sanitizedMap(mapValue(body, "release"), "state", "deepLink"),
		"refs":              sanitizedMap(mapValue(consumer, "refs"), "workspaceRef", "runtimeRef", "storageRef"),
		"blockers":          blockersFromConsumer(consumer),
		"nextAction":        nextActionFromConsumer(consumer),
	}
	projection := map[string]any{
		"ok": true, "owner": "MedOPL", "gateState": gateState,
		"webuiRuntimeExecution": "forbidden",
	}
	if !ready {
		projection["ok"] = false
		projection["errorCode"] = "RUNTIME_GATE_BLOCKED"
		projection["message"] = "MedOPL runtime gate is not ready"
	}
	return projection
}

func runtimeRunProjection(body map[string]any) map[string]any {
	if boolValue(body, "ok") {
		return map[string]any{
			"ok": true, "owner": "MedOPL",
			"status":               safeString(body["status"]),
			"statusUrl":            safeMedOPLLink(safeString(body["statusUrl"])),
			"run":                  sanitizedMap(mapValue(body, "run"), "runId", "runtimeBindingId", "workspaceBindingId"),
			"artifactRef":          safeString(body["artifactRef"]),
			"artifacts":            sanitizedList(body["artifacts"], "artifactRef", "kind", "title", "status"),
			"progress":             sanitizedList(body["progress"], "stage", "state", "title"),
			"deliverables":         sanitizedList(body["deliverables"], "deliverableId", "artifactRef", "status", "title", "kind", "ref"),
			"webuiArtifactBody":    "forbidden",
			"webuiDomainTruth":     "forbidden",
			"webuiStorageMutation": "forbidden",
		}
	}
	return map[string]any{
		"ok": false, "owner": "MedOPL", "errorCode": "RUNTIME_GATE_BLOCKED",
		"status":               valueOrDefault(safeString(body["status"]), "blocked"),
		"blocker":              runtimeBlocker(mapValue(body, "blocker")),
		"progress":             sanitizedList(body["progress"], "stage", "state", "title"),
		"artifacts":            sanitizedList(body["artifacts"], "artifactRef", "kind", "title", "status"),
		"webuiArtifactBody":    "forbidden",
		"webuiDomainTruth":     "forbidden",
		"webuiStorageMutation": "forbidden",
	}
}

func billingBridgeProjection(body map[string]any, quota ChatQuotaStatus, events []AuditEvent) map[string]any {
	latestEventKind := ""
	if len(events) > 0 {
		latestEventKind = events[len(events)-1].EventKind
	}
	summary := mapValue(body, "summary")
	return map[string]any{
		"ok": true, "owner": "MedOPL", "deepLink": MedOPLURL + "/billing",
		"quota":                     quota,
		"audit":                     map[string]any{"eventCount": len(events), "latestEventKind": latestEventKind},
		"billingSource":             valueOrDefault(safeString(body["source"]), "medopl"),
		"runCount":                  intValue(body["runCount"]),
		"ledgerCount":               intValue(body["ledgerCount"]),
		"summary":                   sanitizedMap(summary, "runCount", "balanceState", "releaseStatus"),
		"ledgerRefs":                sanitizedList(body["ledger"], "ledgerEntryId", "entryType", "amount", "currency", "sourceEventId"),
		"releaseStatus":             safeString(summary["releaseStatus"]),
		"webuiBillingSourceOfTruth": "forbidden",
		"webuiPaymentMutation":      "forbidden",
	}
}

func (server Server) tryMedOPLBillingProjection(request *http.Request, quota ChatQuotaStatus, events []AuditEvent) (map[string]any, bool) {
	if medoplAPIBaseURL() == "" {
		return nil, false
	}
	body, _, err := server.getMedOPL(request.Context(), "/api/billing/summary")
	if err != nil {
		return nil, false
	}
	return billingBridgeProjection(body, quota, events), true
}

func blockersFromConsumer(consumer map[string]any) []map[string]any {
	blockers := sanitizedList(consumer["blockers"], "kind", "title", "nextAction", "deepLink")
	if len(blockers) == 0 {
		return []map[string]any{}
	}
	return blockers
}

func nextActionFromConsumer(consumer map[string]any) map[string]any {
	action := sanitizedMap(mapValue(consumer, "nextAction"), "id", "label", "deepLink")
	if len(action) == 0 {
		return map[string]any{"id": "open_medopl", "label": "去 MedOPL", "deepLink": MedOPLURL + "/runtime"}
	}
	if link, ok := action["deepLink"].(string); ok {
		action["deepLink"] = safeMedOPLLink(link)
	}
	return action
}

func runtimeBlocker(blocker map[string]any) map[string]any {
	if len(blocker) == 0 {
		return map[string]any{"kind": "runtime_blocked", "title": "MedOPL runtime gate blocked", "deepLink": MedOPLURL + "/runtime"}
	}
	result := sanitizedMap(blocker, "kind", "title", "nextAction", "deepLink")
	if link, ok := result["deepLink"].(string); ok {
		result["deepLink"] = safeMedOPLLink(link)
	}
	return result
}

func sanitizedMap(source map[string]any, fields ...string) map[string]any {
	result := map[string]any{}
	for _, field := range fields {
		value, ok := source[field]
		if !ok || forbiddenMedOPLField(field) {
			continue
		}
		result[field] = sanitizedMedOPLValue(field, value)
	}
	return result
}

func sanitizedMedOPLValue(field string, value any) any {
	if medoplLinkField(field) {
		return safeMedOPLLink(safeString(value))
	}
	if typed, ok := value.(string); ok {
		return safeString(typed)
	}
	return value
}

func medoplLinkField(field string) bool {
	return field == "deepLink" || strings.HasSuffix(field, "Url")
}

func sanitizedList(value any, fields ...string) []map[string]any {
	items, ok := value.([]any)
	if !ok {
		return []map[string]any{}
	}
	result := []map[string]any{}
	for _, item := range items {
		if mapped, ok := item.(map[string]any); ok {
			result = append(result, sanitizedMap(mapped, fields...))
		}
	}
	return result
}

func mapValue(source map[string]any, key string) map[string]any {
	value, ok := source[key].(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return value
}

func stringValue(source map[string]any, key string) string {
	return safeString(source[key])
}

func boolValue(source map[string]any, key string) bool {
	value, _ := source[key].(bool)
	return value
}

func intValue(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	default:
		return 0
	}
}

func valueOrDefault(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func safeString(value any) string {
	text := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(toString(value), "\n", " "), "\r", " "))
	text = apiKeyPattern.ReplaceAllString(text, "[redacted-api-key]")
	text = medoplDatabaseURL.ReplaceAllString(text, "[redacted-database-url]")
	return text
}

func toString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		return fmt.Sprint(typed)
	}
}

func safeMedOPLLink(value string) string {
	if strings.HasPrefix(value, MedOPLURL) {
		return value
	}
	if value == "" {
		return MedOPLURL
	}
	return MedOPLURL
}

func forbiddenMedOPLField(field string) bool {
	switch field {
	case "artifactBody", "artifact_body", "domainVerdict", "rawProviderKey", "apiKey", "providerApiKey", "bearerToken", "launchToken", "runtimeToken", "kubeconfig", "signedUrl", "objectKey", "storageKey", "localPath", "rawObjectStoreSecret":
		return true
	default:
		return false
	}
}

func auditKindForGateProjection(projection map[string]any) string {
	if projection["ok"] == true {
		return "runtime_gate.ready"
	}
	return "runtime_gate.blocked"
}

func auditKindForRunProjection(projection map[string]any) string {
	if projection["ok"] == true {
		return "runtime_run.projected"
	}
	return "runtime_run.blocked"
}
