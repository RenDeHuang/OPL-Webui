package controlplane

import "errors"

const (
	defaultPlan        = "starter"
	defaultTaskQuota   = 2
	defaultUsagePeriod = "monthly"
)

var ErrQuotaExceeded = errors.New("task quota exceeded")

type UsageQuotaProjection struct {
	Plan           string `json:"plan"`
	TaskQuota      int    `json:"taskQuota"`
	UsagePeriod    string `json:"usagePeriod"`
	UsedCount      int    `json:"usedCount"`
	RemainingCount int    `json:"remainingCount"`
}

func usageQuotaFromCount(usedCount int) UsageQuotaProjection {
	return usageQuotaProjection(defaultPlan, defaultTaskQuota, defaultUsagePeriod, usedCount)
}

func usageQuotaProjection(plan string, taskQuota int, usagePeriod string, usedCount int) UsageQuotaProjection {
	remaining := taskQuota - usedCount
	if remaining < 0 {
		remaining = 0
	}
	return UsageQuotaProjection{
		Plan:           plan,
		TaskQuota:      taskQuota,
		UsagePeriod:    usagePeriod,
		UsedCount:      usedCount,
		RemainingCount: remaining,
	}
}
