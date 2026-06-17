package webapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
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

func (client ChatClient) Complete(ctx context.Context, apiKey string, message string) (string, error) {
	body := map[string]any{
		"model": modelName(),
		"messages": []map[string]string{
			{"role": "user", "content": message},
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
			return "", context.DeadlineExceeded
		}
		return "", fmt.Errorf("%w: %v", errUpstreamUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("%w: status %d", errUpstreamUnavailable, response.StatusCode)
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", err
	}
	if len(payload.Choices) == 0 || strings.TrimSpace(payload.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("%w: empty response", errUpstreamUnavailable)
	}
	return payload.Choices[0].Message.Content, nil
}

func requiresRuntime(message string) bool {
	for _, marker := range []string{"@基金", "@论文", "@综述", "@长任务", "@文件"} {
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
	return strings.TrimRight(baseURL, "/") + "/chat/completions"
}

func modelName() string {
	if model := strings.TrimSpace(os.Getenv("OPL_CHAT_MODEL")); model != "" {
		return model
	}
	return "gpt-4o-mini"
}
