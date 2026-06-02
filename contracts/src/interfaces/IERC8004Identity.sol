// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IERC8004Identity
 * @notice The identity surface Sentinel reads to resolve and authorize agents.
 *         Each token is one agent identity (ERC-721). Sentinel ships its own
 *         ERC-8004-style registry (AgentIdentityRegistry) implementing this
 *         surface, because the canonical Mantle ERC-8004 registry
 *         (github.com/mantlenetworkio/erc-8004-contracts) does not expose a
 *         compatible getAgent(uint256) view.
 * @dev This is NOT the EIP-8004 standard interface. `ownerOf` is standard
 *      ERC-721; `getAgent` is a Sentinel convenience view (agent address +
 *      registration URI), not part of EIP-8004. Sentinel is ERC-8004-inspired,
 *      not ERC-8004-compliant.
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
