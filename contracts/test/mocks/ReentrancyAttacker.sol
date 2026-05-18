// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SentinelGuard} from "../../src/SentinelGuard.sol";

/**
 * @title ReentrancyAttacker
 * @notice A hostile executeAsAgent target that attempts to re-enter the guard.
 * @dev When called by SentinelGuard, its receive() re-enters executeAsAgent.
 *      The guard's ReentrancyGuard must cause this to revert.
 */
contract ReentrancyAttacker {
    SentinelGuard public immutable guard;

    constructor(address _guard) {
        guard = SentinelGuard(payable(_guard));
    }

    receive() external payable {
        guard.executeAsAgent(address(this), "", 0);
    }
}
