/** 요청이 서버와 같은 컴퓨터(127.0.0.0/8, ::1)에서 왔는지. IPv4를 IPv6 형태로 감싼 주소(::ffff:127.0.0.1)도 같은 컴퓨터다. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const ipv4 = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  return address === '::1' || /^127(\.\d{1,3}){3}$/.test(ipv4);
}
