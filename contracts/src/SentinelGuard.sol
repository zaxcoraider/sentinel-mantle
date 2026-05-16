// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SentinelGuard
 * @notice Main vault and circuit-breaker contract for the Sentinel protocol on Mantle.
 *         Users deposit funds here on behalf of their ERC-8004 AI agents. An authorized
 *         off-chain monitor can pause the contract and trigger fund rescue if the agent
 *         misbehaves.
 * @dev Phase 1 skeleton — real rule evaluation and ERC-8004 integration added in Phase 2.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract SentinelGuard is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Types ============

    /**
     * @notice Represents a registered AI agent under Sentinel's protection.
     * @param agentAddress The on-chain address of the AI agent.
     * @param agentId ERC-8004 identity token ID bound to this agent.
     * @param registeredAt Unix timestamp of registration.
     * @param active Whether this agent is currently active.
     */
    struct Agent {
        address agentAddress;
        bytes32 agentId;
        uint256 registeredAt;
        bool active;
    }

    // ============ State ============

    /// @notice The off-chain monitor wallet authorized to trigger the circuit breaker.
    address public immutable monitor;

    /// @notice Registered agents mapped by their on-chain address.
    mapping(address => Agent) public agents;

    // ============ Events ============

    /// @notice Emitted when a new agent is registered under Sentinel's protection.
    event AgentRegistered(address indexed agentAddress, bytes32 indexed agentId, uint256 registeredAt);

    /// @notice Emitted when an agent's safety rules are updated.
    event RulesUpdated(address indexed agentAddress, bytes32 indexed rulesHash);

    /// @notice Emitted when the circuit breaker is triggered by the monitor.
    event CircuitBreakerTriggered(address indexed triggeredBy, bytes32 indexed reason, uint256 timestamp);

    /// @notice Emitted when funds are rescued to a safe address after a trigger.
    event FundsRescued(address indexed recipient, address indexed token, uint256 amount);

    /// @notice Emitted on native MNT deposit.
    event NativeDeposited(address indexed sender, uint256 amount);

    /// @notice Emitted on ERC-20 token deposit.
    event TokenDeposited(address indexed sender, address indexed token, uint256 amount);

    // ============ Errors ============

    error NotMonitor();
    error NotPaused();
    error ZeroAddress();
    error ZeroAmount();
    error NativeTransferFailed();
    error AgentAlreadyRegistered(address agentAddress);

    // ============ Modifiers ============

    modifier onlyMonitor() {
        if (msg.sender != monitor) revert NotMonitor();
        _;
    }

    modifier whenPausedOnly() {
        if (!paused()) revert NotPaused();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Deploy SentinelGuard.
     * @param initialOwner The human owner who can rescue funds and unpause.
     * @param _monitor The off-chain monitor wallet authorized to trigger the circuit breaker.
     */
    constructor(address initialOwner, address _monitor) Ownable(initialOwner) {
        if (_monitor == address(0)) revert ZeroAddress();
        monitor = _monitor;
    }

    // ============ External functions ============

    /// @notice Accept native MNT deposits directly.
    receive() external payable {
        emit NativeDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Deposit an ERC-20 token into this guard on behalf of a guarded agent.
     * @param token The ERC-20 token contract to deposit.
     * @param amount The amount to deposit, in the token's native decimals.
     */
    function deposit(IERC20 token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokenDeposited(msg.sender, address(token), amount);
    }

    /**
     * @notice Register an AI agent under this guard's protection.
     * @dev Stub — full ERC-8004 ownership verification added in Phase 2.
     * @param agentAddress The on-chain address of the agent to guard.
     * @param erc8004Id The ERC-8004 identity token ID linked to this agent.
     */
    function registerAgent(address agentAddress, bytes32 erc8004Id) external onlyOwner {
        if (agentAddress == address(0)) revert ZeroAddress();
        if (agents[agentAddress].registeredAt != 0) revert AgentAlreadyRegistered(agentAddress);

        agents[agentAddress] = Agent({
            agentAddress: agentAddress,
            agentId: erc8004Id,
            registeredAt: block.timestamp,
            active: true
        });

        emit AgentRegistered(agentAddress, erc8004Id, block.timestamp);
    }

    /**
     * @notice Trigger the circuit breaker, pausing all deposits and agent activity.
     * @dev Only callable by the authorized monitor wallet. Cannot drain funds.
     * @param reason A bytes32 hash identifying the anomaly that triggered this event.
     */
    function triggerCircuitBreaker(bytes32 reason) external onlyMonitor {
        _pause();
        emit CircuitBreakerTriggered(msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Rescue funds to a safe address after a circuit breaker event.
     * @dev Only callable by the owner when the contract is paused. The monitor
     *      can never call this — it can only pause, never move funds.
     * @param recipient The address to receive rescued funds.
     * @param token ERC-20 token to rescue, or address(0) for native MNT.
     * @param amount The amount to rescue.
     */
    function withdrawToSafety(
        address recipient,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant whenPausedOnly {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit FundsRescued(recipient, token, amount);
    }

    /**
     * @notice Unpause the contract after a circuit breaker event is resolved.
     * @dev Only callable by the owner. Agent can resume after the owner reviews and clears.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
