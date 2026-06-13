// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @notice HCOINX on-chain weather prediction staking market.
 *         Users stake HCX tokens YES or NO on weather events.
 *         Owner (Gnosis Safe) resolves markets and distributes rewards.
 */
contract PredictionMarket is Ownable, ReentrancyGuard {

    IERC20 public immutable hcx;

    enum Side     { YES, NO }
    enum Status   { Open, Resolved, Cancelled }

    struct Market {
        uint256 id;
        string  eventType;
        string  location;
        string  timeframe;
        uint8   confidence;     // 0–100 from AI model
        uint256 totalYes;
        uint256 totalNo;
        uint256 deadline;
        Status  status;
        Side    outcome;
    }

    struct Position {
        uint256 marketId;
        Side    side;
        uint256 amount;
        bool    claimed;
    }

    uint256 public marketCount;
    uint256 public constant FEE_BPS = 200; // 2% protocol fee

    mapping(uint256 => Market)                          public markets;
    mapping(address => mapping(uint256 => Position))    public positions;
    mapping(uint256 => address[])                       private marketStakers;

    event MarketCreated(uint256 indexed id, string eventType, string location, uint8 confidence);
    event Staked(uint256 indexed marketId, address indexed user, Side side, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Side outcome);
    event RewardClaimed(uint256 indexed marketId, address indexed user, uint256 reward);
    event MarketCancelled(uint256 indexed marketId);

    constructor(address _hcx) Ownable(msg.sender) {
        hcx = IERC20(_hcx);
    }

    // ── Owner: Create market ────────────────────────────────────
    function createMarket(
        string calldata eventType,
        string calldata location,
        string calldata timeframe,
        uint8  confidence,
        uint256 durationSeconds
    ) external onlyOwner returns (uint256 id) {
        id = ++marketCount;
        markets[id] = Market({
            id:         id,
            eventType:  eventType,
            location:   location,
            timeframe:  timeframe,
            confidence: confidence,
            totalYes:   0,
            totalNo:    0,
            deadline:   block.timestamp + durationSeconds,
            status:     Status.Open,
            outcome:    Side.YES  // default, overwritten on resolve
        });
        emit MarketCreated(id, eventType, location, confidence);
    }

    // ── Stake ───────────────────────────────────────────────────
    function stake(uint256 marketId, Side side, uint256 amount) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.id != 0,                      "Market not found");
        require(m.status == Status.Open,        "Market not open");
        require(block.timestamp < m.deadline,   "Market deadline passed");
        require(amount > 0,                     "Amount must be > 0");

        hcx.transferFrom(msg.sender, address(this), amount);

        Position storage pos = positions[msg.sender][marketId];
        if (pos.amount == 0) marketStakers[marketId].push(msg.sender);

        // If user already has a position on the same side, add to it
        require(pos.amount == 0 || pos.side == side, "Cannot stake both sides");
        pos.marketId = marketId;
        pos.side     = side;
        pos.amount  += amount;
        pos.claimed  = false;

        if (side == Side.YES) m.totalYes += amount;
        else                  m.totalNo  += amount;

        emit Staked(marketId, msg.sender, side, amount);
    }

    // ── Owner: Resolve ──────────────────────────────────────────
    function resolveMarket(uint256 marketId, Side outcome) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == Status.Open, "Market not open");
        m.status  = Status.Resolved;
        m.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }

    // ── Claim reward ─────────────────────────────────────────────
    function claimReward(uint256 marketId) external nonReentrant {
        Market storage m   = markets[marketId];
        Position storage p = positions[msg.sender][marketId];

        require(m.status == Status.Resolved, "Market not resolved");
        require(p.amount > 0,                "No position");
        require(!p.claimed,                  "Already claimed");
        require(p.side == m.outcome,         "Wrong side");

        uint256 winPool  = m.outcome == Side.YES ? m.totalYes : m.totalNo;
        uint256 losePool = m.outcome == Side.YES ? m.totalNo  : m.totalYes;
        uint256 gross    = p.amount + (p.amount * losePool / winPool);
        uint256 fee      = gross * FEE_BPS / 10000;
        uint256 payout   = gross - fee;

        p.claimed = true;
        hcx.transfer(msg.sender, payout);
        emit RewardClaimed(marketId, msg.sender, payout);
    }

    // ── Owner: Cancel (refunds everyone) ────────────────────────
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == Status.Open, "Not open");
        m.status = Status.Cancelled;

        address[] storage stakers = marketStakers[marketId];
        for (uint i = 0; i < stakers.length; i++) {
            Position storage p = positions[stakers[i]][marketId];
            if (p.amount > 0 && !p.claimed) {
                p.claimed = true;
                hcx.transfer(stakers[i], p.amount);
            }
        }
        emit MarketCancelled(marketId);
    }

    // ── Views ────────────────────────────────────────────────────
    function getMarket(uint256 id) external view returns (Market memory) {
        return markets[id];
    }

    function getPosition(address user, uint256 marketId) external view returns (Position memory) {
        return positions[user][marketId];
    }

    function getStakers(uint256 marketId) external view returns (address[] memory) {
        return marketStakers[marketId];
    }
}
