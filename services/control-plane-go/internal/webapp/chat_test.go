package webapp

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

type timeoutError struct{}

func (timeoutError) Error() string   { return "Client.Timeout exceeded while awaiting headers" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

func TestChatClientClassifiesSafeUpstreamNetworkDiagnostics(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "")
	t.Setenv("OPL_CHAT_MODEL", "gpt-5.5")

	cases := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "dns error",
			err: &url.Error{
				Op:  "Post",
				URL: "https://gflabtoken.cn/v1/responses",
				Err: &net.DNSError{Err: "no such host", Name: "gflabtoken.cn", IsNotFound: true},
			},
			want: "dns_error",
		},
		{
			name: "tls error",
			err: &url.Error{
				Op:  "Post",
				URL: "https://gflabtoken.cn/v1/responses",
				Err: x509.UnknownAuthorityError{},
			},
			want: "tls_error",
		},
		{
			name: "connection refused",
			err: &url.Error{
				Op:  "Post",
				URL: "https://gflabtoken.cn/v1/responses",
				Err: &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connect: connection refused")},
			},
			want: "connect_error",
		},
		{
			name: "client timeout",
			err: &url.Error{
				Op:  "Post",
				URL: "https://gflabtoken.cn/v1/responses",
				Err: timeoutError{},
			},
			want: "response_header_timeout",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client := ChatClient{HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				return nil, tc.err
			})}}

			_, err := client.Complete(context.Background(), "sk-test-secret", "hello")
			var failure UpstreamFailure
			if !errors.As(err, &failure) {
				t.Fatalf("expected UpstreamFailure, got %T %v", err, err)
			}
			if failure.Kind != tc.want {
				t.Fatalf("failure.Kind = %q, want %q", failure.Kind, tc.want)
			}
			metadata := failure.Metadata("conv_test")
			if metadata["upstreamKind"] != tc.want {
				t.Fatalf("metadata upstreamKind = %q, want %q", metadata["upstreamKind"], tc.want)
			}
			encoded := failure.Error() + strings.Join([]string{
				metadata["upstreamKind"],
				metadata["upstreamHost"],
				metadata["upstreamModel"],
			}, " ")
			if strings.Contains(encoded, "sk-test-secret") || strings.Contains(encoded, "no such host") || strings.Contains(encoded, "connection refused") {
				t.Fatalf("upstream diagnostic leaked raw network or secret detail: %s", encoded)
			}
		})
	}
}

func TestChatClientDefaultTimeoutBudgetSupportsSlowProductionHeaders(t *testing.T) {
	t.Setenv("OPL_CHAT_UPSTREAM_TIMEOUT_SECONDS", "")

	client := ChatClient{}

	if got := client.HTTPTimeout(); got != 60*time.Second {
		t.Fatalf("default upstream timeout = %s, want 60s", got)
	}
}

func TestHandleChatMapsUpstreamHeaderTimeoutToGatewayTimeout(t *testing.T) {
	t.Setenv("OPL_SESSION_SECRET", "test-session-secret-32-bytes-minimum")
	t.Setenv("OPL_API_KEY_ENCRYPTION_SECRET", "test-api-key-secret-32-bytes-min")
	t.Setenv("OPL_CHAT_MODEL", "gpt-5.5")

	store := NewMemoryStore()
	user, err := store.CreateUser("timeout-user@example.com", "hash")
	if err != nil {
		t.Fatal(err)
	}
	encrypted, err := encryptAPIKey("sk-timeout-secret")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveAPIKeyBinding(APIKeyBinding{
		UserID: user.ID, Provider: ProviderName, BaseURL: FixedBaseURL,
		EncryptedAPIKey: encrypted, MaskedKey: "sk-***cret",
	}); err != nil {
		t.Fatal(err)
	}
	server := Server{
		Store: store,
		ChatClient: ChatClient{HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, &url.Error{Op: "Post", URL: "https://gflabtoken.cn/v1/responses", Err: timeoutError{}}
		})}},
	}
	token, err := signSession(claimsFromUser(user))
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/chat", strings.NewReader(`{"message":"@科研 帮我拆解研究方向"}`))
	request.Header.Set("content-type", "application/json")
	request.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	response := httptest.NewRecorder()

	server.HandleChat(response, request)

	if response.Code != http.StatusGatewayTimeout {
		t.Fatalf("response status = %d, want %d; body=%s", response.Code, http.StatusGatewayTimeout, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	upstream, _ := body["upstream"].(map[string]any)
	if upstream["kind"] != "response_header_timeout" {
		t.Fatalf("upstream.kind = %#v, want response_header_timeout", upstream["kind"])
	}
	events := store.ListAuditEvents(user.ID)
	if len(events) == 0 || events[len(events)-1].Metadata["upstreamKind"] != "response_header_timeout" {
		t.Fatalf("missing sanitized timeout audit event: %#v", events)
	}
	if strings.Contains(response.Body.String(), "sk-timeout-secret") {
		t.Fatalf("timeout response leaked API key: %s", response.Body.String())
	}
}
