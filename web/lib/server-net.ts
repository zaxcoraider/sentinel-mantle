// Reads the selected network from the cookie in server components / RSC.
// Using cookies() opts the consuming route into dynamic rendering — intended,
// so each visitor sees data for their chosen network.
import { cookies } from 'next/headers';
import { toNetKey, NET_COOKIE, type NetKey } from './networks';

export function getServerNet(): NetKey {
  return toNetKey(cookies().get(NET_COOKIE)?.value);
}
