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
	"strconv"
	"strings"
	"time"
)

const (
	ProviderName = "gflabtoken"
	FixedBaseURL = "https://gflabtoken.cn/v1"
	MedOPLURL    = "https://medopl.medopl.cn"
)

type ChatClient struct {
	HTTPClient *http.Client
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
		httpClient = &http.Client{Timeout: 20 * time.Second}
	}
	response, err := httpClient.Do(request)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "", UpstreamFailure{Kind: "timeout", Host: upstreamHost(), Model: modelName()}
		}
		return "", UpstreamFailure{Kind: "network", Host: upstreamHost(), Model: modelName()}
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
