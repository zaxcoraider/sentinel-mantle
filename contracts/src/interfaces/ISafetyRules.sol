// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ISafetyRules
 * @notice Interface for a per-agent SafetyRules instance, used by SentinelGuard
 *         to run the on-chain (Layer-1) rule check before an agent action.
 * @dev The AgentState layout is ABI-identical to SafetyRules.AgentState.
 * @author Sentinel
 */
interface ISafetyRules {
    /**
     * @notice Snapshot of an agent's state passed to `evaluate()`.
     * @dev SentinelGuard fills only the on-chain-knowable fields; value/price
     *      fields are left zero so `evaluate()` skips the off-chain rules.
     */
    struct AgentState {
        uint256 currentValue;
        uint256 highWaterMark;
        uint256 txCountThisHour;
        address lastCalledProtocol;
        uint256 lastPriceUsed;
        uint256 lastReferencePrice;
        uint256 volume24hUsd;
        uint8 currentHourUtc;
    }

    /**
     * @notice Evaluate all rules against a snapshot of agent state.
     * @param state Current agent state.
     * @return safe True if all rules pass.
     * @return violatedRule Hash of the first violated rule (zero if safe).
     */
    function evaluate(AgentState calldata state)
        external
        view
        returns (bool safe, bytes32 violatedRule);
}
