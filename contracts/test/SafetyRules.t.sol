// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafetyRules} from "../src/SafetyRules.sol";

contract SafetyRulesTest is Test {
    SafetyRules rules;
    address owner = address(0xA11CE);
    address protocolA = address(0xBEEF);
    address protocolB = address(0xCAFE);

    function setUp() public {
        rules = new SafetyRules(
            owner,
            1000,           // 10% max drawdown
            50,             // 50 tx per hour
            500,            // 5% oracle deviation
            10_000e18,      // $10,000 daily cap
            9,              // 9:00 UTC
            21              // 21:00 UTC
        );
    }

    // ============ Constructor ============

    function test_constructor_setsInitialValues() public view {
        assertEq(rules.maxDrawdownBps(), 1000);
        assertEq(rules.maxTxPerHour(), 50);
        assertEq(rules.oracleDeviationBps(), 500);
        assertEq(rules.dailyVolumeCapUsd(), 10_000e18);
        assertEq(rules.timeOfDayMin(), 9);
        assertEq(rules.timeOfDayMax(), 21);
        assertEq(rules.owner(), owner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new SafetyRules(address(0), 1000, 50, 500, 10_000e18, 9, 21);
    }

    function test_constructor_revertsOnInvalidBps() public {
        vm.expectRevert(abi.encodeWithSelector(SafetyRules.InvalidBps.selector, 10_001));
        new SafetyRules(owner, 10_001, 50, 500, 10_000e18, 9, 21);
    }

    function test_constructor_revertsOnInvalidHour() public {
        vm.expectRevert(abi.encodeWithSelector(SafetyRules.InvalidHour.selector, 24));
        new SafetyRules(owner, 1000, 50, 500, 10_000e18, 24, 21);
    }

    // ============ Rule updates ============

    function test_setMaxDrawdown_onlyOwner() public {
        vm.expectRevert();
        rules.setMaxDrawdown(2000);

        vm.prank(owner);
        rules.setMaxDrawdown(2000);
        assertEq(rules.maxDrawdownBps(), 2000);
    }

    function test_setMaxDrawdown_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SafetyRules.RuleUpdated(rules.RULE_MAX_DRAWDOWN(), 1000, 2000);
        vm.prank(owner);
        rules.setMaxDrawdown(2000);
    }

    function test_setProtocolAllowed_addsToAllowlist() public {
        vm.prank(owner);
        rules.setProtocolAllowed(protocolA, true);
        assertTrue(rules.allowedProtocols(protocolA));
        assertEq(rules.allowedProtocolCount(), 1);
    }

    function test_setProtocolAllowed_idempotent() public {
        vm.startPrank(owner);
        rules.setProtocolAllowed(protocolA, true);
        rules.setProtocolAllowed(protocolA, true); // no-op
        assertEq(rules.allowedProtocolCount(), 1);
        vm.stopPrank();
    }

    function test_allowProtocolsBatch_addsMultiple() public {
        address[] memory protocols = new address[](2);
        protocols[0] = protocolA;
        protocols[1] = protocolB;
        vm.prank(owner);
        rules.allowProtocolsBatch(protocols);
        assertTrue(rules.allowedProtocols(protocolA));
        assertTrue(rules.allowedProtocols(protocolB));
        assertEq(rules.allowedProtocolCount(), 2);
    }

    // ============ Evaluation: drawdown ============

    function test_evaluate_safeWhenNoDrawdown() public {
        SafetyRules.AgentState memory state = _baselineState();
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertTrue(safe);
        assertEq(reason, bytes32(0));
    }

    function test_evaluate_violatesOnDrawdown() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.highWaterMark = 100e18;
        state.currentValue = 85e18; // 15% drawdown vs 10% max
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_MAX_DRAWDOWN());
    }

    function test_evaluate_passesAtExactDrawdownThreshold() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.highWaterMark = 100e18;
        state.currentValue = 90e18; // Exactly 10%
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);
    }

    // ============ Evaluation: tx rate ============

    function test_evaluate_violatesOnTxRateExceeded() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.txCountThisHour = 51;
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_MAX_TX_PER_HOUR());
    }

    function test_evaluate_passesAtTxRateThreshold() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.txCountThisHour = 50;
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);
    }

    // ============ Evaluation: protocol allowlist ============

    function test_evaluate_violatesOnDisallowedProtocol() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.lastCalledProtocol = protocolA; // not in allowlist
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_ALLOWED_PROTOCOLS());
    }

    function test_evaluate_passesOnAllowedProtocol() public {
        vm.prank(owner);
        rules.setProtocolAllowed(protocolA, true);

        SafetyRules.AgentState memory state = _baselineState();
        state.lastCalledProtocol = protocolA;
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);
    }

    // ============ Evaluation: oracle deviation ============

    function test_evaluate_violatesOnOracleDeviation() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.lastPriceUsed = 100e18;
        state.lastReferencePrice = 110e18; // ~9% deviation vs 5% max
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_ORACLE_DEVIATION());
    }

    function test_evaluate_passesOnSmallDeviation() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.lastPriceUsed = 100e18;
        state.lastReferencePrice = 102e18; // 2% deviation
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);
    }

    // ============ Evaluation: daily volume ============

    function test_evaluate_violatesOnVolumeCap() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.volume24hUsd = 10_001e18;
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_DAILY_VOLUME());
    }

    // ============ Evaluation: time window ============

    function test_evaluate_violatesOnOffHours() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.currentHourUtc = 3; // outside 9-21 window
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_TIME_WINDOW());
    }

    function test_evaluate_passesAtWindowEdges() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.currentHourUtc = 9;
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);

        state.currentHourUtc = 21;
        (safe,) = rules.evaluate(state);
        assertTrue(safe);
    }

    function test_evaluate_overnightWindow() public {
        // Set overnight window: 22:00 - 06:59
        vm.prank(owner);
        rules.setTimeWindow(22, 6);

        SafetyRules.AgentState memory state = _baselineState();

        state.currentHourUtc = 23; // late night, allowed
        (bool safe,) = rules.evaluate(state);
        assertTrue(safe);

        state.currentHourUtc = 3; // early morning, allowed
        (safe,) = rules.evaluate(state);
        assertTrue(safe);

        state.currentHourUtc = 12; // midday, NOT allowed
        bytes32 reason;
        (safe, reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_TIME_WINDOW());
    }

    // ============ Combined evaluation ============

    function test_evaluate_returnsFirstViolation() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.highWaterMark = 100e18;
        state.currentValue = 50e18;       // drawdown violation
        state.txCountThisHour = 9999;     // also tx rate violation
        (bool safe, bytes32 reason) = rules.evaluate(state);
        assertFalse(safe);
        assertEq(reason, rules.RULE_MAX_DRAWDOWN()); // drawdown checked first
    }

    // ============ evaluateAndEmit ============

    function test_evaluateAndEmit_emitsRuleViolated() public {
        SafetyRules.AgentState memory state = _baselineState();
        state.highWaterMark = 100e18;
        state.currentValue = 50e18;

        vm.expectEmit(true, false, false, false);
        emit SafetyRules.RuleViolated(rules.RULE_MAX_DRAWDOWN(), 0, 0); // values don't matter, structure does
        rules.evaluateAndEmit(state);
    }

    // ============ Helpers ============

    function _baselineState() internal pure returns (SafetyRules.AgentState memory) {
        return SafetyRules.AgentState({
            currentValue: 100e18,
            highWaterMark: 100e18,
            txCountThisHour: 0,
            lastCalledProtocol: address(0),
            lastPriceUsed: 0,
            lastReferencePrice: 0,
            volume24hUsd: 0,
            currentHourUtc: 12
        });
    }
}
