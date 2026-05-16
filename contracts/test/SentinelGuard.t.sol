// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SentinelGuard} from "../src/SentinelGuard.sol";

contract SentinelGuardTest is Test {
    SentinelGuard guard;

    address owner   = address(0xA11CE);
    address monitor = address(0xB0B);
    address agent   = address(0xAB1);
    address stranger = address(0xDEAD);

    bytes32 constant AGENT_ID = keccak256("erc8004-agent-1");

    function setUp() public {
        guard = new SentinelGuard(owner, monitor);
    }

    // ============ Deployment ============

    function test_deployment() public view {
        assertEq(guard.owner(), owner);
        assertEq(guard.monitor(), monitor);
        assertFalse(guard.paused());
    }

    function test_deployment_revertsOnZeroMonitor() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        new SentinelGuard(owner, address(0));
    }

    // ============ registerAgent ============

    function test_registerAgent() public {
        vm.prank(owner);
        guard.registerAgent(agent, AGENT_ID);

        (address addr, bytes32 id, uint256 registeredAt, bool active) = guard.agents(agent);
        assertEq(addr, agent);
        assertEq(id, AGENT_ID);
        assertTrue(registeredAt > 0);
        assertTrue(active);
    }

    function test_registerAgent_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit SentinelGuard.AgentRegistered(agent, AGENT_ID, 0);
        vm.prank(owner);
        guard.registerAgent(agent, AGENT_ID);
    }

    function test_registerAgent_revertsOnNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        guard.registerAgent(agent, AGENT_ID);
    }

    function test_registerAgent_revertsOnDuplicate() public {
        vm.startPrank(owner);
        guard.registerAgent(agent, AGENT_ID);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentAlreadyRegistered.selector, agent));
        guard.registerAgent(agent, AGENT_ID);
        vm.stopPrank();
    }

    // ============ triggerCircuitBreaker ============

    function test_triggerCircuitBreakerOnlyMonitor() public {
        vm.prank(stranger);
        vm.expectRevert(SentinelGuard.NotMonitor.selector);
        guard.triggerCircuitBreaker(bytes32("drawdown"));

        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("drawdown"));
        assertTrue(guard.paused());
    }

    function test_triggerCircuitBreaker_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit SentinelGuard.CircuitBreakerTriggered(monitor, bytes32("drawdown"), 0);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("drawdown"));
    }

    // ============ withdrawToSafety ============

    function test_withdrawToSafetyOnlyOwner() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("test"));
        vm.deal(address(guard), 1 ether);

        vm.prank(stranger);
        vm.expectRevert();
        guard.withdrawToSafety(stranger, address(0), 0.5 ether);

        uint256 before = owner.balance;
        vm.prank(owner);
        guard.withdrawToSafety(owner, address(0), 0.5 ether);
        assertEq(owner.balance - before, 0.5 ether);
    }

    function test_withdrawToSafety_revertsWhenNotPaused() public {
        vm.deal(address(guard), 1 ether);
        vm.prank(owner);
        vm.expectRevert(SentinelGuard.NotPaused.selector);
        guard.withdrawToSafety(owner, address(0), 0.5 ether);
    }

    function test_withdrawToSafety_revertsOnZeroRecipient() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("test"));
        vm.deal(address(guard), 1 ether);

        vm.prank(owner);
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        guard.withdrawToSafety(address(0), address(0), 0.5 ether);
    }

    // ============ deposit ============

    function test_nativeDeposit() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(guard).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(guard).balance, 1 ether);
    }

    function test_deposit_revertsWhenPaused() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("test"));

        vm.prank(stranger);
        vm.expectRevert();
        guard.deposit(mockToken(), 100e18);
    }

    // ============ unpause ============

    function test_unpause_onlyOwner() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(bytes32("test"));
        assertTrue(guard.paused());

        vm.prank(owner);
        guard.unpause();
        assertFalse(guard.paused());
    }

    // ============ Helpers ============

    function mockToken() internal pure returns (IERC20) {
        return IERC20(address(0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE));
    }
}
