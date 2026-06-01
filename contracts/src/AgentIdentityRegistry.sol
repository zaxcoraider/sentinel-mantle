// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title AgentIdentityRegistry
 * @notice Permissionless ERC-8004-style identity registry for autonomous agents.
 *         Each token is one agent identity, resolving to the agent's on-chain
 *         operating address and a registration metadata URI.
 * @dev Implements the IERC8004Identity surface (ownerOf via ERC721, plus
 *      getAgent) so AgentRegistry can resolve and authorize agents. Sentinel
 *      deploys this where no canonical ERC-8004 registry exposes a compatible
 *      getAgent(uint256) view.
 * @author Sentinel
 * @custom:security-contact security@sentinel.guard
 */
contract AgentIdentityRegistry is ERC721 {
    struct AgentInfo {
        address agentAddress;
        string registrationURI;
    }

    mapping(uint256 tokenId => AgentInfo info) internal _agents;
    uint256 internal _nextId;

    constructor() ERC721("Sentinel Agent Identity", "AGENT") {}

    /**
     * @notice Mint an agent identity token.
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
