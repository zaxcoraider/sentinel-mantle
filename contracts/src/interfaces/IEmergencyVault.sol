// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IEmergencyVault
 * @notice Interface to EmergencyVault, used by SentinelGuard to push rescued
 *         funds into timelocked, segregated holding.
 * @author Sentinel
 */
interface IEmergencyVault {
    /**
     * @notice Deposit an ERC-20 into the vault credited to a beneficiary.
     * @param beneficiary The address that may later claim these funds.
     * @param token The ERC-20 token being deposited.
     * @param amount The amount being deposited.
     */
    function depositFor(address beneficiary, address token, uint256 amount) external;

    /**
     * @notice Deposit native MNT into the vault credited to a beneficiary.
     * @param beneficiary The address that may later claim these funds.
     */
    function depositNativeFor(address beneficiary) external payable;
}
