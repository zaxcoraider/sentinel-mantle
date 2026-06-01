// Robust getLogs: walks [fromBlock, latest] in bounded chunks and tolerates a
// failed chunk, so a single flaky RPC response doesn't blank the whole query.
// Preserves full viem typing by taking a per-range query callback (T is inferred
// from the caller's getLogs return) — no `any`, no loss of `log.args` typing.

interface BlockClient {
  getBlockNumber: () => Promise<bigint>;
}

export async function collectLogs<T>(
  client: BlockClient,
  fromBlock: bigint,
  query: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  opts?: { chunk?: bigint; toBlock?: bigint },
): Promise<T[]> {
  let latest: bigint;
  try {
    latest = opts?.toBlock ?? (await client.getBlockNumber());
  } catch {
    return [];
  }
  const chunk = opts?.chunk ?? 10_000n;
  const out: T[] = [];
  for (let start = fromBlock; start <= latest; start = start + chunk + 1n) {
    const end = start + chunk > latest ? latest : start + chunk;
    try {
      out.push(...(await query(start, end)));
    } catch {
      /* tolerate a bad chunk and keep going */
    }
  }
  return out;
}
