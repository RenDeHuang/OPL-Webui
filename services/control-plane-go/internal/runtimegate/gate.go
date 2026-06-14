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
	"OPL_TENANT_AUTH_MODE",
	"OPL_DATABASE_URL",
	"OPL_QUEUE_URL",
	"OPL_OBJECT_STORE_URL",
	"OPL_BILLING_MODE",
	"OPL_WORKER_MODE",
}

var cloudMVPRequiredEnv = []string{
	"OPL_CLI_PATH",
	"OPL_DATABASE_URL",
	"OPL_TENANT_AUTH_MODE",
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
