'use client';

import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { parseAbiItem } from 'viem';
import { DEPLOYMENTS, MockIdentityRegistryAbi } from '@/lib/contracts';
import { useOnboardStore } from '@/lib/store/onboard-store';
import { friendlyError } from '@/lib/errors';
import { AddressLink } from '@/components/AddressLink';

interface AgentToken {
  tokenId: bigint;
  agentAddress: Address;
  registrationURI: string;
}

export function Step2Agent() {
  const { address } = useAccount();
  const client = usePublicClient();
  const store = useOnboardStore();

  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mintError, setMintError] = useState('');
  const [agentInput, setAgentInput] = useState('');
  const [uriInput, setUriInput] = useState('');

  const { writeContract: mint, data: mintHash, isPending: minting } = useWriteContract();
  const { isSuccess: mintDone } = useWaitForTransactionReceipt({ hash: mintHash });

  useEffect(() => {
    if (!address || !client) return;
    setLoading(true);
    setError('');

    const REGISTRY = DEPLOYMENTS.sepolia.MockIdentityRegistry;
    const EVT_TRANSFER = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    );

    client
      .getLogs({ address: REGISTRY, event: EVT_TRANSFER, args: { to: address }, fromBlock: BigInt(0) })
      .then(async (logs) => {
        const candidates = logs.map((l) => l.args.tokenId as bigint);
        const settled = await Promise.allSettled(
          candidates.map(async (tokenId) => {
            const owner = await client.readContract({
              address: REGISTRY,
              abi: MockIdentityRegistryAbi,
              functionName: 'ownerOf',
              args: [tokenId],
            });
            if ((owner as string).toLowerCase() !== address.toLowerCase()) return null;
            const [agentAddress, registrationURI] = (await client.readContract({
              address: REGISTRY,
              abi: MockIdentityRegistryAbi,
              functionName: 'getAgent',
              args: [tokenId],
            })) as [Address, string];
            return { tokenId, agentAddress, registrationURI } satisfies AgentToken;
          }),
        );
        const owned = settled
          .filter((r) => r.status === 'fulfilled' && r.value !== null)
          .map((r) => (r as PromiseFulfilledResult<AgentToken>).value);
        setTokens(owned);
      })
      .catch(() => setError('Failed to load identities.'))
      .finally(() => setLoading(false));
  }, [address, client, mintDone]);

  const handleSelect = (t: AgentToken) => {
    store.setAgent(t.tokenId, t.agentAddress, t.registrationURI);
    store.setStep(3);
  };

  const handleMint = () => {
    if (!address) return;
    const trimmed = agentInput.trim() as Address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setMintError('Enter a valid 0x address for the agent.');
      return;
    }
    setMintError('');
    mint(
      {
        address: DEPLOYMENTS.sepolia.MockIdentityRegistry,
        abi: MockIdentityRegistryAbi,
        functionName: 'mint',
        args: [address, trimmed, uriInput || 'ipfs://mock'],
      },
      { onError: (e) => setMintError(friendlyError(e)) },
    );
  };

  return (
    <div className="space-y-6 py-4">
      <div>
        <h2 className="font-mono font-bold text-lg text-sentinel-white">
          Select your ERC-8004 agent
        </h2>
        <p className="mt-1 text-sm text-sentinel-gray-1">
          Choose the identity NFT you want to wrap under Sentinel.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 bg-sentinel-gray-2 animate-pulse rounded" />
          ))}
        </div>
      ) : error ? (
        <p className="font-mono text-xs text-sentinel-danger">{error}</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-sentinel-gray-1">
          No ERC-8004 identities found for this address.
        </p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li key={t.tokenId.toString()}>
              <button
                onClick={() => handleSelect(t)}
                className="w-full text-left border border-sentinel-gray-2 hover:border-sentinel-blue p-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-sentinel-gray-1">
                      Token #{t.tokenId.toString()}
                    </p>
                    <p className="font-mono text-sm text-sentinel-white mt-0.5">
                      Agent: <AddressLink address={t.agentAddress} className="text-sentinel-white" />
                    </p>
                  </div>
                  <span className="font-mono text-xs text-sentinel-blue">Select →</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Mint a test identity on Sepolia */}
      <details className="border border-sentinel-gray-2 p-4">
        <summary className="font-mono text-xs text-sentinel-gray-1 cursor-pointer">
          + Mint a testnet identity
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="font-mono text-xs text-sentinel-gray-1 block mb-1">
              Agent address (the smart contract your AI agent uses)
            </label>
            <input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              placeholder="0x…"
              className="w-full font-mono text-xs bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-3 py-2 outline-none text-sentinel-white"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-sentinel-gray-1 block mb-1">
              Metadata URI (optional)
            </label>
            <input
              value={uriInput}
              onChange={(e) => setUriInput(e.target.value)}
              placeholder="ipfs://…"
              className="w-full font-mono text-xs bg-sentinel-gray-2 border border-sentinel-gray-2 focus:border-sentinel-blue px-3 py-2 outline-none text-sentinel-white"
            />
          </div>
          {mintError && <p className="font-mono text-xs text-sentinel-danger">{mintError}</p>}
          <button
            onClick={handleMint}
            disabled={minting}
            className="font-mono text-xs px-4 py-2 border border-sentinel-blue text-sentinel-blue hover:bg-sentinel-blue hover:text-white transition-colors disabled:opacity-50"
          >
            {minting ? 'Minting…' : 'Mint identity'}
          </button>
          {mintDone && (
            <p className="font-mono text-xs text-emerald-400">Minted. Refreshing identities…</p>
          )}
        </div>
      </details>
    </div>
  );
}
