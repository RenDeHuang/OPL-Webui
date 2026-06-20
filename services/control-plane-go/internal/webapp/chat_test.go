package webapp

import (
	"context"
	"crypto/x509"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"testing"
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
