package webapp

import "errors"

var (
	errAuthRequired            = errors.New("auth required")
	errInvalidCredentials      = errors.New("invalid credentials")
	errInvalidCredentialsInput = errors.New("invalid credentials input")
	errSessionSecretMissing    = errors.New("session secret missing")
	errAPIKeySecretMissing     = errors.New("api key encryption secret missing")
	errInvalidAPIKey           = errors.New("invalid api key")
	errAPIKeyRequired          = errors.New("api key required")
	errConversationNotFound    = errors.New("conversation not found")
	errUpstreamUnavailable     = errors.New("upstream unavailable")
)

func mapDuplicate(err error) error {
	if err == nil {
		return nil
	}
	if contains(err.Error(), "users_email_unique") || contains(err.Error(), "duplicate key") {
		return ErrDuplicateEmail
	}
	return err
}

func contains(value string, needle string) bool {
	for index := 0; index+len(needle) <= len(value); index++ {
		if value[index:index+len(needle)] == needle {
			return true
		}
	}
	return false
}
