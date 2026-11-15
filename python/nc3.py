"""Minimal NetCDF-3 (classic / 64-bit offset) header reader + point reads over HTTP range requests."""
import struct, urllib.request

TYPES = {1: ('b', 1), 2: ('c', 1), 3: ('>h', 2), 4: ('>i', 4), 5: ('>f', 4), 6: ('>d', 8)}
UA = {"User-Agent": "generic-client"}

def fetch(url, a, b):
    req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={a}-{b}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

class Header:
    def __init__(self, buf):
        self.b = buf; self.p = 0
        magic = buf[:3]; ver = buf[3]
        assert magic == b'CDF', magic
        self.off64 = ver == 2; self.p = 4
        self.numrecs = self.u32()
        self.dims = self.read_list(self.dim)
        self.gatts = self.read_atts()
        self.vars = self.read_list(self.var)
        self.recsize = sum(v['vsize'] for v in self.vars if v['rec'])
    def u32(self): v = struct.unpack('>I', self.b[self.p:self.p + 4])[0]; self.p += 4; return v
    def u64(self): v = struct.unpack('>Q', self.b[self.p:self.p + 8])[0]; self.p += 8; return v
    def name(self):
        n = self.u32(); s = self.b[self.p:self.p + n].decode('utf-8', 'replace'); self.p += (n + 3) // 4 * 4; return s
    def read_list(self, fn):
        tag = self.u32(); n = self.u32()
        return [fn() for _ in range(n)]
    def dim(self): return (self.name(), self.u32())
    def read_atts(self):
        tag = self.u32(); n = self.u32(); out = {}
        for _ in range(n):
            nm = self.name(); t = self.u32(); cnt = self.u32(); fmt, sz = TYPES[t]
            raw = self.b[self.p:self.p + cnt * sz]; self.p += (cnt * sz + 3) // 4 * 4
            out[nm] = raw.decode('utf-8', 'replace') if t == 2 else struct.unpack('>' + fmt.strip('>') * cnt, raw) if cnt else ()
        return out
    def var(self):
        nm = self.name(); nd = self.u32(); dimids = [self.u32() for _ in range(nd)]
        atts = self.read_atts(); t = self.u32(); vsize = self.u32(); begin = self.u64() if self.off64 else self.u32()
        dims = [self.dims[i] for i in dimids]
        rec = bool(dims) and dims[0][1] == 0
        return {'name': nm, 'dims': [d[0] for d in dims], 'shape': [d[1] for d in dims], 'atts': atts, 'type': t, 'vsize': vsize, 'begin': begin, 'rec': rec}
    def v(self, name): return next(x for x in self.vars if x['name'] == name)

def read_point(url, H, var, rec, idx):
    """value of a record variable at record `rec` and index tuple `idx` over the non-record dims"""
    v = H.v(var); fmt, sz = TYPES[v['type']]
    shape = v['shape'][1:] if v['rec'] else v['shape']
    off = 0
    for k, i in enumerate(idx):
        stride = 1
        for s in shape[k + 1:]: stride *= s
        off += i * stride
    pos = v['begin'] + (rec * H.recsize if v['rec'] else 0) + off * sz
    return struct.unpack(fmt, fetch(url, pos, pos + sz - 1))[0]

def read_static(url, H, var):
    v = H.v(var); fmt, sz = TYPES[v['type']]; n = 1
    for s in v['shape']: n *= s
    raw = fetch(url, v['begin'], v['begin'] + n * sz - 1)
    return struct.unpack('>' + fmt.strip('>') * n, raw)
