// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationOracle
 * @notice On-chain safety scoreboard for Sentinel-guarded AI agents. Every agent
 *         accrues a reputation score in [0, 1000] as it operates: clean days
 *         raise it, rule violations and circuit breakers lower it. Anyone can
 *         query a score to decide whether to trust an agent.
 * @dev Only authorized reporters (the SentinelGuard) may record events. Reporter
 *      authorization is owner-managed so a redeployed guard can be re-authorized;
 *      the owner may renounce ownership once wiring is complete. Holds no funds,
 *      so there is no reentrancy surface.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract ReputationOracle is Ownable {
    // ============ Types ============

    /**
     * @notice Lifecycle events that move an agent's score.
     * @dev SlashingEvent is reserved for v2 (stake slashing) and is score-neutral
     *      in v1 — it is still recorded for audit history.
     */
    enum EventType {
        CleanDay,
        RuleViolation,
        CircuitBreaker,
        SuccessfulRecovery,
        SlashingEvent
    }

    /**
     * @notice An agent's current reputation standing.
     * @param score Current score in [0, 1000].
     * @param lastUpdated Unix timestamp of the most recent event.
     * @param eventCount Total events ever recorded for this agent.
     * @param initialized Whether the agent has had at least one event.
     */
    struct Reputation {
        uint16 score;
        uint64 lastUpdated;
        uint32 eventCount;
        bool initialized;
    }

    /**
     * @notice A single entry in an agent's reputation history.
     * @param eventType The lifecycle event that occurred.
     * @param timestamp Unix timestamp of the event.
     * @param delta The effective score change applied (after clamping).
     * @param scoreAfter The agent's score immediately after this event.
     */
    struct RepEvent {
        EventType eventType;
        uint64 timestamp;
        int16 delta;
        uint16 scoreAfter;
    }

    // ============ Constants ============

    /// @notice Score assigned to an agent on its first recorded event.
    uint256 public constant INITIAL_SCORE = 500;

    /// @notice Maximum possible score.
    uint256 public constant MAX_SCORE = 1000;

    /// @notice Minimum possible score.
    uint256 public constant MIN_SCORE = 0;

    // ============ State ============

    /// @dev Per-agent reputation standing. Exposed via getReputation().
    mapping(address agent => Reputation rep) internal _reps;

    /// @dev Per-agent append-only event history. Exposed via getAgentHistory().
    mapping(address agent => RepEvent[] history) internal _history;

    /// @notice Addresses permitted to record events (the SentinelGuard).
    mapping(address reporter => bool authorized) public authorizedReporters;

    // ============ Events ============

    /// @notice Emitted whenever an agent's reputation changes.
    event ReputationChanged(
        address indexed agent,
        int256 delta,
        uint256 newScore,
        EventType reason
    );

    /// @notice Emitted when a reporter's authorization is granted or revoked.
    event ReporterAuthorized(address indexed reporter, bool authorized);

    // ============ Errors ============

    error NotAuthorizedReporter();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyAuthorizedReporter() {
        if (!authorizedReporters[msg.sender]) revert NotAuthorizedReporter();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Deploy the reputation oracle.
     * @param initialOwner Address that manages reporter authorization.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ============ External: reporter management ============

    /**
     * @notice Authorize an address to record reputation events.
     * @param reporter The address to authorize (typically a SentinelGuard).
     */
    function addAuthorizedReporter(address reporter) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        authorizedReporters[reporter] = true;
        emit ReporterAuthorized(reporter, true);
    }

    /**
     * @notice Revoke an address's permission to record reputation events.
     * @param reporter The address to revoke.
     */
    function removeAuthorizedReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = false;
        emit ReporterAuthorized(reporter, false);
    }

    // ============ External: event recording ============

    /**
     * @notice Record a lifecycle event for an agent and update its score.
     * @dev Only an authorized reporter may call. An agent's first event seeds
     *      its score at INITIAL_SCORE before the delta is applied. The resulting
     *      score is clamped to [MIN_SCORE, MAX_SCORE].
     * @param agent The agent the event concerns.
     * @param eventType The lifecycle event that occurred.
     */
    function recordEvent(address agent, EventType eventType)
        external
        onlyAuthorizedReporter
    {
        if (agent == address(0)) revert ZeroAddress();

        Reputation storage rep = _reps[agent];
        uint256 currentScore;
        if (rep.initialized) {
            currentScore = rep.score;
        } else {
            rep.initialized = true;
            currentScore = INITIAL_SCORE;
        }

        int256 raw = int256(currentScore) + _deltaFor(eventType);
        if (raw > int256(MAX_SCORE)) raw = int256(MAX_SCORE);
        if (raw < int256(MIN_SCORE)) raw = int256(MIN_SCORE);

        uint16 newScore = uint16(uint256(raw));
        int256 effectiveDelta = int256(uint256(newScore)) - int256(currentScore);

        rep.score = newScore;
        rep.lastUpdated = uint64(block.timestamp);
        rep.eventCount += 1;

        _history[agent].push(
            RepEvent({
                eventType: eventType,
                timestamp: uint64(block.timestamp),
                delta: int16(effectiveDelta),
                scoreAfter: newScore
            })
        );

        emit ReputationChanged(agent, effectiveDelta, uint256(newScore), eventType);
    }

    // ============ External: views ============

    /**
     * @notice Get an agent's current reputation standing.
     * @dev Agents with no recorded events report the neutral INITIAL_SCORE.
     * @param agent The agent address to query.
     * @return score Current score in [0, 1000].
     * @return lastUpdated Timestamp of the most recent event (0 if none).
     * @return eventCount Total events recorded (0 if none).
     */
    function getReputation(address agent)
        external
        view
        returns (uint256 score, uint256 lastUpdated, uint256 eventCount)
    {
        Reputation storage rep = _reps[agent];
        if (!rep.initialized) {
            return (INITIAL_SCORE, 0, 0);
        }
        return (rep.score, rep.lastUpdated, rep.eventCount);
    }

    /**
     * @notice Get a paginated slice of an agent's reputation history.
     * @param agent The agent address to query.
     * @param offset Index of the first event to return.
     * @param limit Maximum number of events to return.
     * @return page The requested slice of history (may be shorter than limit).
     */
    function getAgentHistory(address agent, uint256 offset, uint256 limit)
        external
        view
        returns (RepEvent[] memory page)
    {
        RepEvent[] storage hist = _history[agent];
        uint256 total = hist.length;
        if (offset >= total) {
            return new RepEvent[](0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        page = new RepEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            page[i] = hist[offset + i];
        }
    }

    /**
     * @notice Get the total number of history events recorded for an agent.
     * @param agent The agent address to query.
     * @return length Number of events in the agent's history.
     */
    function historyLength(address agent) external view returns (uint256 length) {
        return _history[agent].length;
    }

    // ============ Internal ============

    /**
     * @dev Returns the nominal score delta for an event type.
     */
    function _deltaFor(EventType eventType) internal pure returns (int256) {
        if (eventType == EventType.CleanDay) return 1;
        if (eventType == EventType.RuleViolation) return -50;
        if (eventType == EventType.CircuitBreaker) return -200;
        if (eventType == EventType.SuccessfulRecovery) return 10;
        // SlashingEvent — reserved for v2, score-neutral in v1.
        return 0;
    }
}
