// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SentinelGuard} from "../src/SentinelGuard.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address monitorAddress = vm.envAddress("MONITOR_ADDRESS");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        SentinelGuard guard = new SentinelGuard(deployer, monitorAddress);
        vm.stopBroadcast();

        console.log("=== SENTINEL DEPLOYED ===");
        console.log("SentinelGuard:", address(guard));
        console.log("Owner (deployer):", deployer);
        console.log("Monitor:", monitorAddress);
        console.log("Chain ID:", block.chainid);
        console.log("Explorer: https://explorer.sepolia.mantle.xyz/address/%s", address(guard));
    }
}
