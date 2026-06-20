package webapp

import (
	"bytes"
	"context"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	ProviderName = "gflabtoken"
	FixedBaseURL = "https://gflabtoken.cn/v1"
	MedOPLURL    = "https://medopl.medopl.cn"

	defaultChatUpstreamTimeout = 60 * time.Second
)

type ChatClient struct {
	HTTPClient *http.Client
}

func (client ChatClient) HTTPTimeout() time.Duration {
	if client.HTTPClient != nil && client.HTTPClient.Timeout > 0 {
		return client.HTTPClient.Timeout
	}
	return chatUpstreamTimeout()
}

type UpstreamFailure struct {
	Kind   string
	Status int
	Host   string
	Model  string
}

func (failure UpstreamFailure) Error() string {
	if failure.Status > 0 {
		return fmt.Sprintf("chat upstream failed: %s status %d", failure.Kind, failure.Status)
	}
	return fmt.Sprintf("chat upstream failed: %s", failure.Kind)
}

func (failure UpstreamFailure) Timeout() bool {
	return failure.Kind == "request_timeout" || failure.Kind == "response_header_timeout"
}

func (failure UpstreamFailure) Public() map[string]any {
	payload := map[string]any{
		"kind":  failure.Kind,
		"host":  failure.Host,
		"model": failure.Model,
	}
	if failure.Status > 0 {
		payload["status"] = failure.Status
	}
	return payload
}

func (failure UpstreamFailure) Metadata(conversationID string) map[string]string {
	metadata := map[string]string{
		"conversationId": conversationID,
		"upstreamKind":   failure.Kind,
		"upstreamHost":   failure.Host,
		"upstreamModel":  failure.Model,
	}
	if failure.Status > 0 {
		metadata["upstreamStatus"] = strconv.Itoa(failure.Status)
	}
	return metadata
}

func (client ChatClient) Complete(ctx context.Context, apiKey string, message string) (string, error) {
	body := map[string]any{
		"model":        modelName(),
		"input":        message,
		"service_tier": "fast",
		"reasoning": map[string]string{
			"effort": "xhigh",
		},
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, upstreamChatURL(), bytes.NewReader(encoded))
	if err != nil {
		return "", err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("authorization", "Bearer "+apiKey)

	httpClient := client.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: client.HTTPTimeout()}
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return "", UpstreamFailure{Kind: classifyUpstreamNetworkError(ctx, err), Host: upstreamHost(), Model: modelName()}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", UpstreamFailure{Kind: "http_status", Status: response.StatusCode, Host: upstreamHost(), Model: modelName()}
	}
	var payload struct {
		OutputText string `json:"output_text"`
		Output     []struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", err
	}
	content := strings.TrimSpace(payload.OutputText)
	if content == "" {
		content = responseOutputText(payload.Output)
	}
	if content == "" {
		return "", UpstreamFailure{Kind: "empty_response", Host: upstreamHost(), Model: modelName()}
	}
	return content, nil
}

func chatUpstreamTimeout() time.Duration {
	value := strings.TrimSpace(os.Getenv("OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS"))
	if value == "" {
		return defaultChatUpstreamTimeout
	}
	seconds, err := strconv.Atoi(value)
	if err != nil || seconds < 10 || seconds > 180 {
		return defaultChatUpstreamTimeout
	}
	return time.Duration(seconds) * time.Second
}

func classifyUpstreamNetworkError(ctx context.Context, err error) string {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return "request_timeout"
	}

	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return "dns_error"
	}

	var unknownAuthority x509.UnknownAuthorityError
	if errors.As(err, &unknownAuthority) {
		return "tls_error"
	}

	var hostnameErr x509.HostnameError
	if errors.As(err, &hostnameErr) {
		return "tls_error"
	}

	var certificateInvalidErr x509.CertificateInvalidError
	if errors.As(err, &certificateInvalidErr) {
		return "tls_error"
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		if urlErr.Timeout() {
			return "response_header_timeout"
		}
		if isConnectFailure(urlErr.Err) {
			return "connect_error"
		}
	}

	if isConnectFailure(err) {
		return "connect_error"
	}

	return "network"
}

func isConnectFailure(err error) bool {
	var opErr *net.OpError
	if !errors.As(err, &opErr) {
		return false
	}
	return opErr.Op == "dial" || opErr.Op == "connect"
}

func requiresRuntime(message string) bool {
	for _, marker := range []string{"@基金", "@论文", "@综述", "@文件"} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func upstreamChatURL() string {
	baseURL := FixedBaseURL
	if os.Getenv("OPL_WEBUI_ENV") == "development" && os.Getenv("OPL_CHAT_TEST_UPSTREAM_BASE_URL") != "" {
		baseURL = os.Getenv("OPL_CHAT_TEST_UPSTREAM_BASE_URL")
	}
	return strings.TrimRight(baseURL, "/") + "/responses"
}

func upstreamHost() string {
	parsed, err := url.Parse(upstreamChatURL())
	if err != nil || parsed.Hostname() == "" {
		return "unknown"
	}
	return parsed.Hostname()
}

func modelName() string {
	if model := strings.TrimSpace(os.Getenv("OPL_CHAT_MODEL")); model != "" {
		return model
	}
	return "gpt-5.5"
}

func responseOutputText(output []struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}) string {
	for _, item := range output {
		for _, content := range item.Content {
			if text := strings.TrimSpace(content.Text); text != "" {
				return text
			}
		}
	}
	return ""
}
