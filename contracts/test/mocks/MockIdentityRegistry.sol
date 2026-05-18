// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title MockIdentityRegistry
 * @notice Minimal ERC-8004 Identity Registry stand-in for tests and testnet.
 * @dev Implements the IERC8004Identity surface on top of OpenZeppelin ERC721.
 *      Not for mainnet — the real registry is curated by Mantle.
 */
contract MockIdentityRegistry is ERC721 {
    struct AgentInfo {
        address agentAddress;
        string registrationURI;
    }

    mapping(uint256 tokenId => AgentInfo info) internal _agents;
    uint256 internal _nextId;

    constructor() ERC721("Mock ERC-8004 Identity", "AGENT") {}

    /**
     * @notice Mint a mock identity token.
     * @param to The owner of the identity NFT.
     * @param agentAddress The agent address this identity resolves to.
     * @param registrationURI Metadata URI for the agent.
     * @return tokenId The newly minted token ID.
     */
    function mint(address to, address agentAddress, string memory registrationURI)
        external
        returns (uint256 tokenId)
    {
        tokenId = _nextId++;
        _mint(to, tokenId);
        _agents[tokenId] = AgentInfo({
            agentAddress: agentAddress,
            registrationURI: registrationURI
        });
    }

    /// @notice Resolve a token to its agent address and registration URI.
    function getAgent(uint256 tokenId)
        external
        view
        returns (address agentAddress, string memory registrationURI)
    {
        AgentInfo memory info = _agents[tokenId];
        return (info.agentAddress, info.registrationURI);
    }
}
