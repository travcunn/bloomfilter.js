class BloomFilter {
  // If *m* is an array-like object, with a length
  // property, then the bloom filter is loaded with data from the array, where
  // each element is a 32-bit integer.  Otherwise, *m* should specify the
  // number of bits.  Note that *m* is rounded up to the nearest multiple of
  // 32.  *k* specifies the number of hashing functions.
  constructor(m, k) {
    let a;
    if (typeof m !== "number") (a = m), (m = a.length * 32);

    let n = Math.ceil(m / 32),
      i = -1;
    this.m = m = n * 32;
    this.k = k;

    let typedArrays = typeof ArrayBuffer !== "undefined";

    if (typedArrays) {
      let kbytes =
          1 <<
          Math.ceil(Math.log(Math.ceil(Math.log(m) / Math.LN2 / 8)) / Math.LN2),
        array =
          kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array,
        kbuffer = new ArrayBuffer(kbytes * k),
        buckets = (this.buckets = new Int32Array(n));
      if (a) while (++i < n) buckets[i] = a[i];
      this._locations = new array(kbuffer);
    } else {
      let buckets = (this.buckets = []);
      if (a) while (++i < n) buckets[i] = a[i];
      else while (++i < n) buckets[i] = 0;
      this._locations = [];
    }
  }

  // See http://willwhim.wpengine.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  locations(v) {
    let k = this.k,
      m = this.m,
      r = this._locations,
      a = fnv_1a(v),
      b = fnv_1a(v, 1576284489), // The seed value is chosen randomly
      x = a % m;
    for (let i = 0; i < k; ++i) {
      r[i] = x < 0 ? x + m : x;
      x = (x + b) % m;
    }
    return r;
  }

  add(v) {
    let l = this.locations(v + ""),
      k = this.k,
      buckets = this.buckets;
    for (let i = 0; i < k; ++i)
      buckets[Math.floor(l[i] / 32)] |= 1 << (l[i] % 32);
  }

  test(v) {
    let l = this.locations(v + ""),
      k = this.k,
      buckets = this.buckets;
    for (let i = 0; i < k; ++i) {
      let b = l[i];
      if ((buckets[Math.floor(b / 32)] & (1 << (b % 32))) === 0) {
        return false;
      }
    }
    return true;
  }

  // Estimated cardinality.
  size() {
    let buckets = this.buckets,
      bits = 0;
    for (let i = 0, n = buckets.length; i < n; ++i) bits += popcnt(buckets[i]);
    return -this.m * Math.log(1 - bits / this.m) / this.k;
  }

  // Serialize the bloom filter
  serialize() {
    let array = [].slice.call(this.buckets);
    return JSON.stringify(array);
  }
}

// http://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
const popcnt = v => {
  v -= (v >> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  return (((v + (v >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
};

// Fowler/Noll/Vo hashing.
// Nonstandard variation: this function optionally takes a seed value that is incorporated
// into the offset basis. According to http://www.isthe.com/chongo/tech/comp/fnv/index.html
// "almost any offset_basis will serve so long as it is non-zero".
const fnv_1a = (v, seed) => {
  var a = 2166136261 ^ (seed || 0);
  for (var i = 0, n = v.length; i < n; ++i) {
    var c = v.charCodeAt(i),
      d = c & 0xff00;
    if (d) a = fnv_multiply(a ^ (d >> 8));
    a = fnv_multiply(a ^ (c & 0xff));
  }
  return fnv_mix(a);
};

// a * 16777619 mod 2**32
const fnv_multiply = a => {
  return a + (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
};

// See https://web.archive.org/web/20131019013225/http://home.comcast.net/~bretm/hash/6.html
const fnv_mix = a => {
  a += a << 13;
  a ^= a >>> 7;
  a += a << 3;
  a ^= a >>> 17;
  a += a << 5;
  return a & 0xffffffff;
};

export default BloomFilter;
