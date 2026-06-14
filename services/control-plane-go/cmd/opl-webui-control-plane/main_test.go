package main

import "testing"

func TestServerAddressUsesHostAndPort(t *testing.T) {
	t.Setenv("HOST", "0.0.0.0")
	t.Setenv("PORT", "8080")

	if got := serverAddress(); got != "0.0.0.0:8080" {
		t.Fatalf("serverAddress() = %q, want %q", got, "0.0.0.0:8080")
	}
}

func TestServerAddressDefaultsToLocalDevelopment(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")

	if got := serverAddress(); got != "127.0.0.1:4173" {
		t.Fatalf("serverAddress() = %q, want %q", got, "127.0.0.1:4173")
	}
}
