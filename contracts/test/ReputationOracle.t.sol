// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReputationOracle} from "../src/ReputationOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationOracleTest is Test {
    ReputationOracle internal oracle;

    address internal owner = makeAddr("owner");
    address internal reporter = makeAddr("reporter");
    address internal stranger = makeAddr("stranger");
    address internal agent = makeAddr("agent");

    event ReputationChanged(
        address indexed agent,
        int256 delta,
        uint256 newScore,
        ReputationOracle.EventType reason
    );
    event ReporterAuthorized(address indexed reporter, bool authorized);

    function setUp() public {
        oracle = new ReputationOracle(owner);
        vm.prank(owner);
        oracle.addAuthorizedReporter(reporter);
    }

    function _record(ReputationOracle.EventType e) internal {
        vm.prank(reporter);
        oracle.recordEvent(agent, e);
    }

    // ============ constructor ============

    function test_constructor_setsOwner() public view {
        assertEq(oracle.owner(), owner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0))
        );
        new ReputationOracle(address(0));
    }

    function test_constants() public view {
        assertEq(oracle.INITIAL_SCORE(), 500);
        assertEq(oracle.MAX_SCORE(), 1000);
        assertEq(oracle.MIN_SCORE(), 0);
    }

    // ============ reporter management ============

    function test_addAuthorizedReporter_success() public {
        address r = makeAddr("r2");
        vm.prank(owner);
        oracle.addAuthorizedReporter(r);
        assertTrue(oracle.authorizedReporters(r));
    }

    function test_addAuthorizedReporter_emitsEvent() public {
        address r = makeAddr("r2");
        vm.expectEmit(true, false, false, true, address(oracle));
        emit ReporterAuthorized(r, true);
        vm.prank(owner);
        oracle.addAuthorizedReporter(r);
    }

    function test_addAuthorizedReporter_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(ReputationOracle.ZeroAddress.selector);
        oracle.addAuthorizedReporter(address(0));
    }

    function test_addAuthorizedReporter_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        oracle.addAuthorizedReporter(stranger);
    }

    function test_removeAuthorizedReporter_success() public {
        vm.prank(owner);
        oracle.removeAuthorizedReporter(reporter);
        assertFalse(oracle.authorizedReporters(reporter));
    }

    function test_removeAuthorizedReporter_emitsEvent() public {
        vm.expectEmit(true, false, false, true, address(oracle));
        emit ReporterAuthorized(reporter, false);
        vm.prank(owner);
        oracle.removeAuthorizedReporter(reporter);
    }

    function test_removeAuthorizedReporter_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        oracle.removeAuthorizedReporter(reporter);
    }

    function test_removedReporter_cannotRecord() public {
        vm.prank(owner);
        oracle.removeAuthorizedReporter(reporter);
        vm.prank(reporter);
        vm.expectRevert(ReputationOracle.NotAuthorizedReporter.selector);
        oracle.recordEvent(agent, ReputationOracle.EventType.CleanDay);
    }

    // ============ recordEvent access ============

    function test_recordEvent_revertsIfNotAuthorized() public {
        vm.prank(stranger);
        vm.expectRevert(ReputationOracle.NotAuthorizedReporter.selector);
        oracle.recordEvent(agent, ReputationOracle.EventType.CleanDay);
    }

    function test_recordEvent_revertsOnZeroAgent() public {
        vm.prank(reporter);
        vm.expectRevert(ReputationOracle.ZeroAddress.selector);
        oracle.recordEvent(address(0), ReputationOracle.EventType.CleanDay);
    }

    // ============ each event type (initializes at 500) ============

    function test_recordEvent_cleanDay() public {
        _record(ReputationOracle.EventType.CleanDay);
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 501);
    }

    function test_recordEvent_ruleViolation() public {
        _record(ReputationOracle.EventType.RuleViolation);
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 450);
    }

    function test_recordEvent_circuitBreaker() public {
        _record(ReputationOracle.EventType.CircuitBreaker);
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 300);
    }

    function test_recordEvent_successfulRecovery() public {
        _record(ReputationOracle.EventType.SuccessfulRecovery);
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 510);
    }

    function test_recordEvent_slashingEvent_isNeutral() public {
        _record(ReputationOracle.EventType.SlashingEvent);
        (uint256 score,, uint256 count) = oracle.getReputation(agent);
        assertEq(score, 500);
        assertEq(count, 1); // still recorded for audit
    }

    // ============ metadata ============

    function test_recordEvent_updatesMetadata() public {
        vm.warp(123_456);
        _record(ReputationOracle.EventType.CleanDay);
        (, uint256 lastUpdated, uint256 count) = oracle.getReputation(agent);
        assertEq(lastUpdated, 123_456);
        assertEq(count, 1);

        _record(ReputationOracle.EventType.CleanDay);
        (,, count) = oracle.getReputation(agent);
        assertEq(count, 2);
    }

    function test_recordEvent_emitsEvent() public {
        vm.expectEmit(true, false, false, true, address(oracle));
        emit ReputationChanged(agent, -50, 450, ReputationOracle.EventType.RuleViolation);
        _record(ReputationOracle.EventType.RuleViolation);
    }

    // ============ score capping ============

    function test_score_cappedAtMax() public {
        vm.startPrank(reporter);
        for (uint256 i = 0; i < 50; i++) {
            oracle.recordEvent(agent, ReputationOracle.EventType.SuccessfulRecovery);
        }
        vm.stopPrank();
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 1000); // 500 + 50*10 = 1000

        _record(ReputationOracle.EventType.SuccessfulRecovery);
        (score,,) = oracle.getReputation(agent);
        assertEq(score, 1000); // capped
    }

    function test_score_cappedAtMin() public {
        _record(ReputationOracle.EventType.CircuitBreaker); // 500 -> 300
        _record(ReputationOracle.EventType.CircuitBreaker); // 300 -> 100
        _record(ReputationOracle.EventType.CircuitBreaker); // 100 -> 0 (clamped)
        (uint256 score,,) = oracle.getReputation(agent);
        assertEq(score, 0);

        _record(ReputationOracle.EventType.RuleViolation); // stays 0
        (score,,) = oracle.getReputation(agent);
        assertEq(score, 0);
    }

    function test_emit_effectiveDeltaWhenClamped() public {
        _record(ReputationOracle.EventType.CircuitBreaker); // 500 -> 300
        _record(ReputationOracle.EventType.CircuitBreaker); // 300 -> 100
        // 100 - 200 clamps to 0, so the effective delta is -100, not -200.
        vm.expectEmit(true, false, false, true, address(oracle));
        emit ReputationChanged(agent, -100, 0, ReputationOracle.EventType.CircuitBreaker);
        _record(ReputationOracle.EventType.CircuitBreaker);
    }

    // ============ getReputation uninitialized ============

    function test_getReputation_uninitializedReturns500() public view {
        (uint256 score, uint256 lastUpdated, uint256 count) = oracle.getReputation(agent);
        assertEq(score, 500);
        assertEq(lastUpdated, 0);
        assertEq(count, 0);
    }

    // ============ history ============

    function test_history_recordsEntries() public {
        _record(ReputationOracle.EventType.CleanDay);
        _record(ReputationOracle.EventType.RuleViolation);
        assertEq(oracle.historyLength(agent), 2);

        ReputationOracle.RepEvent[] memory h = oracle.getAgentHistory(agent, 0, 10);
        assertEq(h.length, 2);
        assertEq(uint256(h[0].eventType), uint256(ReputationOracle.EventType.CleanDay));
        assertEq(h[0].scoreAfter, 501);
        assertEq(h[0].delta, 1);
        assertEq(uint256(h[1].eventType), uint256(ReputationOracle.EventType.RuleViolation));
        assertEq(h[1].scoreAfter, 451);
        assertEq(h[1].delta, -50);
    }

    function test_history_pagination() public {
        vm.startPrank(reporter);
        for (uint256 i = 0; i < 5; i++) {
            oracle.recordEvent(agent, ReputationOracle.EventType.CleanDay);
        }
        vm.stopPrank();

        ReputationOracle.RepEvent[] memory page = oracle.getAgentHistory(agent, 1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].scoreAfter, 502); // 2nd event
        assertEq(page[1].scoreAfter, 503); // 3rd event
    }

    function test_history_offsetBeyondEndReturnsEmpty() public {
        _record(ReputationOracle.EventType.CleanDay);
        ReputationOracle.RepEvent[] memory page = oracle.getAgentHistory(agent, 5, 10);
        assertEq(page.length, 0);
    }

    function test_history_limitClampedToRemaining() public {
        vm.startPrank(reporter);
        for (uint256 i = 0; i < 3; i++) {
            oracle.recordEvent(agent, ReputationOracle.EventType.CleanDay);
        }
        vm.stopPrank();

        ReputationOracle.RepEvent[] memory page = oracle.getAgentHistory(agent, 1, 100);
        assertEq(page.length, 2); // only 2 remain after offset 1
    }

    function test_historyLength_zeroForUnknownAgent() public view {
        assertEq(oracle.historyLength(agent), 0);
    }
}
