// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC8004Identity} from "./interfaces/IERC8004Identity.sol";

/**
 * @title AgentRegistry
 * @notice The ERC-8004 <-> Sentinel bridge. Records which AI agents are guarded
 *         by Sentinel and links each one to its identity NFT, its SafetyRules
 *         instance, and its SentinelGuard. This contract is the source of truth
 *         for "who owns this agent" — every owner-gated action in SentinelGuard
 *         resolves ownership through here via a live ERC-8004 ownerOf() call.
 * @dev Ownerless by design: authority derives purely from ERC-8004 NFT ownership.
 *      No funds are held, so there is no reentrancy surface.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract AgentRegistry {
    // ============ Types ============

    /**
     * @notice Per-agent guard configuration.
     * @param erc8004TokenId The ERC-8004 identity token bound to this agent.
     * @param rulesContract The agent's own SafetyRules instance.
     * @param guardContract The SentinelGuard custodying this agent's funds.
     * @param registeredAt Unix timestamp of the most recent registration.
     * @param active Whether the agent is currently guarded.
     */
    struct GuardConfig {
        uint256 erc8004TokenId;
        address rulesContract;
        address guardContract;
        uint64 registeredAt;
        bool active;
    }

    // ============ State ============

    /// @notice The ERC-8004 Identity Registry this contract reads identities from.
    IERC8004Identity public immutable identityRegistry;

    /// @dev Per-agent configuration. Exposed via getGuardConfig().
    mapping(address agent => GuardConfig config) internal _configs;

    // ============ Events ============

    /// @notice Emitted when an agent is registered (or re-registered) under Sentinel.
    event AgentGuarded(
        address indexed agent,
        uint256 indexed tokenId,
        address rulesContract,
        address guardContract
    );

    /// @notice Emitted when an agent is deregistered (marked inactive).
    event AgentDeregistered(address indexed agent, uint256 indexed tokenId);

    // ============ Errors ============

    error NotTokenOwner();
    error AlreadyRegistered(address agent);
    error NotRegistered(address agent);
    error AgentNotResolved(uint256 tokenId);
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @notice Deploy the registry bound to an ERC-8004 Identity Registry.
     * @param _identityRegistry Address of the ERC-8004 Identity Registry.
     */
    constructor(address _identityRegistry) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IERC8004Identity(_identityRegistry);
    }

    // ============ External: registration ============

    /**
     * @notice Register an ERC-8004 agent under Sentinel's protection.
     * @dev Caller must own the ERC-8004 identity NFT. The agent address is
     *      resolved from the identity registry. An agent with an active
     *      registration cannot be registered again; a deregistered agent may be.
     * @param erc8004TokenId The ERC-8004 identity token ID owned by the caller.
     * @param rulesContract The agent's SafetyRules instance.
     * @param guardContract The SentinelGuard that will custody the agent's funds.
     */
    function register(
        uint256 erc8004TokenId,
        address rulesContract,
        address guardContract
    ) external {
        if (rulesContract == address(0) || guardContract == address(0)) {
            revert ZeroAddress();
        }
        if (identityRegistry.ownerOf(erc8004TokenId) != msg.sender) {
            revert NotTokenOwner();
        }

        (address agentAddress,) = identityRegistry.getAgent(erc8004TokenId);
        if (agentAddress == address(0)) revert AgentNotResolved(erc8004TokenId);
        if (_configs[agentAddress].active) revert AlreadyRegistered(agentAddress);

        _configs[agentAddress] = GuardConfig({
            erc8004TokenId: erc8004TokenId,
            rulesContract: rulesContract,
            guardContract: guardContract,
            registeredAt: uint64(block.timestamp),
            active: true
        });

        emit AgentGuarded(agentAddress, erc8004TokenId, rulesContract, guardContract);
    }

    /**
     * @notice Deregister an agent, marking it inactive while retaining history.
     * @dev Only the current ERC-8004 NFT owner may deregister.
     * @param agent The agent address to deregister.
     */
    function deregister(address agent) external {
        GuardConfig storage cfg = _configs[agent];
        if (cfg.registeredAt == 0) revert NotRegistered(agent);
        if (identityRegistry.ownerOf(cfg.erc8004TokenId) != msg.sender) {
            revert NotTokenOwner();
        }

        cfg.active = false;
        emit AgentDeregistered(agent, cfg.erc8004TokenId);
    }

    // ============ External: views ============

    /**
     * @notice Get the full guard configuration for an agent.
     * @param agent The agent address to query.
     * @return config The agent's GuardConfig (zero-valued if never registered).
     */
    function getGuardConfig(address agent)
        external
        view
        returns (GuardConfig memory config)
    {
        return _configs[agent];
    }

    /**
     * @notice Get the live ERC-8004 owner of a registered agent.
     * @dev Performs a live ownerOf() call so ownership stays correct even after
     *      an NFT transfer. Reverts if the agent was never registered.
     * @param agent The agent address to query.
     * @return owner The current owner of the agent's ERC-8004 identity NFT.
     */
    function getAgentOwner(address agent) external view returns (address owner) {
        GuardConfig storage cfg = _configs[agent];
        if (cfg.registeredAt == 0) revert NotRegistered(agent);
        return identityRegistry.ownerOf(cfg.erc8004TokenId);
    }

    /**
     * @notice Check whether an agent is currently guarded (registered and active).
     * @param agent The agent address to query.
     * @return guarded True if the agent has an active registration.
     */
    function isGuarded(address agent) external view returns (bool guarded) {
        return _configs[agent].active;
    }

    /**
     * @notice Get the SafetyRules contract for an agent.
     * @param agent The agent address to query.
     * @return rulesContract The agent's SafetyRules instance (zero if unregistered).
     */
    function rulesOf(address agent) external view returns (address rulesContract) {
        return _configs[agent].rulesContract;
    }
}
