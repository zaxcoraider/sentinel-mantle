// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SentinelGuard} from "../src/SentinelGuard.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationOracle} from "../src/ReputationOracle.sol";
import {EmergencyVault} from "../src/EmergencyVault.sol";
import {SafetyRules} from "../src/SafetyRules.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockTarget} from "./mocks/MockTarget.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";

contract SentinelGuardTest is Test {
    MockIdentityRegistry internal identity;
    ReputationOracle internal reputation;
    EmergencyVault internal vault;
    AgentRegistry internal registry;
    SentinelGuard internal guard;
    SafetyRules internal rules;
    MockERC20 internal token;
    MockTarget internal target;

    address internal oracleOwner = makeAddr("oracleOwner");
    address internal monitor = makeAddr("monitor");
    address internal agentOwner = makeAddr("agentOwner");
    address internal agent = makeAddr("agent");
    address internal stranger = makeAddr("stranger");

    uint256 internal tokenId;
    uint256 internal constant WITHDRAW_DELAY = 5 minutes;

    function setUp() public {
        identity = new MockIdentityRegistry();
        reputation = new ReputationOracle(oracleOwner);
        vault = new EmergencyVault(WITHDRAW_DELAY);
        registry = new AgentRegistry(address(identity));
        guard = new SentinelGuard(
            monitor, address(registry), address(reputation), address(vault)
        );

        vm.prank(oracleOwner);
        reputation.addAuthorizedReporter(address(guard));

        tokenId = identity.mint(agentOwner, agent, "ipfs://agent");

        // 10% drawdown, 50 tx/hr, 5% oracle dev, $10k volume, all-day window.
        rules = new SafetyRules(agentOwner, 1000, 50, 500, 10_000e18, 0, 23);

        target = new MockTarget();
        vm.prank(agentOwner);
        rules.setProtocolAllowed(address(target), true);

        vm.prank(agentOwner);
        registry.register(tokenId, address(rules), address(guard));

        token = new MockERC20("Mock USD", "mUSD");
        vm.deal(address(this), 1000 ether);
    }

    // ============ helpers ============

    function _fundNative(uint256 amount) internal {
        guard.depositNativeForAgent{value: amount}(agent);
    }

    function _fundToken(uint256 amount) internal {
        token.mint(address(this), amount);
        token.approve(address(guard), amount);
        guard.depositForAgent(agent, address(token), amount);
    }

    function _pingData() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(MockTarget.ping.selector);
    }

    // ============ constructor ============

    function test_constructor_setsImmutables() public view {
        assertEq(guard.monitor(), monitor);
        assertEq(address(guard.registry()), address(registry));
        assertEq(address(guard.reputation()), address(reputation));
        assertEq(address(guard.emergencyVault()), address(vault));
    }

    function test_constructor_revertsOnZeroMonitor() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        new SentinelGuard(address(0), address(registry), address(reputation), address(vault));
    }

    function test_constructor_revertsOnZeroRegistry() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        new SentinelGuard(monitor, address(0), address(reputation), address(vault));
    }

    function test_constructor_revertsOnZeroReputation() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        new SentinelGuard(monitor, address(registry), address(0), address(vault));
    }

    function test_constructor_revertsOnZeroEmergencyVault() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        new SentinelGuard(monitor, address(registry), address(reputation), address(0));
    }

    // ============ depositForAgent ============

    function test_depositForAgent_success() public {
        _fundToken(1000e18);
        assertEq(guard.balanceOf(agent, address(token)), 1000e18);
    }

    function test_depositForAgent_tracksToken() public {
        _fundToken(100e18);
        address[] memory tokens = guard.getAgentTokens(agent);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(token));
    }

    function test_depositForAgent_emitsEvent() public {
        token.mint(address(this), 100e18);
        token.approve(address(guard), 100e18);
        vm.expectEmit(true, true, true, true, address(guard));
        emit SentinelGuard.Deposited(agent, address(token), 100e18, address(this));
        guard.depositForAgent(agent, address(token), 100e18);
    }

    function test_depositForAgent_revertsOnZeroToken() public {
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        guard.depositForAgent(agent, address(0), 100e18);
    }

    function test_depositForAgent_revertsOnZeroAmount() public {
        vm.expectRevert(SentinelGuard.ZeroAmount.selector);
        guard.depositForAgent(agent, address(token), 0);
    }

    function test_depositForAgent_revertsIfAgentNotGuarded() public {
        token.mint(address(this), 100e18);
        token.approve(address(guard), 100e18);
        vm.expectRevert(
            abi.encodeWithSelector(SentinelGuard.AgentNotGuarded.selector, stranger)
        );
        guard.depositForAgent(stranger, address(token), 100e18);
    }

    function test_depositNativeForAgent_success() public {
        _fundNative(5 ether);
        assertEq(guard.balanceOf(agent, address(0)), 5 ether);
    }

    function test_depositNativeForAgent_emitsEvent() public {
        vm.expectEmit(true, true, true, true, address(guard));
        emit SentinelGuard.Deposited(agent, address(0), 5 ether, address(this));
        guard.depositNativeForAgent{value: 5 ether}(agent);
    }

    function test_depositNativeForAgent_revertsOnZeroValue() public {
        vm.expectRevert(SentinelGuard.ZeroAmount.selector);
        guard.depositNativeForAgent{value: 0}(agent);
    }

    function test_depositNativeForAgent_revertsIfAgentNotGuarded() public {
        vm.expectRevert(
            abi.encodeWithSelector(SentinelGuard.AgentNotGuarded.selector, stranger)
        );
        guard.depositNativeForAgent{value: 1 ether}(stranger);
    }

    // ============ executeAsAgent ============

    function test_executeAsAgent_happyPath() public {
        _fundNative(10 ether);
        vm.prank(agent);
        guard.executeAsAgent(address(target), _pingData(), 1 ether);
        assertEq(guard.balanceOf(agent, address(0)), 9 ether);
        assertEq(target.pings(), 1);
        assertEq(target.totalReceived(), 1 ether);
    }

    function test_executeAsAgent_emitsEvent() public {
        _fundNative(5 ether);
        vm.expectEmit(true, true, false, true, address(guard));
        emit SentinelGuard.AgentExecuted(agent, address(target), 1 ether, MockTarget.ping.selector);
        vm.prank(agent);
        guard.executeAsAgent(address(target), _pingData(), 1 ether);
    }

    function test_executeAsAgent_incrementsTxCount() public {
        vm.startPrank(agent);
        guard.executeAsAgent(address(target), _pingData(), 0);
        guard.executeAsAgent(address(target), _pingData(), 0);
        vm.stopPrank();
        assertEq(guard.txCountThisHour(agent), 2);
    }

    function test_executeAsAgent_creditsRefund() public {
        _fundNative(10 ether);
        target.setRefundBps(5000); // refund 50%
        vm.prank(agent);
        guard.executeAsAgent(address(target), _pingData(), 2 ether);
        // sent 2, refunded 1 -> 10 - 2 + 1 = 9
        assertEq(guard.balanceOf(agent, address(0)), 9 ether);
    }

    function test_executeAsAgent_revertsIfNotGuarded() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(SentinelGuard.AgentNotGuarded.selector, stranger)
        );
        guard.executeAsAgent(address(target), _pingData(), 0);
    }

    function test_executeAsAgent_revertsIfPaused() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("test"));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentIsPaused.selector, agent));
        guard.executeAsAgent(address(target), _pingData(), 0);
    }

    function test_executeAsAgent_revertsOnZeroTarget() public {
        vm.prank(agent);
        vm.expectRevert(SentinelGuard.ZeroAddress.selector);
        guard.executeAsAgent(address(0), _pingData(), 0);
    }

    function test_executeAsAgent_revertsOnDisallowedProtocol() public {
        MockTarget bad = new MockTarget();
        bytes memory expectedErr = abi.encodeWithSelector(
            SentinelGuard.RuleCheckFailed.selector, rules.RULE_ALLOWED_PROTOCOLS()
        );
        vm.prank(agent);
        vm.expectRevert(expectedErr);
        guard.executeAsAgent(address(bad), _pingData(), 0);
    }

    function test_executeAsAgent_revertsOnTxRateExceeded() public {
        vm.startPrank(agent);
        for (uint256 i = 0; i < 50; i++) {
            guard.executeAsAgent(address(target), _pingData(), 0);
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelGuard.RuleCheckFailed.selector, rules.RULE_MAX_TX_PER_HOUR()
            )
        );
        guard.executeAsAgent(address(target), _pingData(), 0);
        vm.stopPrank();
    }

    function test_executeAsAgent_revertsOnInsufficientBalance() public {
        _fundNative(1 ether);
        vm.prank(agent);
        vm.expectRevert(SentinelGuard.InsufficientBalance.selector);
        guard.executeAsAgent(address(target), _pingData(), 5 ether);
    }

    function test_executeAsAgent_revertsOnProtocolCallFailed() public {
        bytes memory data = abi.encodeWithSelector(MockTarget.boom.selector);
        vm.prank(agent);
        vm.expectRevert();
        guard.executeAsAgent(address(target), data, 0);
    }

    function test_executeAsAgent_ruleBlockDoesNotPause() public {
        MockTarget bad = new MockTarget();
        vm.prank(agent);
        vm.expectRevert();
        guard.executeAsAgent(address(bad), _pingData(), 0);
        assertFalse(guard.isPaused(agent));
    }

    function test_executeAsAgent_reentrancyBlocked() public {
        _fundNative(10 ether);
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(guard));
        vm.prank(agentOwner);
        rules.setProtocolAllowed(address(attacker), true);
        vm.prank(agent);
        vm.expectRevert();
        guard.executeAsAgent(address(attacker), "", 0);
    }

    // ============ triggerCircuitBreaker ============

    function test_triggerCircuitBreaker_success() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("drawdown"));
        assertTrue(guard.isPaused(agent));
        assertEq(guard.pausedAt(agent), block.timestamp);
    }

    function test_triggerCircuitBreaker_onlyMonitor() public {
        vm.prank(stranger);
        vm.expectRevert(SentinelGuard.NotMonitor.selector);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
    }

    function test_triggerCircuitBreaker_revertsIfNotGuarded() public {
        vm.prank(monitor);
        vm.expectRevert(
            abi.encodeWithSelector(SentinelGuard.AgentNotGuarded.selector, stranger)
        );
        guard.triggerCircuitBreaker(stranger, bytes32("x"));
    }

    function test_triggerCircuitBreaker_revertsIfAlreadyPaused() public {
        vm.startPrank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentIsPaused.selector, agent));
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.stopPrank();
    }

    function test_triggerCircuitBreaker_recordsReputation() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        (uint256 score,,) = reputation.getReputation(agent);
        assertEq(score, 300); // 500 - 200
    }

    function test_triggerCircuitBreaker_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(guard));
        emit SentinelGuard.CircuitBreakerTriggered(agent, bytes32("drawdown"), block.timestamp);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("drawdown"));
    }

    // ============ ownerPauseAgent ============

    function test_ownerPauseAgent_success() public {
        vm.prank(agentOwner);
        guard.ownerPauseAgent(agent);
        assertTrue(guard.isPaused(agent));
    }

    function test_ownerPauseAgent_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(SentinelGuard.NotAgentOwner.selector);
        guard.ownerPauseAgent(agent);
    }

    function test_ownerPauseAgent_revertsIfAlreadyPaused() public {
        vm.startPrank(agentOwner);
        guard.ownerPauseAgent(agent);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentIsPaused.selector, agent));
        guard.ownerPauseAgent(agent);
        vm.stopPrank();
    }

    function test_ownerPauseAgent_noReputationPenalty() public {
        vm.prank(agentOwner);
        guard.ownerPauseAgent(agent);
        (uint256 score,,) = reputation.getReputation(agent);
        assertEq(score, 500); // unchanged
    }

    function test_ownerPauseAgent_emitsEvent() public {
        vm.expectEmit(true, false, false, true, address(guard));
        emit SentinelGuard.AgentPausedByOwner(agent, block.timestamp);
        vm.prank(agentOwner);
        guard.ownerPauseAgent(agent);
    }

    // ============ rescueToSafety ============

    function test_rescueToSafety_movesNativeToVault() public {
        _fundNative(10 ether);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.prank(agentOwner);
        guard.rescueToSafety(agent);
        assertEq(guard.balanceOf(agent, address(0)), 0);
        assertEq(vault.balances(agentOwner, address(0)), 10 ether);
    }

    function test_rescueToSafety_movesTokensToVault() public {
        _fundToken(1000e18);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.prank(agentOwner);
        guard.rescueToSafety(agent);
        assertEq(guard.balanceOf(agent, address(token)), 0);
        assertEq(vault.balances(agentOwner, address(token)), 1000e18);
    }

    function test_rescueToSafety_movesMultipleAssets() public {
        _fundNative(3 ether);
        _fundToken(500e18);
        MockERC20 token2 = new MockERC20("Token2", "TK2");
        token2.mint(address(this), 200e18);
        token2.approve(address(guard), 200e18);
        guard.depositForAgent(agent, address(token2), 200e18);

        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.prank(agentOwner);
        guard.rescueToSafety(agent);

        assertEq(vault.balances(agentOwner, address(0)), 3 ether);
        assertEq(vault.balances(agentOwner, address(token)), 500e18);
        assertEq(vault.balances(agentOwner, address(token2)), 200e18);
    }

    function test_rescueToSafety_onlyOwner() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.prank(stranger);
        vm.expectRevert(SentinelGuard.NotAgentOwner.selector);
        guard.rescueToSafety(agent);
    }

    function test_rescueToSafety_revertsIfNotPaused() public {
        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentNotPaused.selector, agent));
        guard.rescueToSafety(agent);
    }

    function test_rescueToSafety_recordsReputation() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x")); // 500 -> 300
        vm.prank(agentOwner);
        guard.rescueToSafety(agent); // +10 -> 310
        (uint256 score,,) = reputation.getReputation(agent);
        assertEq(score, 310);
    }

    function test_rescueToSafety_emitsEvent() public {
        _fundNative(5 ether);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.expectEmit(true, true, false, true, address(guard));
        emit SentinelGuard.FundsRescued(agent, agentOwner, 1);
        vm.prank(agentOwner);
        guard.rescueToSafety(agent);
    }

    // ============ unpauseAgent ============

    function test_unpauseAgent_success() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.warp(block.timestamp + guard.UNPAUSE_COOLDOWN());
        vm.prank(agentOwner);
        guard.unpauseAgent(agent);
        assertFalse(guard.isPaused(agent));
    }

    function test_unpauseAgent_onlyOwner() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.warp(block.timestamp + guard.UNPAUSE_COOLDOWN());
        vm.prank(stranger);
        vm.expectRevert(SentinelGuard.NotAgentOwner.selector);
        guard.unpauseAgent(agent);
    }

    function test_unpauseAgent_revertsIfNotPaused() public {
        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.AgentNotPaused.selector, agent));
        guard.unpauseAgent(agent);
    }

    function test_unpauseAgent_revertsDuringCooldown() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        uint256 readyAt = block.timestamp + guard.UNPAUSE_COOLDOWN();
        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(SentinelGuard.CooldownActive.selector, readyAt));
        guard.unpauseAgent(agent);
    }

    function test_unpauseAgent_emitsEvent() public {
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.warp(block.timestamp + guard.UNPAUSE_COOLDOWN());
        vm.expectEmit(true, false, false, true, address(guard));
        emit SentinelGuard.AgentUnpaused(agent, block.timestamp);
        vm.prank(agentOwner);
        guard.unpauseAgent(agent);
    }

    function test_unpauseAgent_allowsExecuteAgain() public {
        _fundNative(5 ether);
        vm.prank(monitor);
        guard.triggerCircuitBreaker(agent, bytes32("x"));
        vm.warp(block.timestamp + guard.UNPAUSE_COOLDOWN());
        vm.prank(agentOwner);
        guard.unpauseAgent(agent);
        vm.prank(agent);
        guard.executeAsAgent(address(target), _pingData(), 1 ether);
        assertEq(target.pings(), 1);
    }

    // ============ views ============

    function test_getAgentTokens_emptyByDefault() public view {
        assertEq(guard.getAgentTokens(agent).length, 0);
    }
}
