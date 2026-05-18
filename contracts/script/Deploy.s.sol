// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ReputationOracle} from "../src/ReputationOracle.sol";
import {EmergencyVault} from "../src/EmergencyVault.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {SentinelGuard} from "../src/SentinelGuard.sol";
import {MockIdentityRegistry} from "../test/mocks/MockIdentityRegistry.sol";

/**
 * @title Deploy
 * @notice Deploys the full Sentinel protocol suite and wires authorization.
 * @dev Required env: PRIVATE_KEY, MONITOR_ADDRESS.
 *      Optional env: IDENTITY_REGISTRY (the ERC-8004 registry — if unset, a
 *      MockIdentityRegistry is deployed for testnet), WITHDRAW_DELAY (seconds).
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address monitorAddress = vm.envAddress("MONITOR_ADDRESS");
        address identityRegistry = vm.envOr("IDENTITY_REGISTRY", address(0));
        uint256 withdrawDelay = vm.envOr("WITHDRAW_DELAY", uint256(5 minutes));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        ReputationOracle reputation = new ReputationOracle(deployer);
        EmergencyVault emergencyVault = new EmergencyVault(withdrawDelay);

        // Testnet has no ERC-8004 registry — deploy a mock if none was supplied.
        if (identityRegistry == address(0)) {
            identityRegistry = address(new MockIdentityRegistry());
        }
        AgentRegistry registry = new AgentRegistry(identityRegistry);

        SentinelGuard guard = new SentinelGuard(
            monitorAddress, address(registry), address(reputation), address(emergencyVault)
        );

        reputation.addAuthorizedReporter(address(guard));

        vm.stopBroadcast();

        console.log("=== SENTINEL DEPLOYED ===");
        console.log("Chain ID:        ", block.chainid);
        console.log("ReputationOracle:", address(reputation));
        console.log("EmergencyVault:  ", address(emergencyVault));
        console.log("AgentRegistry:   ", address(registry));
        console.log("SentinelGuard:   ", address(guard));
        console.log("IdentityRegistry:", identityRegistry);
        console.log("Monitor:         ", monitorAddress);
    }
}
