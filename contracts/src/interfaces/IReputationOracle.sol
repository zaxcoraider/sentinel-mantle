// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IReputationOracle
 * @notice Interface to ReputationOracle, used by SentinelGuard to record
 *         circuit-breaker and recovery events.
 * @dev The EventType ordinals are ABI-identical to ReputationOracle.EventType.
 * @author Sentinel
 */
interface IReputationOracle {
    enum EventType {
        CleanDay,
        RuleViolation,
        CircuitBreaker,
        SuccessfulRecovery,
        SlashingEvent
    }

    /**
     * @notice Record a lifecycle event for an agent and update its score.
     * @param agent The agent the event concerns.
     * @param eventType The lifecycle event that occurred.
     */
    function recordEvent(address agent, EventType eventType) external;
}
