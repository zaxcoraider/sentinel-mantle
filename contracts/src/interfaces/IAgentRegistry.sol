// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAgentRegistry
 * @notice Interface to AgentRegistry, used by SentinelGuard to resolve an
 *         agent's owner, rules contract, and guard status.
 * @dev The GuardConfig layout is ABI-identical to AgentRegistry.GuardConfig.
 * @author Sentinel
 */
interface IAgentRegistry {
    struct GuardConfig {
        uint256 erc8004TokenId;
        address rulesContract;
        address guardContract;
        uint64 registeredAt;
        bool active;
    }

    /// @notice Get the full guard configuration for an agent.
    function getGuardConfig(address agent) external view returns (GuardConfig memory);

    /// @notice Get the live ERC-8004 owner of a registered agent.
    function getAgentOwner(address agent) external view returns (address);

    /// @notice Check whether an agent is currently guarded (registered and active).
    function isGuarded(address agent) external view returns (bool);

    /// @notice Get the SafetyRules contract for an agent.
    function rulesOf(address agent) external view returns (address);
}
