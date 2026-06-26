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
		projection := localRuntimeBlocker(blocker)
		server.recordTaskProjection(runtimeContext.User, runtimeContext.Task, projection)
		writeJSON(response, http.StatusFailedDependency, projection)
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
	server.recordTaskProjection(runtimeContext.User, runtimeContext.Task, projection)
	writeJSON(response, status, projection)
}

func (server Server) HandleRuntimeRun(response http.ResponseWriter, request *http.Request) {
	runtimeContext, ok := server.runtimeRequestContext(response, request)
	if !ok {
		return
	}
	if blocker, blocked := server.runtimeTaskBlocker(runtimeContext.User.ID); blocked {
		projection := localRuntimeBlocker(blocker)
		server.recordTaskProjection(runtimeContext.User, runtimeContext.Task, projection)
		writeJSON(response, http.StatusFailedDependency, projection)
		return
	}

	runPath, runPayload := medoplRuntimeRunRequest(runtimeContext.Task, runtimeContext.User)
	body, upstreamStatus, err := server.postMedOPL(request.Context(), runPath, runPayload)
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
	server.recordTaskProjection(runtimeContext.User, runtimeContext.Task, projection)
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
		"tenantId":       user.TenantID,
		"portalUserId":   user.ID,
		"userId":         user.ID,
		"workspaceId":    user.WorkspaceID,
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

func medoplRuntimeRunRequest(task runtimeTaskRequest, user User) (string, map[string]any) {
	launchID := safeString(task.GateRefs["launchId"])
	if launchID == "" {
		return "/api/opl/runs", medoplRuntimePayload(task, user)
	}
	payload := map[string]any{
		"message":   task.Prompt,
		"fileRefs":  stringListValue(task.GateRefs["fileRefs"]),
		"toolName":  task.TaskIntent,
		"requestId": valueOrDefault(task.ConversationID, task.TaskIntent),
	}
	return "/api/opl/runs?launchId=" + url.QueryEscape(launchID), payload
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
		blockerClass := "medopl_upstream"
		nextActionID := "open_medopl"
		blockerOwner := "MedOPL"
		if failure.Code == "MEDOPL_ENDPOINT_REQUIRED" {
			blockerClass = "operator_deployment_config"
			nextActionID = "configure_medopl_endpoint"
			blockerOwner = "one-person-lab-web-operator"
		}
		writeJSON(response, failure.Status, map[string]any{
			"ok": false, "errorCode": failure.Code, "message": "MedOPL bridge is unavailable",
			"blockerClass": blockerClass,
			"gateState": map[string]any{
				"ready": false,
				"blockers": []map[string]any{{
					"kind": "medopl_endpoint_required", "title": "MedOPL 暂时不可用", "deepLink": MedOPLURL + "/runtime", "owner": blockerOwner,
				}},
				"nextAction": map[string]any{"id": nextActionID, "label": "去 MedOPL", "deepLink": MedOPLURL + "/runtime"},
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
		"blockerClass": localBlockerClass(blocker.Kind),
		"gateState": map[string]any{
			"ready": false,
			"blockers": []map[string]any{{
				"kind": blocker.Kind, "title": blocker.Title, "deepLink": safeMedOPLLink(blocker.DeepLink), "owner": localBlockerOwner(blocker.Kind),
			}},
			"nextAction": map[string]any{"id": localBlockerActionID(blocker.Kind), "label": "去 MedOPL", "deepLink": safeMedOPLLink(blocker.DeepLink)},
		},
		"webuiRuntimeExecution": "forbidden",
	}
}

func localBlockerClass(kind string) string {
	if kind == "medopl_endpoint_required" {
		return "operator_deployment_config"
	}
	return "user_account_state"
}

func localBlockerOwner(kind string) string {
	if kind == "medopl_endpoint_required" {
		return "one-person-lab-web-operator"
	}
	return "MedOPL"
}

func localBlockerActionID(kind string) string {
	if kind == "medopl_endpoint_required" {
		return "configure_medopl_endpoint"
	}
	return kind
}

func runtimeGateProjection(body map[string]any) map[string]any {
	consumer := mapValue(body, "consumerProjection")
	runtimeState := stringValue(body, "runtimeState")
	storageState := stringValue(body, "storageState")
	ready := boolValue(consumer, "ready") || (boolValue(consumer, "runEnabled") && runtimeState == "ready" && storageState == "ready")
	gateState := map[string]any{
		"ready":             ready,
		"productOwner":      stringValue(body, "productOwner"),
		"primaryConsumer":   stringValue(body, "primaryConsumer"),
		"consumerRole":      stringValue(body, "consumerRole"),
		"runtimeState":      runtimeState,
		"storageState":      storageState,
		"providerKeyStatus": stringValue(body, "providerKeyStatus"),
		"billing":           sanitizedMap(mapValue(body, "billing"), "state", "freezeStatus", "deepLink"),
		"release":           sanitizedMap(mapValue(body, "release"), "state", "canReleaseRuntime", "destroyStorage", "stopBilling", "deepLink"),
		"refs":              sanitizedMap(mapValue(consumer, "refs"), "workspaceRef", "runtimeRef", "storageRef"),
		"blockers":          blockersFromConsumer(consumer, body),
		"nextAction":        nextActionFromConsumer(consumer, body),
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
			"run":                  sanitizedMap(mapValue(body, "run"), "runId", "runRef", "status", "runtimeBindingId", "workspaceBindingId"),
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
		"ledgerRefs":                sanitizedLedgerRefs(body["ledger"]),
		"releaseStatus":             safeString(summary["releaseStatus"]),
		"webuiBillingSourceOfTruth": "forbidden",
		"webuiPaymentMutation":      "forbidden",
	}
}

func (server Server) tryMedOPLBillingProjection(request *http.Request, user User, quota ChatQuotaStatus, events []AuditEvent) (map[string]any, bool) {
	if medoplAPIBaseURL() == "" {
		return nil, false
	}
	body, _, err := server.getMedOPL(request.Context(), "/api/billing/summary?workspaceId="+url.QueryEscape(user.WorkspaceID))
	if err != nil {
		return nil, false
	}
	return billingBridgeProjection(body, quota, events), true
}

func blockersFromConsumer(consumer map[string]any, body map[string]any) []map[string]any {
	blockers := sanitizedList(consumer["blockers"], "kind", "title", "nextAction", "deepLink")
	if len(blockers) == 0 {
		blocker := blockerFromActionContract(body)
		if len(blocker) == 0 {
			return []map[string]any{}
		}
		return []map[string]any{blocker}
	}
	return blockers
}

func nextActionFromConsumer(consumer map[string]any, body map[string]any) map[string]any {
	action := sanitizedMap(mapValue(consumer, "nextAction"), "id", "label", "deepLink")
	if len(action) == 0 {
		action = nextActionFromActionContract(body)
	}
	if len(action) == 0 {
		return map[string]any{"id": "open_medopl", "label": "去 MedOPL", "deepLink": MedOPLURL + "/runtime"}
	}
	if link, ok := action["deepLink"].(string); ok {
		action["deepLink"] = safeMedOPLLink(link)
	}
	return action
}

func blockerFromActionContract(body map[string]any) map[string]any {
	action := primaryActionFromBody(body)
	if len(action) == 0 {
		return map[string]any{}
	}
	kind := blockerKindForReason(safeString(action["reason"]))
	deepLink := safeMedOPLLink(safeString(action["medoplDeeplink"]))
	return map[string]any{
		"kind":       kind,
		"title":      titleForBlockerKind(kind),
		"nextAction": safeString(action["action"]),
		"deepLink":   deepLink,
	}
}

func nextActionFromActionContract(body map[string]any) map[string]any {
	action := primaryActionFromBody(body)
	if len(action) == 0 {
		return map[string]any{}
	}
	id := safeString(action["action"])
	return map[string]any{
		"id":       valueOrDefault(id, "open_medopl"),
		"label":    labelForAction(id),
		"deepLink": safeMedOPLLink(safeString(action["medoplDeeplink"])),
	}
}

func primaryActionFromBody(body map[string]any) map[string]any {
	return mapValue(mapValue(body, "actionContract"), "primaryAction")
}

func blockerKindForReason(reason string) string {
	switch reason {
	case "provider_key_required":
		return "provider_key_required"
	case "account_required", "plan_required", "package_required", "credit_required", "insufficient_balance":
		return "package_required"
	case "runtime_storage_not_opened", "runtime_storage_pending":
		return "compute_required"
	case "runtime_storage_released":
		return "release_required"
	case "runtime_storage_failed":
		return "audit_required"
	default:
		return "runtime_blocked"
	}
}

func titleForBlockerKind(kind string) string {
	switch kind {
	case "provider_key_required":
		return "需要在 MedOPL 绑定 provider key"
	case "package_required":
		return "需要购买套餐或充值"
	case "compute_required":
		return "需要开通 compute resource"
	case "storage_required":
		return "需要开通 storage space"
	case "release_required":
		return "需要处理 release 状态"
	case "audit_required":
		return "需要处理 audit 状态"
	default:
		return "MedOPL runtime gate blocked"
	}
}

func labelForAction(action string) string {
	switch action {
	case "open_medopl_purchase":
		return "去 MedOPL 购买"
	case "select_plan":
		return "选择套餐"
	case "recharge_or_credit_required":
		return "充值或开通额度"
	case "open_runtime_storage":
		return "开通 runtime/storage"
	case "return_to_opl_task":
		return "返回任务"
	default:
		return "去 MedOPL"
	}
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
	result := []map[string]any{}
	for _, item := range mapItems(value) {
		if mapped, ok := item.(map[string]any); ok {
			result = append(result, sanitizedMap(mapped, fields...))
		}
	}
	return result
}

func mapItems(value any) []any {
	switch typed := value.(type) {
	case []any:
		return typed
	case []map[string]any:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, item)
		}
		return items
	default:
		return []any{}
	}
}

func sanitizedLedgerRefs(value any) []map[string]any {
	items, ok := value.([]any)
	if !ok {
		return []map[string]any{}
	}
	result := []map[string]any{}
	for _, item := range items {
		mapped, ok := item.(map[string]any)
		if !ok {
			continue
		}
		ledgerRef := sanitizedMap(mapped, "ledgerEntryId", "entryType", "amount", "currency", "sourceEventId")
		if _, ok := ledgerRef["ledgerEntryId"]; !ok {
			if id := safeString(mapped["id"]); id != "" {
				ledgerRef["ledgerEntryId"] = id
			}
		}
		if _, ok := ledgerRef["entryType"]; !ok {
			if entryType := safeString(mapped["type"]); entryType != "" {
				ledgerRef["entryType"] = entryType
			}
		}
		result = append(result, ledgerRef)
	}
	return result
}

func stringListValue(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return []string{}
	}
	result := []string{}
	for _, item := range items {
		text := safeString(item)
		if text != "" {
			result = append(result, text)
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
	if strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//") {
		return MedOPLURL + value
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

func (server Server) recordTaskProjection(user User, task runtimeTaskRequest, projection map[string]any) {
	item := taskHistoryFromProjection(user, task, projection)
	if item.TaskIntent == "" {
		return
	}
	_, _ = server.Store.UpsertTaskHistory(item)
}

func taskHistoryFromProjection(user User, task runtimeTaskRequest, projection map[string]any) TaskHistoryItem {
	status := valueOrDefault(safeString(projection["status"]), taskHistoryStatus(projection))
	nextAction := taskHistoryNextAction(projection)
	item := TaskHistoryItem{
		ID:                 taskHistoryID(user.ID, task),
		UserID:             user.ID,
		ConversationID:     task.ConversationID,
		TaskType:           task.TaskIntent,
		TaskIntent:         task.TaskIntent,
		Marker:             task.Marker,
		Status:             status,
		ProgressRefs:       progressRefsFromProjection(projection),
		DeliverableRefs:    deliverableRefsFromProjection(projection),
		MaterialRefs:       materialRefsFromTask(task),
		NextStep:           nextAction.ID,
		AllowedNextActions: []TaskNextAction{nextAction},
		DeepLink:           nextAction.DeepLink,
		WebuiArtifactBody:  "forbidden",
		WebuiStorageTruth:  "forbidden",
	}
	if blocker := blockerFromProjection(projection); blocker != nil {
		item.Blocker = blocker
		item.NextStep = valueOrDefault(blocker.NextAction, item.NextStep)
	}
	return item
}

func taskHistoryID(userID string, task runtimeTaskRequest) string {
	seed := valueOrDefault(task.ConversationID, task.TaskIntent+"_"+task.Marker+"_"+task.Prompt)
	return "task_" + safeID(userID+"_"+seed)
}

func taskHistoryStatus(projection map[string]any) string {
	if projection["ok"] == true {
		return "running"
	}
	return "blocked"
}

func taskHistoryNextAction(projection map[string]any) TaskNextAction {
	if action := actionFromRunProjection(projection); action.ID != "" {
		return action
	}
	if action := actionFromGateProjection(projection); action.ID != "" {
		return action
	}
	return TaskNextAction{ID: "continue_in_medopl", Label: "继续", DeepLink: MedOPLURL}
}

func actionFromRunProjection(projection map[string]any) TaskNextAction {
	if projection["ok"] != true {
		return TaskNextAction{}
	}
	link := safeMedOPLLink(safeString(projection["statusUrl"]))
	return TaskNextAction{ID: "continue_in_medopl", Label: "继续", DeepLink: link}
}

func actionFromGateProjection(projection map[string]any) TaskNextAction {
	gateState := mapValue(projection, "gateState")
	action := mapValue(gateState, "nextAction")
	id := safeString(action["id"])
	if id == "" {
		return TaskNextAction{}
	}
	return TaskNextAction{ID: id, Label: valueOrDefault(safeString(action["label"]), labelForAction(id)), DeepLink: safeMedOPLLink(safeString(action["deepLink"]))}
}

func progressRefsFromProjection(projection map[string]any) []TaskRef {
	refs := []TaskRef{}
	for _, item := range sanitizedList(projection["progress"], "stage", "state", "title") {
		ref := valueOrDefault(safeString(item["stage"]), safeString(item["state"]))
		if ref != "" {
			refs = append(refs, TaskRef{Ref: ref, Label: safeString(item["title"]), Status: safeString(item["state"]), Kind: "progress", Source: "MedOPL"})
		}
	}
	return refs
}

func deliverableRefsFromProjection(projection map[string]any) []TaskRef {
	refs := []TaskRef{}
	for _, item := range sanitizedList(projection["deliverables"], "deliverableId", "artifactRef", "status", "title", "kind", "ref") {
		ref := valueOrDefault(safeString(item["deliverableId"]), valueOrDefault(safeString(item["ref"]), safeString(item["artifactRef"])))
		if ref != "" {
			refs = append(refs, TaskRef{Ref: ref, Label: safeString(item["title"]), Status: safeString(item["status"]), Kind: valueOrDefault(safeString(item["kind"]), "deliverable"), Source: "MedOPL"})
		}
	}
	return refs
}

func materialRefsFromTask(task runtimeTaskRequest) []TaskRef {
	refs := []TaskRef{}
	for _, ref := range stringListValue(task.GateRefs["fileRefs"]) {
		refs = append(refs, TaskRef{Ref: safeString(ref), Kind: "material", Source: "MedOPL"})
	}
	return refs
}

func blockerFromProjection(projection map[string]any) *TaskBlocker {
	if blocker := runtimeBlocker(mapValue(projection, "blocker")); safeString(blocker["kind"]) != "runtime_blocked" || len(mapValue(projection, "blocker")) > 0 {
		return &TaskBlocker{Kind: safeString(blocker["kind"]), Title: safeString(blocker["title"]), NextAction: safeString(blocker["nextAction"]), DeepLink: safeMedOPLLink(safeString(blocker["deepLink"]))}
	}
	gateState := mapValue(projection, "gateState")
	blockers := sanitizedList(gateState["blockers"], "kind", "title", "nextAction", "deepLink")
	if len(blockers) == 0 {
		return nil
	}
	first := blockers[0]
	return &TaskBlocker{Kind: safeString(first["kind"]), Title: safeString(first["title"]), NextAction: safeString(mapValue(gateState, "nextAction")["id"]), DeepLink: safeMedOPLLink(safeString(first["deepLink"]))}
}

func safeID(value string) string {
	replacer := strings.NewReplacer("@", "", " ", "_", "/", "_", "\\", "_", ":", "_", "?", "_", "&", "_", "=", "_")
	text := replacer.Replace(strings.ToLower(safeString(value)))
	if len(text) > 96 {
		text = text[:96]
	}
	return text
}
