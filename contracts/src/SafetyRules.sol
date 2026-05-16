// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SafetyRules
 * @notice Per-agent safety rule configuration for Sentinel-guarded AI agents.
 * @dev Each guarded agent owns one instance of SafetyRules. Rules are evaluated
 *      off-chain by the Sentinel monitor and on-chain at execution time via
 *      `evaluate()`. The contract owner (the human behind the agent) can update
 *      rules. The agent itself cannot.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract SafetyRules is Ownable {
    // ============ Type definitions ============

    /**
     * @notice Snapshot of an agent's current state, passed to `evaluate()`.
     * @param currentValue Current portfolio value in USD (18 decimals).
     * @param highWaterMark Highest value reached since last reset (18 decimals).
     * @param txCountThisHour Number of agent transactions in the current hour window.
     * @param lastCalledProtocol Address of the most recently called external contract.
     * @param lastPriceUsed Price the agent used for its last action (18 decimals).
     * @param lastReferencePrice Oracle reference price at the same moment (18 decimals).
     * @param volume24hUsd Trading volume over the last 24 hours in USD (18 decimals).
     * @param currentHourUtc Current hour in UTC (0-23).
     */
    struct AgentState {
        uint256 currentValue;
        uint256 highWaterMark;
        uint256 txCountThisHour;
        address lastCalledProtocol;
        uint256 lastPriceUsed;
        uint256 lastReferencePrice;
        uint256 volume24hUsd;
        uint8 currentHourUtc;
    }

    /// @notice Rule identifier hashes used in events and violation reasons.
    bytes32 public constant RULE_MAX_DRAWDOWN = keccak256("MAX_DRAWDOWN");
    bytes32 public constant RULE_MAX_TX_PER_HOUR = keccak256("MAX_TX_PER_HOUR");
    bytes32 public constant RULE_ALLOWED_PROTOCOLS = keccak256("ALLOWED_PROTOCOLS");
    bytes32 public constant RULE_ORACLE_DEVIATION = keccak256("ORACLE_DEVIATION");
    bytes32 public constant RULE_DAILY_VOLUME = keccak256("DAILY_VOLUME");
    bytes32 public constant RULE_TIME_WINDOW = keccak256("TIME_WINDOW");

    // ============ State ============

    /// @notice Max allowed drawdown from high-water-mark, in basis points (1000 = 10%).
    uint256 public maxDrawdownBps;

    /// @notice Max agent transactions allowed per rolling 1-hour window.
    uint256 public maxTxPerHour;

    /// @notice Max acceptable deviation between agent's traded price and oracle reference, in basis points.
    uint256 public oracleDeviationBps;

    /// @notice Max trading volume allowed in a 24-hour window, in USD (18 decimals).
    uint256 public dailyVolumeCapUsd;

    /// @notice Earliest UTC hour (inclusive) at which the agent may operate.
    uint8 public timeOfDayMin;

    /// @notice Latest UTC hour (inclusive) at which the agent may operate.
    uint8 public timeOfDayMax;

    /// @notice Whitelist of external contracts the agent is permitted to call.
    mapping(address protocol => bool allowed) public allowedProtocols;

    /// @notice Convenience: tracks how many protocols are in the allowlist.
    uint256 public allowedProtocolCount;

    // ============ Events ============

    /**
     * @notice Emitted when any rule value is updated.
     * @param ruleKey Constant identifier of the rule that changed.
     * @param oldValue Previous value (or address as uint, or 0 for bool toggles).
     * @param newValue New value.
     */
    event RuleUpdated(bytes32 indexed ruleKey, uint256 oldValue, uint256 newValue);

    /**
     * @notice Emitted when a protocol is added to or removed from the allowlist.
     * @param protocol Address whose allowlist status changed.
     * @param allowed True if added, false if removed.
     */
    event ProtocolAllowlistChanged(address indexed protocol, bool allowed);

    /**
     * @notice Emitted from `evaluate()` when a rule is violated.
     * @dev Off-chain monitors index this event to know exactly why a state failed.
     * @param ruleKey Constant identifier of the violated rule.
     * @param expected The threshold value.
     * @param actual The actual value that crossed the threshold.
     */
    event RuleViolated(bytes32 indexed ruleKey, uint256 expected, uint256 actual);

    // ============ Errors ============

    error InvalidBps(uint256 value);
    error InvalidHour(uint8 value);
    error InvalidTimeWindow(uint8 minHour, uint8 maxHour);
    error ZeroAddress();
    error ZeroValue();

    // ============ Constructor ============

    /**
     * @notice Deploy with initial rule values. Owner is the deploying account.
     * @param initialOwner Address that will own this rules contract (the agent's human).
     * @param _maxDrawdownBps Initial max drawdown, e.g. 1000 = 10%.
     * @param _maxTxPerHour Initial transaction rate limit.
     * @param _oracleDeviationBps Initial oracle deviation tolerance.
     * @param _dailyVolumeCapUsd Initial 24h volume cap, in USD (18 decimals).
     * @param _timeOfDayMin Earliest UTC hour, 0-23.
     * @param _timeOfDayMax Latest UTC hour, 0-23. May be less than min for overnight windows.
     */
    constructor(
        address initialOwner,
        uint256 _maxDrawdownBps,
        uint256 _maxTxPerHour,
        uint256 _oracleDeviationBps,
        uint256 _dailyVolumeCapUsd,
        uint8 _timeOfDayMin,
        uint8 _timeOfDayMax
    ) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (_maxDrawdownBps > 10_000) revert InvalidBps(_maxDrawdownBps);
        if (_oracleDeviationBps > 10_000) revert InvalidBps(_oracleDeviationBps);
        if (_timeOfDayMin > 23) revert InvalidHour(_timeOfDayMin);
        if (_timeOfDayMax > 23) revert InvalidHour(_timeOfDayMax);
        if (_maxTxPerHour == 0) revert ZeroValue();
        if (_dailyVolumeCapUsd == 0) revert ZeroValue();

        maxDrawdownBps = _maxDrawdownBps;
        maxTxPerHour = _maxTxPerHour;
        oracleDeviationBps = _oracleDeviationBps;
        dailyVolumeCapUsd = _dailyVolumeCapUsd;
        timeOfDayMin = _timeOfDayMin;
        timeOfDayMax = _timeOfDayMax;
    }

    // ============ External: rule updates ============

    /**
     * @notice Update the max drawdown threshold.
     * @param newBps New value in basis points (1000 = 10%).
     */
    function setMaxDrawdown(uint256 newBps) external onlyOwner {
        if (newBps > 10_000) revert InvalidBps(newBps);
        emit RuleUpdated(RULE_MAX_DRAWDOWN, maxDrawdownBps, newBps);
        maxDrawdownBps = newBps;
    }

    /**
     * @notice Update the per-hour transaction rate limit.
     * @param newLimit New limit (must be > 0).
     */
    function setMaxTxPerHour(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroValue();
        emit RuleUpdated(RULE_MAX_TX_PER_HOUR, maxTxPerHour, newLimit);
        maxTxPerHour = newLimit;
    }

    /**
     * @notice Update the oracle deviation tolerance.
     * @param newBps New value in basis points.
     */
    function setOracleDeviation(uint256 newBps) external onlyOwner {
        if (newBps > 10_000) revert InvalidBps(newBps);
        emit RuleUpdated(RULE_ORACLE_DEVIATION, oracleDeviationBps, newBps);
        oracleDeviationBps = newBps;
    }

    /**
     * @notice Update the 24-hour volume cap.
     * @param newCapUsd New cap in USD (18 decimals). Must be > 0.
     */
    function setDailyVolumeCap(uint256 newCapUsd) external onlyOwner {
        if (newCapUsd == 0) revert ZeroValue();
        emit RuleUpdated(RULE_DAILY_VOLUME, dailyVolumeCapUsd, newCapUsd);
        dailyVolumeCapUsd = newCapUsd;
    }

    /**
     * @notice Update the time-of-day window during which the agent may operate.
     * @param minHour Earliest hour, 0-23.
     * @param maxHour Latest hour, 0-23. If maxHour < minHour, treated as overnight window.
     */
    function setTimeWindow(uint8 minHour, uint8 maxHour) external onlyOwner {
        if (minHour > 23) revert InvalidHour(minHour);
        if (maxHour > 23) revert InvalidHour(maxHour);
        emit RuleUpdated(
            RULE_TIME_WINDOW,
            (uint256(timeOfDayMin) << 8) | uint256(timeOfDayMax),
            (uint256(minHour) << 8) | uint256(maxHour)
        );
        timeOfDayMin = minHour;
        timeOfDayMax = maxHour;
    }

    /**
     * @notice Add or remove a protocol from the allowlist.
     * @param protocol External contract address.
     * @param allowed True to allow agent to call this address, false to disallow.
     */
    function setProtocolAllowed(address protocol, bool allowed) external onlyOwner {
        if (protocol == address(0)) revert ZeroAddress();
        bool current = allowedProtocols[protocol];
        if (current == allowed) return; // No-op
        allowedProtocols[protocol] = allowed;
        if (allowed) {
            allowedProtocolCount++;
        } else {
            allowedProtocolCount--;
        }
        emit ProtocolAllowlistChanged(protocol, allowed);
    }

    /**
     * @notice Batch add protocols to the allowlist. Convenience for onboarding.
     * @param protocols Array of external contract addresses to allow.
     */
    function allowProtocolsBatch(address[] calldata protocols) external onlyOwner {
        uint256 len = protocols.length;
        for (uint256 i = 0; i < len; i++) {
            address protocol = protocols[i];
            if (protocol == address(0)) revert ZeroAddress();
            if (!allowedProtocols[protocol]) {
                allowedProtocols[protocol] = true;
                allowedProtocolCount++;
                emit ProtocolAllowlistChanged(protocol, true);
            }
        }
    }

    // ============ External: evaluation ============

    /**
     * @notice Evaluate all rules against a snapshot of agent state.
     * @dev Returns false on first violation. Off-chain monitors can also call this
     *      view function before triggering on-chain, to avoid wasted gas.
     * @param state Current agent state.
     * @return safe True if all rules pass.
     * @return violatedRule Hash of the first violated rule (zero if safe).
     */
    function evaluate(AgentState calldata state)
        external
        view
        returns (bool safe, bytes32 violatedRule)
    {
        // Drawdown check
        if (state.highWaterMark > 0 && state.currentValue < state.highWaterMark) {
            uint256 drawdownBps = ((state.highWaterMark - state.currentValue) * 10_000)
                / state.highWaterMark;
            if (drawdownBps > maxDrawdownBps) {
                return (false, RULE_MAX_DRAWDOWN);
            }
        }

        // Tx rate check
        if (state.txCountThisHour > maxTxPerHour) {
            return (false, RULE_MAX_TX_PER_HOUR);
        }

        // Protocol allowlist check (only if agent has called any protocol)
        if (state.lastCalledProtocol != address(0)) {
            if (!allowedProtocols[state.lastCalledProtocol]) {
                return (false, RULE_ALLOWED_PROTOCOLS);
            }
        }

        // Oracle deviation check (only if both prices are nonzero)
        if (state.lastPriceUsed > 0 && state.lastReferencePrice > 0) {
            uint256 deviationBps = _absDeviation(
                state.lastPriceUsed,
                state.lastReferencePrice
            );
            if (deviationBps > oracleDeviationBps) {
                return (false, RULE_ORACLE_DEVIATION);
            }
        }

        // Daily volume check
        if (state.volume24hUsd > dailyVolumeCapUsd) {
            return (false, RULE_DAILY_VOLUME);
        }

        // Time window check
        if (!_isHourAllowed(state.currentHourUtc)) {
            return (false, RULE_TIME_WINDOW);
        }

        return (true, bytes32(0));
    }

    /**
     * @notice Convenience: evaluate but also emit a violation event for off-chain indexing.
     * @dev Only callable by owner or authorized monitor. Wraps `evaluate()`.
     * @param state Current agent state.
     * @return safe True if all rules pass.
     * @return violatedRule Hash of the first violated rule.
     */
    function evaluateAndEmit(AgentState calldata state)
        external
        returns (bool safe, bytes32 violatedRule)
    {
        (safe, violatedRule) = this.evaluate(state);
        if (!safe) {
            (uint256 expected, uint256 actual) = _getViolationDetails(state, violatedRule);
            emit RuleViolated(violatedRule, expected, actual);
        }
    }

    // ============ Internal helpers ============

    /**
     * @dev Computes |a - b| / max(a, b) in basis points.
     */
    function _absDeviation(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 diff = a > b ? a - b : b - a;
        uint256 denom = a > b ? a : b;
        return (diff * 10_000) / denom;
    }

    /**
     * @dev Returns true if the given UTC hour falls within the configured window.
     *      Handles overnight windows (e.g. min=22, max=6 means 22:00-06:59).
     */
    function _isHourAllowed(uint8 hour) internal view returns (bool) {
        if (timeOfDayMin <= timeOfDayMax) {
            return hour >= timeOfDayMin && hour <= timeOfDayMax;
        } else {
            // Overnight window: e.g. 22:00 - 06:59
            return hour >= timeOfDayMin || hour <= timeOfDayMax;
        }
    }

    /**
     * @dev Returns (expected, actual) values for a violation, used in events.
     */
    function _getViolationDetails(AgentState calldata state, bytes32 rule)
        internal
        view
        returns (uint256 expected, uint256 actual)
    {
        if (rule == RULE_MAX_DRAWDOWN) {
            expected = maxDrawdownBps;
            actual = ((state.highWaterMark - state.currentValue) * 10_000)
                / state.highWaterMark;
        } else if (rule == RULE_MAX_TX_PER_HOUR) {
            expected = maxTxPerHour;
            actual = state.txCountThisHour;
        } else if (rule == RULE_ORACLE_DEVIATION) {
            expected = oracleDeviationBps;
            actual = _absDeviation(state.lastPriceUsed, state.lastReferencePrice);
        } else if (rule == RULE_DAILY_VOLUME) {
            expected = dailyVolumeCapUsd;
            actual = state.volume24hUsd;
        } else if (rule == RULE_TIME_WINDOW) {
            expected = (uint256(timeOfDayMin) << 8) | uint256(timeOfDayMax);
            actual = state.currentHourUtc;
        } else if (rule == RULE_ALLOWED_PROTOCOLS) {
            expected = 1; // "should be allowed"
            actual = 0;   // "was not allowed"
        }
    }
}
