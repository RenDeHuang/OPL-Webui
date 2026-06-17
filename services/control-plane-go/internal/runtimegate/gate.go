package runtimegate

import (
	"os"
	"slices"
)

type Status struct {
	OK          bool     `json:"ok"`
	Environment string   `json:"environment"`
	Missing     []string `json:"missing"`
}

var productionRequiredEnv = []string{
	"OPL_DATABASE_URL",
	"OPL_SESSION_SECRET",
	"OPL_API_KEY_ENCRYPTION_SECRET",
	"OPL_CHAT_MODEL",
	"OPL_CLI_PATH",
}

var cloudMVPRequiredEnv = []string{
	"OPL_CLI_PATH",
	"OPL_DATABASE_URL",
	"OPL_SESSION_SECRET",
	"OPL_API_KEY_ENCRYPTION_SECRET",
	"OPL_CHAT_MODEL",
}

func CurrentStatus() Status {
	environment := os.Getenv("OPL_WEBUI_ENV")
	if environment == "" {
		environment = "development"
	}

	status := Status{
		OK:          true,
		Environment: environment,
		Missing:     []string{},
	}
	requiredEnv := requiredEnvFor(environment)
	if len(requiredEnv) == 0 {
		return status
	}

	for _, key := range requiredEnv {
		if os.Getenv(key) == "" {
			status.Missing = append(status.Missing, key)
		}
	}
	slices.Sort(status.Missing)
	status.OK = len(status.Missing) == 0
	return status
}

func requiredEnvFor(environment string) []string {
	switch environment {
	case "production":
		return productionRequiredEnv
	case "cloud_mvp":
		return cloudMVPRequiredEnv
	default:
		return nil
	}
}
