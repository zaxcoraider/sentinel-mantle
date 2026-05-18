// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";

contract AgentRegistryTest is Test {
    MockIdentityRegistry internal identity;
    AgentRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");
    address internal agent = makeAddr("agent");
    address internal rules = makeAddr("rules");
    address internal guard = makeAddr("guard");
    uint256 internal tokenId;

    event AgentGuarded(
        address indexed agent,
        uint256 indexed tokenId,
        address rulesContract,
        address guardContract
    );
    event AgentDeregistered(address indexed agent, uint256 indexed tokenId);

    function setUp() public {
        identity = new MockIdentityRegistry();
        registry = new AgentRegistry(address(identity));
        tokenId = identity.mint(owner, agent, "ipfs://agent-meta");
    }

    // ============ constructor ============

    function test_constructor_setsIdentityRegistry() public view {
        assertEq(address(registry.identityRegistry()), address(identity));
    }

    function test_constructor_revertsOnZeroIdentityRegistry() public {
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        new AgentRegistry(address(0));
    }

    // ============ register ============

    function test_register_success() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        AgentRegistry.GuardConfig memory cfg = registry.getGuardConfig(agent);
        assertEq(cfg.erc8004TokenId, tokenId);
        assertEq(cfg.rulesContract, rules);
        assertEq(cfg.guardContract, guard);
        assertEq(cfg.registeredAt, uint64(block.timestamp));
        assertTrue(cfg.active);
        assertTrue(registry.isGuarded(agent));
    }

    function test_register_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit AgentGuarded(agent, tokenId, rules, guard);
        vm.prank(owner);
        registry.register(tokenId, rules, guard);
    }

    function test_register_revertsIfNotTokenOwner() public {
        vm.prank(stranger);
        vm.expectRevert(AgentRegistry.NotTokenOwner.selector);
        registry.register(tokenId, rules, guard);
    }

    function test_register_revertsIfAlreadyRegistered() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.AlreadyRegistered.selector, agent)
        );
        registry.register(tokenId, rules, guard);
    }

    function test_register_revertsOnZeroRulesContract() public {
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.register(tokenId, address(0), guard);
    }

    function test_register_revertsOnZeroGuardContract() public {
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.register(tokenId, rules, address(0));
    }

    function test_register_revertsIfAgentNotResolved() public {
        uint256 emptyToken = identity.mint(owner, address(0), "");
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.AgentNotResolved.selector, emptyToken)
        );
        registry.register(emptyToken, rules, guard);
    }

    function test_register_allowedAfterDeregister() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);
        vm.prank(owner);
        registry.deregister(agent);

        address newRules = makeAddr("newRules");
        vm.prank(owner);
        registry.register(tokenId, newRules, guard);

        assertTrue(registry.isGuarded(agent));
        assertEq(registry.rulesOf(agent), newRules);
    }

    // ============ deregister ============

    function test_deregister_success() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        vm.prank(owner);
        registry.deregister(agent);

        assertFalse(registry.isGuarded(agent));
        // History is retained.
        AgentRegistry.GuardConfig memory cfg = registry.getGuardConfig(agent);
        assertEq(cfg.erc8004TokenId, tokenId);
        assertGt(cfg.registeredAt, 0);
    }

    function test_deregister_emitsEvent() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        vm.expectEmit(true, true, false, false, address(registry));
        emit AgentDeregistered(agent, tokenId);
        vm.prank(owner);
        registry.deregister(agent);
    }

    function test_deregister_revertsIfNotRegistered() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.NotRegistered.selector, agent)
        );
        registry.deregister(agent);
    }

    function test_deregister_revertsIfNotTokenOwner() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        vm.prank(stranger);
        vm.expectRevert(AgentRegistry.NotTokenOwner.selector);
        registry.deregister(agent);
    }

    // ============ getAgentOwner ============

    function test_getAgentOwner_returnsLiveOwner() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);
        assertEq(registry.getAgentOwner(agent), owner);
    }

    function test_getAgentOwner_reflectsNftTransfer() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);

        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        identity.transferFrom(owner, newOwner, tokenId);

        assertEq(registry.getAgentOwner(agent), newOwner);
    }

    function test_getAgentOwner_revertsIfNotRegistered() public {
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.NotRegistered.selector, agent)
        );
        registry.getAgentOwner(agent);
    }

    // ============ views ============

    function test_isGuarded_falseWhenUnregistered() public view {
        assertFalse(registry.isGuarded(agent));
    }

    function test_rulesOf_returnsRulesContract() public {
        vm.prank(owner);
        registry.register(tokenId, rules, guard);
        assertEq(registry.rulesOf(agent), rules);
    }

    function test_getGuardConfig_unregisteredReturnsEmpty() public view {
        AgentRegistry.GuardConfig memory cfg = registry.getGuardConfig(agent);
        assertEq(cfg.registeredAt, 0);
        assertEq(cfg.rulesContract, address(0));
        assertFalse(cfg.active);
    }
}
