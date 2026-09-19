// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Native TEST AVAX budget. Merchant signatures authorize every spend;
/// any relayer may pay gas. Not a payment contract for real funds or meals.
/// @dev No admin, upgrade, privileged relayer or beneficiary redirection.
contract FoodArenaBudgetFuji {
    error WrongChain();
    error InvalidAddress();
    error InvalidSignature();
    error ExpiredSignature();
    error InvalidNonce();
    error InvalidLimits();
    error InvalidAmount();
    error NotConfigured();
    error InsufficientAvailable();
    error LifetimeLimit();
    error OrderAlreadyExists();
    error InvalidOrder();
    error InvalidExpiry();
    error InvalidCommitment();
    error TransferFailed();
    error ReentrantCall();

    uint256 public constant MAX_PER_ORDER = 0.001 ether;
    uint256 public constant MAX_LIFETIME = 0.1 ether;
    uint256 public constant MAX_HOLD_SECONDS = 1 days;
    uint256 private constant HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("FoodArenaBudgetFuji");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant CONFIG_TYPEHASH = keccak256("Config(address merchant,address beneficiary,uint256 perOrderLimit,uint256 lifetimeLimit,uint256 nonce,uint256 deadline)");
    bytes32 private constant HOLD_TYPEHASH = keccak256("Hold(bytes32 orderId,address merchant,address beneficiary,uint256 amount,uint64 expiresAt,bytes32 termsHash)");
    bytes32 private constant SETTLEMENT_TYPEHASH = keccak256("Settlement(address merchant,bytes32 orderId,bytes32 fulfilmentHash,uint256 deadline)");
    bytes32 private constant WITHDRAW_TYPEHASH = keccak256("Withdraw(address merchant,uint256 amount,uint256 nonce,uint256 deadline)");

    enum OrderState { None, Held, Settled, Released }
    struct Merchant {
        address beneficiary;
        uint256 perOrderLimit;
        uint256 lifetimeLimit;
        uint256 available;
        uint256 reserved;
        uint256 spent;
        uint256 configNonce;
        uint256 withdrawNonce;
    }
    struct Order {
        address merchant;
        address beneficiary;
        uint256 amount;
        uint64 expiresAt;
        bytes32 termsHash;
        bytes32 fulfilmentHash;
        OrderState state;
    }
    struct Config {
        address merchant;
        address beneficiary;
        uint256 perOrderLimit;
        uint256 lifetimeLimit;
        uint256 nonce;
        uint256 deadline;
    }
    struct Hold {
        bytes32 orderId;
        address merchant;
        address beneficiary;
        uint256 amount;
        uint64 expiresAt;
        bytes32 termsHash;
    }
    struct Settlement {
        address merchant;
        bytes32 orderId;
        bytes32 fulfilmentHash;
        uint256 deadline;
    }
    struct Withdraw {
        address merchant;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    mapping(address => Merchant) public merchants;
    mapping(bytes32 => Order) public orders;
    mapping(address => uint256) public credits;
    uint256 public totalAvailable;
    uint256 public totalReserved;
    uint256 public totalCredits;
    uint256 private entered = 1;

    event Configured(address indexed merchant, address beneficiary, uint256 perOrderLimit, uint256 lifetimeLimit, uint256 nonce);
    event Funded(address indexed merchant, address indexed donor, uint256 amount);
    event BudgetHeld(bytes32 indexed orderId, address indexed merchant, address indexed beneficiary, uint256 amount, uint64 expiresAt, bytes32 termsHash);
    event BudgetSettled(bytes32 indexed orderId, address indexed merchant, address indexed beneficiary, uint256 amount, bytes32 fulfilmentHash);
    event BudgetReleased(bytes32 indexed orderId, address indexed merchant, uint256 amount);
    event AvailableWithdrawn(address indexed merchant, uint256 amount);
    event CreditClaimed(address indexed beneficiary, uint256 amount);

    constructor() { _checkChain(); }
    modifier testNetwork() { _checkChain(); _; }
    modifier nonReentrant() {
        if (entered != 1) revert ReentrantCall();
        entered = 2;
        _;
        entered = 1;
    }

    function _checkChain() private view {
        if (block.chainid != 43113 && block.chainid != 31337 && block.chainid != 1337) revert WrongChain();
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /// @dev Strict 65-byte ECDSA, rejecting zero signer, high-s and invalid v.
    function _verify(address signer, bytes32 structHash, bytes calldata signature) private view {
        if (signer == address(0) || signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > HALF_ORDER || (v != 27 && v != 28)) revert InvalidSignature();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
        if (ecrecover(digest, v, r, s) != signer) revert InvalidSignature();
    }

    function _checkDeadline(uint256 deadline) private view {
        if (block.timestamp > deadline) revert ExpiredSignature();
    }

    function configure(Config calldata c, bytes calldata signature) external testNetwork {
        if (c.merchant == address(0) || c.beneficiary == address(0)) revert InvalidAddress();
        _checkDeadline(c.deadline);
        Merchant storage m = merchants[c.merchant];
        if (c.nonce != m.configNonce) revert InvalidNonce();
        if (c.perOrderLimit == 0 || c.perOrderLimit > MAX_PER_ORDER || c.lifetimeLimit > MAX_LIFETIME || c.perOrderLimit > c.lifetimeLimit) revert InvalidLimits();
        if (c.lifetimeLimit < m.reserved + m.spent) revert LifetimeLimit();
        _verify(c.merchant, keccak256(abi.encode(CONFIG_TYPEHASH, c.merchant, c.beneficiary, c.perOrderLimit, c.lifetimeLimit, c.nonce, c.deadline)), signature);
        m.beneficiary = c.beneficiary;
        m.perOrderLimit = c.perOrderLimit;
        m.lifetimeLimit = c.lifetimeLimit;
        m.configNonce++;
        emit Configured(c.merchant, c.beneficiary, c.perOrderLimit, c.lifetimeLimit, c.nonce);
    }

    /// @notice An irrevocable gift to merchant's available budget; donor gains no rights.
    function depositFor(address merchant) external payable testNetwork {
        if (merchant == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert InvalidAmount();
        merchants[merchant].available += msg.value;
        totalAvailable += msg.value;
        emit Funded(merchant, msg.sender, msg.value);
    }

    function hold(Hold calldata h, bytes calldata signature) external testNetwork {
        if (h.orderId == bytes32(0) || h.termsHash == bytes32(0)) revert InvalidCommitment();
        // Merchant-scoped identity prevents another merchant reserving a victim's ID.
        if (h.orderId != keccak256(abi.encode(h.merchant, h.termsHash))) revert InvalidCommitment();
        if (orders[h.orderId].state != OrderState.None) revert OrderAlreadyExists();
        Merchant storage m = merchants[h.merchant];
        if (m.beneficiary == address(0)) revert NotConfigured();
        if (h.beneficiary != m.beneficiary) revert InvalidAddress();
        if (h.amount == 0 || h.amount > m.perOrderLimit) revert InvalidAmount();
        if (h.expiresAt <= block.timestamp || h.expiresAt > block.timestamp + MAX_HOLD_SECONDS) revert InvalidExpiry();
        if (m.available < h.amount) revert InsufficientAvailable();
        if (m.spent + m.reserved + h.amount > m.lifetimeLimit) revert LifetimeLimit();
        _verify(h.merchant, keccak256(abi.encode(HOLD_TYPEHASH, h.orderId, h.merchant, h.beneficiary, h.amount, h.expiresAt, h.termsHash)), signature);
        m.available -= h.amount;
        m.reserved += h.amount;
        totalAvailable -= h.amount;
        totalReserved += h.amount;
        orders[h.orderId] = Order(h.merchant, m.beneficiary, h.amount, h.expiresAt, h.termsHash, bytes32(0), OrderState.Held);
        emit BudgetHeld(h.orderId, h.merchant, m.beneficiary, h.amount, h.expiresAt, h.termsHash);
    }

    function settle(Settlement calldata p, bytes calldata signature) external testNetwork {
        _checkDeadline(p.deadline);
        Order storage o = orders[p.orderId];
        if (o.state != OrderState.Held || o.merchant != p.merchant) revert InvalidOrder();
        if (block.timestamp >= o.expiresAt) revert InvalidExpiry();
        if (p.fulfilmentHash == bytes32(0)) revert InvalidCommitment();
        _verify(p.merchant, keccak256(abi.encode(SETTLEMENT_TYPEHASH, p.merchant, p.orderId, p.fulfilmentHash, p.deadline)), signature);
        o.state = OrderState.Settled;
        o.fulfilmentHash = p.fulfilmentHash;
        Merchant storage m = merchants[p.merchant];
        m.reserved -= o.amount;
        m.spent += o.amount;
        totalReserved -= o.amount;
        totalCredits += o.amount;
        credits[o.beneficiary] += o.amount;
        emit BudgetSettled(p.orderId, p.merchant, o.beneficiary, o.amount, p.fulfilmentHash);
    }

    function releaseExpired(bytes32 orderId) external testNetwork {
        Order storage o = orders[orderId];
        if (o.state != OrderState.Held) revert InvalidOrder();
        if (block.timestamp < o.expiresAt) revert InvalidExpiry();
        o.state = OrderState.Released;
        Merchant storage m = merchants[o.merchant];
        m.reserved -= o.amount;
        m.available += o.amount;
        totalReserved -= o.amount;
        totalAvailable += o.amount;
        emit BudgetReleased(orderId, o.merchant, o.amount);
    }

    function withdrawAvailable(uint256 amount) external testNetwork nonReentrant {
        _withdraw(msg.sender, amount);
    }

    function withdrawAvailable(Withdraw calldata w, bytes calldata signature) external testNetwork nonReentrant {
        _checkDeadline(w.deadline);
        Merchant storage m = merchants[w.merchant];
        if (w.nonce != m.withdrawNonce) revert InvalidNonce();
        _verify(w.merchant, keccak256(abi.encode(WITHDRAW_TYPEHASH, w.merchant, w.amount, w.nonce, w.deadline)), signature);
        m.withdrawNonce++;
        _withdraw(w.merchant, w.amount);
    }

    function _withdraw(address merchant, uint256 amount) private {
        Merchant storage m = merchants[merchant];
        if (amount == 0) revert InvalidAmount();
        if (amount > m.available) revert InsufficientAvailable();
        m.available -= amount;
        totalAvailable -= amount;
        (bool sent,) = payable(merchant).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit AvailableWithdrawn(merchant, amount);
    }

    function claim() external testNetwork nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert InvalidAmount();
        credits[msg.sender] = 0;
        totalCredits -= amount;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit CreditClaimed(msg.sender, amount);
    }
}
