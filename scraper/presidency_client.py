"""Session helper that clears presidency.ro's anti-bot JS challenge.

presidency.ro guards pages with a "Verifying your browser" interstitial: a
small proof-of-work where the browser must find an integer i such that
SHA1(token + i) has bytes 0xB0, 0x0B at offset int(token[0], 16), then present
it back as the cookie `res=<token><i>`. We reproduce that in Python — no
headless browser needed — so a scraper can fetch decree pages server-side.

    from presidency_client import get_session
    s = get_session()
    html = s.get("https://www.presidency.ro/ro/...").text

Note (2026-07-05): the challenge is cracked and pages return 200, but the
decree LIST layout still needs mapping (content appears to load via a separate
feed) before a promulgation scraper can use it. See project memory.
"""
from __future__ import annotations

import hashlib
import re

import requests

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
_PROBE = "https://www.presidency.ro/ro/presedinte/decrete-si-acte-oficiale"
_MAX_POW = 5_000_000  # the real answer is tiny (~1e4); this is just a guard


def _solve(html: str) -> str | None:
    m = re.search(r"'([0-9A-F]{40})'", html)
    if not m:
        return None
    token = m.group(1)
    offset = int(token[0], 16)
    for i in range(_MAX_POW):
        d = hashlib.sha1(f"{token}{i}".encode()).digest()
        if d[offset] == 0xB0 and d[offset + 1] == 0x0B:
            return f"res={token}{i}"
    return None


def get_session(probe_url: str = _PROBE, timeout: int = 25) -> requests.Session:
    """Return a requests.Session that has already cleared the JS challenge."""
    s = requests.Session()
    s.headers.update({"User-Agent": _UA, "Accept-Language": "ro-RO,ro;q=0.9"})
    r = s.get(probe_url, timeout=timeout)
    if "Verifying your browser" in r.text:
        cookie = _solve(r.text)
        if not cookie:
            raise RuntimeError("presidency.ro challenge changed — solver needs an update")
        name, value = cookie.split("=", 1)
        s.cookies.set(name, value, domain="www.presidency.ro", path="/")
    return s


if __name__ == "__main__":
    sess = get_session()
    resp = sess.get(_PROBE, timeout=25)
    ok = "Verifying your browser" not in resp.text
    print(f"challenge cleared: {ok} | status={resp.status_code} | {len(resp.text)}B")
