// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IReputationOracle} from "./interfaces/IReputationOracle.sol";
import {IEmergencyVault} from "./interfaces/IEmergencyVault.sol";
import {ISafetyRules} from "./interfaces/ISafetyRules.sol";

/**
 * @title SentinelGuard
 * @notice The custody vault and circuit breaker for the Sentinel protocol on
 *         Mantle. It holds each AI agent's operating capital, lets the agent act
 *         through `executeAsAgent` (gated by an on-chain rule check), lets the
 *         monitor freeze a misbehaving agent, and lets the agent's human owner
 *         rescue a frozen agent's funds into the EmergencyVault.
 * @dev Pause is per-agent — one frozen agent never blocks the others. The
 *      contract is ownerless: per-agent authority derives from ERC-8004 NFT
 *      ownership (resolved via AgentRegistry), and the monitor is immutable. A
 *      compromised monitor can only pause (DoS), never move funds.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract SentinelGuard is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ Constants ============

    /// @notice Sentinel address representing native MNT in token mappings.
    address public constant NATIVE = address(0);

    /// @notice Delay an owner must wait after a pause before unpausing an agent.
    uint256 public constant UNPAUSE_COOLDOWN = 1 hours;

    // ============ Immutables ============

    /// @notice The off-chain monitor wallet — the only address that may pause.
    address public immutable monitor;

    /// @notice Registry resolving agent -> owner / rules / guard status.
    IAgentRegistry public immutable registry;

    /// @notice Reputation oracle that records circuit-breaker and recovery events.
    IReputationOracle public immutable reputation;

    /// @notice Vault that receives rescued funds under a timelock.
    IEmergencyVault public immutable emergencyVault;

    // ============ State ============

    /// @notice Per-agent, per-token custody ledger. NATIVE key tracks native MNT.
    mapping(address agent => mapping(address token => uint256 amount)) public balanceOf;

    /// @dev ERC-20 tokens an agent holds, so rescue can drain them all.
    mapping(address agent => EnumerableSet.AddressSet tokens) internal _agentTokens;

    /// @notice Per-agent circuit-breaker state.
    mapping(address agent => bool paused) public isPaused;

    /// @notice Per-agent timestamp at which the agent was paused.
    mapping(address agent => uint64 timestamp) public pausedAt;

    /// @notice Per-agent, per-hour-bucket transaction count for on-chain rate limiting.
    mapping(address agent => mapping(uint256 hourBucket => uint256 count)) public hourlyTxCount;

    // ============ Events ============

    /// @notice Emitted when funds are deposited for an agent.
    event Deposited(
        address indexed agent,
        address indexed token,
        uint256 amount,
        address indexed from
    );

    /// @notice Emitted when an agent successfully executes an action through the guard.
    event AgentExecuted(
        address indexed agent,
        address indexed target,
        uint256 value,
        bytes4 selector
    );

    /// @notice Emitted when the monitor trips the circuit breaker for an agent.
    event CircuitBreakerTriggered(address indexed agent, bytes32 indexed reason, uint256 timestamp);

    /// @notice Emitted when an agent's owner pauses their own agent.
    event AgentPausedByOwner(address indexed agent, uint256 timestamp);

    /// @notice Emitted when a paused agent's funds are rescued to the EmergencyVault.
    event FundsRescued(address indexed agent, address indexed beneficiary, uint256 tokenCount);

    /// @notice Emitted when an agent is unpaused by its owner.
    event AgentUnpaused(address indexed agent, uint256 timestamp);

    // ============ Errors ============

    error NotMonitor();
    error NotAgentOwner();
    error AgentNotGuarded(address agent);
    error AgentIsPaused(address agent);
    error AgentNotPaused(address agent);
    error CooldownActive(uint256 readyAt);
    error RuleCheckFailed(bytes32 rule);
    error ProtocolCallFailed(bytes returnData);
    error InsufficientBalance();
    error ZeroAddress();
    error ZeroAmount();

    // ============ Modifiers ============

    modifier onlyMonitor() {
        if (msg.sender != monitor) revert NotMonitor();
        _;
    }

    modifier onlyAgentOwner(address agent) {
        if (msg.sender != registry.getAgentOwner(agent)) revert NotAgentOwner();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Deploy SentinelGuard.
     * @param _monitor The off-chain monitor wallet authorized to pause agents.
     * @param _registry The AgentRegistry resolving agent ownership and rules.
     * @param _reputation The ReputationOracle for recording lifecycle events.
     * @param _emergencyVault The EmergencyVault that receives rescued funds.
     */
    constructor(address _monitor, address _registry, address _reputation, address _emergencyVault) {
        if (
            _monitor == address(0) || _registry == address(0) || _reputation == address(0)
                || _emergencyVault == address(0)
        ) {
            revert ZeroAddress();
        }
        monitor = _monitor;
        registry = IAgentRegistry(_registry);
        reputation = IReputationOracle(_reputation);
        emergencyVault = IEmergencyVault(_emergencyVault);
    }

    // ============ External: deposits ============

    /**
     * @notice Deposit an ERC-20 token into the guard on behalf of an agent.
     * @dev Anyone may fund an agent. The agent must be currently guarded.
     * @param agent The agent to credit.
     * @param token The ERC-20 token to deposit.
     * @param amount The amount to deposit.
     */
    function depositForAgent(address agent, address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!registry.isGuarded(agent)) revert AgentNotGuarded(agent);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[agent][token] += amount;
        _agentTokens[agent].add(token);

        emit Deposited(agent, token, amount, msg.sender);
    }

    /**
     * @notice Deposit native MNT into the guard on behalf of an agent.
     * @param agent The agent to credit.
     */
    function depositNativeForAgent(address agent) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (!registry.isGuarded(agent)) revert AgentNotGuarded(agent);

        balanceOf[agent][NATIVE] += msg.value;

        emit Deposited(agent, NATIVE, msg.value, msg.sender);
    }

    // ============ External: agent execution ============

    /**
     * @notice Execute an action as the calling agent, routed through the guard.
     * @dev Caller must be the registered agent and must not be paused. The
     *      on-chain (Layer-1) rule check runs first; on violation the call
     *      reverts — this is NOT a circuit breaker, the action simply does not
     *      execute. Native `value` is drawn from the agent's balance and any
     *      native refunded by the call is re-credited to the agent.
     * @param target The contract the agent wants to call.
     * @param data The calldata to forward to `target`.
     * @param value The amount of native MNT to send, drawn from the agent's balance.
     * @return result The raw return data from the call.
     */
    function executeAsAgent(address target, bytes calldata data, uint256 value)
        external
        nonReentrant
        returns (bytes memory result)
    {
        address agent = msg.sender;
        if (!registry.isGuarded(agent)) revert AgentNotGuarded(agent);
        if (isPaused[agent]) revert AgentIsPaused(agent);
        if (target == address(0)) revert ZeroAddress();

        // Layer-1 rule check: protocol allowlist, tx rate, time-of-day window.
        uint256 hourBucket = block.timestamp / 1 hours;
        uint256 txCount = ++hourlyTxCount[agent][hourBucket];
        ISafetyRules.AgentState memory state = ISafetyRules.AgentState({
            currentValue: 0,
            highWaterMark: 0,
            txCountThisHour: txCount,
            lastCalledProtocol: target,
            lastPriceUsed: 0,
            lastReferencePrice: 0,
            volume24hUsd: 0,
            currentHourUtc: uint8(hourBucket % 24)
        });
        (bool safe, bytes32 rule) = ISafetyRules(registry.rulesOf(agent)).evaluate(state);
        if (!safe) revert RuleCheckFailed(rule);

        // Spend native from the agent's balance (effects before interaction).
        if (value > balanceOf[agent][NATIVE]) revert InsufficientBalance();
        balanceOf[agent][NATIVE] -= value;

        uint256 balanceBefore = address(this).balance;
        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert ProtocolCallFailed(result);

        // Re-credit any native the call refunded back to the guard.
        uint256 refund = address(this).balance + value - balanceBefore;
        if (refund > 0) {
            balanceOf[agent][NATIVE] += refund;
        }

        bytes4 selector;
        if (data.length >= 4) selector = bytes4(data[:4]);
        emit AgentExecuted(agent, target, value, selector);
    }

    // ============ External: circuit breaker ============

    /**
     * @notice Trip the circuit breaker for an agent, freezing its activity.
     * @dev Only the monitor may call. Cannot move funds. Records a CircuitBreaker
     *      event in the reputation oracle.
     * @param agent The agent to freeze.
     * @param reason A bytes32 hash identifying the anomaly that triggered this.
     */
    function triggerCircuitBreaker(address agent, bytes32 reason) external onlyMonitor {
        if (registry.getGuardConfig(agent).registeredAt == 0) revert AgentNotGuarded(agent);
        if (isPaused[agent]) revert AgentIsPaused(agent);

        isPaused[agent] = true;
        pausedAt[agent] = uint64(block.timestamp);
        reputation.recordEvent(agent, IReputationOracle.EventType.CircuitBreaker);

        emit CircuitBreakerTriggered(agent, reason, block.timestamp);
    }

    /**
     * @notice Pause your own agent — a human panic button.
     * @dev Only the agent's ERC-8004 owner may call. Does not penalize reputation.
     * @param agent The agent to pause.
     */
    function ownerPauseAgent(address agent) external onlyAgentOwner(agent) {
        if (isPaused[agent]) revert AgentIsPaused(agent);

        isPaused[agent] = true;
        pausedAt[agent] = uint64(block.timestamp);

        emit AgentPausedByOwner(agent, block.timestamp);
    }

    /**
     * @notice Rescue all of a paused agent's funds into the EmergencyVault.
     * @dev Only the agent's ERC-8004 owner may call, and only while the agent is
     *      paused. Moves native MNT and every tracked ERC-20 into the vault,
     *      credited to the owner. Records a SuccessfulRecovery event.
     * @param agent The paused agent whose funds to rescue.
     */
    function rescueToSafety(address agent) external nonReentrant onlyAgentOwner(agent) {
        if (!isPaused[agent]) revert AgentNotPaused(agent);

        address beneficiary = msg.sender; // verified as the agent's owner by the modifier
        uint256 tokenCount;

        uint256 nativeBalance = balanceOf[agent][NATIVE];
        if (nativeBalance > 0) {
            balanceOf[agent][NATIVE] = 0;
            emergencyVault.depositNativeFor{value: nativeBalance}(beneficiary);
            tokenCount++;
        }

        address[] memory tokens = _agentTokens[agent].values();
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 bal = balanceOf[agent][token];
            if (bal > 0) {
                balanceOf[agent][token] = 0;
                IERC20(token).forceApprove(address(emergencyVault), bal);
                emergencyVault.depositFor(beneficiary, token, bal);
                tokenCount++;
            }
        }

        reputation.recordEvent(agent, IReputationOracle.EventType.SuccessfulRecovery);

        emit FundsRescued(agent, beneficiary, tokenCount);
    }

    /**
     * @notice Resume a paused agent after the cooldown has elapsed.
     * @dev Only the agent's ERC-8004 owner may call, and only after UNPAUSE_COOLDOWN.
     * @param agent The agent to unpause.
     */
    function unpauseAgent(address agent) external onlyAgentOwner(agent) {
        if (!isPaused[agent]) revert AgentNotPaused(agent);
        uint256 readyAt = pausedAt[agent] + UNPAUSE_COOLDOWN;
        if (block.timestamp < readyAt) revert CooldownActive(readyAt);

        isPaused[agent] = false;

        emit AgentUnpaused(agent, block.timestamp);
    }

    // ============ External: views ============

    /**
     * @notice List every ERC-20 token an agent holds in the guard.
     * @param agent The agent to query.
     * @return tokens The agent's tracked ERC-20 token addresses.
     */
    function getAgentTokens(address agent) external view returns (address[] memory tokens) {
        return _agentTokens[agent].values();
    }

    /**
     * @notice Get the calling-hour transaction count for an agent.
     * @param agent The agent to query.
     * @return count Transactions executed by the agent in the current hour bucket.
     */
    function txCountThisHour(address agent) external view returns (uint256 count) {
        return hourlyTxCount[agent][block.timestamp / 1 hours];
    }

    /// @notice Accept native MNT (e.g. refunds from `executeAsAgent` calls).
    receive() external payable {}
}
