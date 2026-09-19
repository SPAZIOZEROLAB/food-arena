// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Fuji-only record of a wallet's pickup attestations. Not proof of
/// physical delivery, a payment system, or verification of a business identity.
/// @dev Only salted commitments. Never submit personal data or pickup secrets.
contract PickupRegistryFuji {
    error WrongChain();
    error EmptyCommitment();
    error AlreadyRegistered();
    uint256 public constant FUJI_CHAIN_ID = 43113;
    mapping(address merchant => mapping(bytes32 requestCommitment => bytes32 receiptCommitment)) public receipts;
    event PickupRegistered(address indexed merchant, bytes32 indexed requestCommitment, bytes32 receiptCommitment);

    constructor() {
        if (block.chainid != FUJI_CHAIN_ID) revert WrongChain();
    }

    /// @notice Attest under msg.sender. This authenticates a wallet, not a business.
    /// @param requestCommitment Salted hash of the opaque request reference.
    /// @param receiptCommitment SHA-256 commitment to the app's accepted receipt.
    function register(bytes32 requestCommitment, bytes32 receiptCommitment) external {
        if (block.chainid != FUJI_CHAIN_ID) revert WrongChain();
        if (requestCommitment == bytes32(0) || receiptCommitment == bytes32(0)) revert EmptyCommitment();
        if (receipts[msg.sender][requestCommitment] != bytes32(0)) revert AlreadyRegistered();
        receipts[msg.sender][requestCommitment] = receiptCommitment;
        emit PickupRegistered(msg.sender, requestCommitment, receiptCommitment);
    }
}
