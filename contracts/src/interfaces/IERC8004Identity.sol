// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IERC8004Identity
 * @notice Minimal interface to the ERC-8004 Identity Registry curated by Mantle
 *         (github.com/mantlenetworkio/erc-8004-contracts). Sentinel reads agent
 *         identity through this interface and never forks the registry.
 * @dev Only the functions Sentinel needs are declared. The real registry is an
 *      ERC-721 in which each token represents one agent identity.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
interface IERC8004Identity {
    /**
     * @notice Get the current owner of an ERC-8004 identity token.
     * @param tokenId The identity token ID.
     * @return owner The address that currently owns the identity NFT.
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @notice Resolve an identity token to its agent address and registration URI.
     * @param tokenId The identity token ID.
     * @return agentAddress The on-chain address the agent operates from.
     * @return registrationURI Metadata URI describing the agent.
     */
    function getAgent(uint256 tokenId)
        external
        view
        returns (address agentAddress, string memory registrationURI);
}
