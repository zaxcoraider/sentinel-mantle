// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockTarget
 * @notice A callable contract used to exercise SentinelGuard.executeAsAgent.
 * @dev `ping` succeeds and optionally refunds a portion of received native;
 *      `boom` always reverts.
 */
contract MockTarget {
    uint256 public pings;
    uint256 public totalReceived;
    uint256 public refundBps;

    /// @notice Set the percentage (in bps) of received native to refund to caller.
    function setRefundBps(uint256 bps) external {
        refundBps = bps;
    }

    /// @notice A successful action that records the call and optionally refunds.
    function ping() external payable {
        pings++;
        totalReceived += msg.value;
        if (refundBps > 0 && msg.value > 0) {
            uint256 refund = (msg.value * refundBps) / 10_000;
            (bool ok,) = msg.sender.call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @notice An action that always reverts.
    function boom() external payable {
        revert("boom");
    }

    receive() external payable {}
}
