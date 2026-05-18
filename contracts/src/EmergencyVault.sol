// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EmergencyVault
 * @notice A timelocked safe-deposit box for funds rescued from misbehaving
 *         agents. When a human rescues a frozen agent, SentinelGuard pushes the
 *         funds here, credited to that human. The human may withdraw after a
 *         fixed delay. Segregating rescued funds keeps them away from the live
 *         custody logic in SentinelGuard.
 * @dev Ownerless: authority derives purely from being the credited beneficiary.
 *      Deposits are permissionless; claims are gated by beneficiary + timelock.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract EmergencyVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Sentinel address representing native MNT in token mappings.
    address public constant NATIVE = address(0);

    // ============ State ============

    /// @notice Delay between a deposit and when the beneficiary may claim it.
    uint256 public immutable withdrawDelay;

    /// @notice Per-beneficiary, per-token balances held in the vault.
    mapping(address beneficiary => mapping(address token => uint256 amount)) public balances;

    /// @notice Per-beneficiary, per-token timestamp at which a claim becomes possible.
    mapping(address beneficiary => mapping(address token => uint256 timestamp)) public unlockAt;

    // ============ Events ============

    /// @notice Emitted when rescued funds are deposited for a beneficiary.
    event RescueDeposited(
        address indexed beneficiary,
        address indexed token,
        uint256 amount,
        uint256 unlockAt
    );

    /// @notice Emitted when a beneficiary claims their funds.
    event RescueClaimed(address indexed beneficiary, address indexed token, uint256 amount);

    // ============ Errors ============

    error StillLocked(uint256 unlockAt);
    error NothingToClaim();
    error ZeroAddress();
    error ZeroAmount();
    error NativeTransferFailed();

    // ============ Constructor ============

    /**
     * @notice Deploy the emergency vault.
     * @param _withdrawDelay Delay (seconds) between deposit and claim eligibility.
     */
    constructor(uint256 _withdrawDelay) {
        withdrawDelay = _withdrawDelay;
    }

    // ============ External: deposits ============

    /**
     * @notice Deposit an ERC-20 into the vault credited to a beneficiary.
     * @dev Permissionless. Pulls tokens from the caller. Each deposit refreshes
     *      the beneficiary's timelock for that token.
     * @param beneficiary The address that may later claim these funds.
     * @param token The ERC-20 token being deposited.
     * @param amount The amount being deposited.
     */
    function depositFor(address beneficiary, address token, uint256 amount)
        external
        nonReentrant
    {
        if (beneficiary == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[beneficiary][token] += amount;
        uint256 unlock = block.timestamp + withdrawDelay;
        unlockAt[beneficiary][token] = unlock;

        emit RescueDeposited(beneficiary, token, amount, unlock);
    }

    /**
     * @notice Deposit native MNT into the vault credited to a beneficiary.
     * @param beneficiary The address that may later claim these funds.
     */
    function depositNativeFor(address beneficiary) external payable {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();

        balances[beneficiary][NATIVE] += msg.value;
        uint256 unlock = block.timestamp + withdrawDelay;
        unlockAt[beneficiary][NATIVE] = unlock;

        emit RescueDeposited(beneficiary, NATIVE, msg.value, unlock);
    }

    // ============ External: claims ============

    /**
     * @notice Claim an ERC-20 balance after the timelock has elapsed.
     * @param token The ERC-20 token to claim.
     */
    function claim(address token) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();

        uint256 amount = balances[msg.sender][token];
        if (amount == 0) revert NothingToClaim();
        uint256 unlock = unlockAt[msg.sender][token];
        if (block.timestamp < unlock) revert StillLocked(unlock);

        balances[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit RescueClaimed(msg.sender, token, amount);
    }

    /**
     * @notice Claim a native MNT balance after the timelock has elapsed.
     */
    function claimNative() external nonReentrant {
        uint256 amount = balances[msg.sender][NATIVE];
        if (amount == 0) revert NothingToClaim();
        uint256 unlock = unlockAt[msg.sender][NATIVE];
        if (block.timestamp < unlock) revert StillLocked(unlock);

        balances[msg.sender][NATIVE] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();

        emit RescueClaimed(msg.sender, NATIVE, amount);
    }

    // ============ External: views ============

    /**
     * @notice Get the timestamp at which a beneficiary may claim a token.
     * @param beneficiary The beneficiary address.
     * @param token The token address (use NATIVE for native MNT).
     * @return timestamp The unlock timestamp (0 if nothing deposited).
     */
    function claimableAt(address beneficiary, address token)
        external
        view
        returns (uint256 timestamp)
    {
        return unlockAt[beneficiary][token];
    }
}
