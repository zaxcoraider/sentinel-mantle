// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EmergencyVault} from "../src/EmergencyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev A beneficiary contract that cannot receive native MNT.
contract MockRejector {
    function claim(EmergencyVault vault) external {
        vault.claimNative();
    }
}

contract EmergencyVaultTest is Test {
    EmergencyVault internal vault;
    MockERC20 internal token;

    address internal beneficiary = makeAddr("beneficiary");
    address internal depositor = makeAddr("depositor");
    uint256 internal constant DELAY = 1 hours;

    function setUp() public {
        vault = new EmergencyVault(DELAY);
        token = new MockERC20("Mock", "MCK");
    }

    function _depositToken(uint256 amount) internal {
        token.mint(depositor, amount);
        vm.startPrank(depositor);
        token.approve(address(vault), amount);
        vault.depositFor(beneficiary, address(token), amount);
        vm.stopPrank();
    }

    function _depositNative(uint256 amount) internal {
        vm.deal(depositor, amount);
        vm.prank(depositor);
        vault.depositNativeFor{value: amount}(beneficiary);
    }

    // ============ constructor ============

    function test_constructor_setsWithdrawDelay() public view {
        assertEq(vault.withdrawDelay(), DELAY);
    }

    // ============ depositFor ============

    function test_depositFor_success() public {
        _depositToken(1000e18);
        assertEq(vault.balances(beneficiary, address(token)), 1000e18);
        assertEq(vault.unlockAt(beneficiary, address(token)), block.timestamp + DELAY);
    }

    function test_depositFor_emitsEvent() public {
        token.mint(depositor, 100e18);
        vm.startPrank(depositor);
        token.approve(address(vault), 100e18);
        vm.expectEmit(true, true, false, true, address(vault));
        emit EmergencyVault.RescueDeposited(
            beneficiary, address(token), 100e18, block.timestamp + DELAY
        );
        vault.depositFor(beneficiary, address(token), 100e18);
        vm.stopPrank();
    }

    function test_depositFor_revertsOnZeroBeneficiary() public {
        vm.expectRevert(EmergencyVault.ZeroAddress.selector);
        vault.depositFor(address(0), address(token), 100e18);
    }

    function test_depositFor_revertsOnZeroToken() public {
        vm.expectRevert(EmergencyVault.ZeroAddress.selector);
        vault.depositFor(beneficiary, address(0), 100e18);
    }

    function test_depositFor_revertsOnZeroAmount() public {
        vm.expectRevert(EmergencyVault.ZeroAmount.selector);
        vault.depositFor(beneficiary, address(token), 0);
    }

    function test_depositFor_refreshesTimelock() public {
        token.mint(depositor, 200e18);
        vm.startPrank(depositor);
        token.approve(address(vault), 200e18);
        vault.depositFor(beneficiary, address(token), 100e18);
        uint256 firstUnlock = vault.unlockAt(beneficiary, address(token));
        vm.warp(block.timestamp + 30 minutes);
        vault.depositFor(beneficiary, address(token), 100e18);
        vm.stopPrank();
        assertGt(vault.unlockAt(beneficiary, address(token)), firstUnlock);
        assertEq(vault.balances(beneficiary, address(token)), 200e18);
    }

    // ============ depositNativeFor ============

    function test_depositNativeFor_success() public {
        _depositNative(5 ether);
        assertEq(vault.balances(beneficiary, address(0)), 5 ether);
        assertEq(vault.unlockAt(beneficiary, address(0)), block.timestamp + DELAY);
    }

    function test_depositNativeFor_emitsEvent() public {
        vm.deal(depositor, 5 ether);
        vm.expectEmit(true, true, false, true, address(vault));
        emit EmergencyVault.RescueDeposited(
            beneficiary, address(0), 5 ether, block.timestamp + DELAY
        );
        vm.prank(depositor);
        vault.depositNativeFor{value: 5 ether}(beneficiary);
    }

    function test_depositNativeFor_revertsOnZeroBeneficiary() public {
        vm.deal(depositor, 1 ether);
        vm.prank(depositor);
        vm.expectRevert(EmergencyVault.ZeroAddress.selector);
        vault.depositNativeFor{value: 1 ether}(address(0));
    }

    function test_depositNativeFor_revertsOnZeroValue() public {
        vm.expectRevert(EmergencyVault.ZeroAmount.selector);
        vault.depositNativeFor{value: 0}(beneficiary);
    }

    // ============ claim ============

    function test_claim_success() public {
        _depositToken(1000e18);
        vm.warp(block.timestamp + DELAY);
        vm.prank(beneficiary);
        vault.claim(address(token));
        assertEq(token.balanceOf(beneficiary), 1000e18);
        assertEq(vault.balances(beneficiary, address(token)), 0);
    }

    function test_claim_emitsEvent() public {
        _depositToken(500e18);
        vm.warp(block.timestamp + DELAY);
        vm.expectEmit(true, true, false, true, address(vault));
        emit EmergencyVault.RescueClaimed(beneficiary, address(token), 500e18);
        vm.prank(beneficiary);
        vault.claim(address(token));
    }

    function test_claim_revertsBeforeDelay() public {
        _depositToken(1000e18);
        uint256 unlock = vault.unlockAt(beneficiary, address(token));
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(EmergencyVault.StillLocked.selector, unlock));
        vault.claim(address(token));
    }

    function test_claim_revertsIfNothingToClaim() public {
        vm.prank(beneficiary);
        vm.expectRevert(EmergencyVault.NothingToClaim.selector);
        vault.claim(address(token));
    }

    function test_claim_revertsOnZeroToken() public {
        vm.prank(beneficiary);
        vm.expectRevert(EmergencyVault.ZeroAddress.selector);
        vault.claim(address(0));
    }

    // ============ claimNative ============

    function test_claimNative_success() public {
        _depositNative(5 ether);
        vm.warp(block.timestamp + DELAY);
        vm.prank(beneficiary);
        vault.claimNative();
        assertEq(beneficiary.balance, 5 ether);
        assertEq(vault.balances(beneficiary, address(0)), 0);
    }

    function test_claimNative_emitsEvent() public {
        _depositNative(2 ether);
        vm.warp(block.timestamp + DELAY);
        vm.expectEmit(true, true, false, true, address(vault));
        emit EmergencyVault.RescueClaimed(beneficiary, address(0), 2 ether);
        vm.prank(beneficiary);
        vault.claimNative();
    }

    function test_claimNative_revertsBeforeDelay() public {
        _depositNative(5 ether);
        uint256 unlock = vault.unlockAt(beneficiary, address(0));
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(EmergencyVault.StillLocked.selector, unlock));
        vault.claimNative();
    }

    function test_claimNative_revertsIfNothingToClaim() public {
        vm.prank(beneficiary);
        vm.expectRevert(EmergencyVault.NothingToClaim.selector);
        vault.claimNative();
    }

    function test_claimNative_revertsOnTransferFailure() public {
        MockRejector rejector = new MockRejector();
        vm.deal(depositor, 5 ether);
        vm.prank(depositor);
        vault.depositNativeFor{value: 5 ether}(address(rejector));
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert(EmergencyVault.NativeTransferFailed.selector);
        rejector.claim(vault);
    }

    // ============ claimableAt ============

    function test_claimableAt_returnsUnlock() public {
        _depositToken(100e18);
        assertEq(vault.claimableAt(beneficiary, address(token)), block.timestamp + DELAY);
    }

    function test_claimableAt_zeroWhenNoDeposit() public view {
        assertEq(vault.claimableAt(beneficiary, address(token)), 0);
    }
}
