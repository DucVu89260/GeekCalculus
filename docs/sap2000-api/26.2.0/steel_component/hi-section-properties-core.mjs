// node_modules/decimal.js/decimal.mjs
var EXP_LIMIT = 9e15;
var MAX_DIGITS = 1e9;
var NUMERALS = "0123456789abcdef";
var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
var DEFAULTS = {
  // These values must be integers within the stated ranges (inclusive).
  // Most of these values can be changed at run-time using the `Decimal.config` method.
  // The maximum number of significant digits of the result of a calculation or base conversion.
  // E.g. `Decimal.config({ precision: 20 });`
  precision: 20,
  // 1 to MAX_DIGITS
  // The rounding mode used when rounding to `precision`.
  //
  // ROUND_UP         0 Away from zero.
  // ROUND_DOWN       1 Towards zero.
  // ROUND_CEIL       2 Towards +Infinity.
  // ROUND_FLOOR      3 Towards -Infinity.
  // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
  // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
  // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
  // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
  // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
  //
  // E.g.
  // `Decimal.rounding = 4;`
  // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
  rounding: 4,
  // 0 to 8
  // The modulo mode used when calculating the modulus: a mod n.
  // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
  // The remainder (r) is calculated as: r = a - n * q.
  //
  // UP         0 The remainder is positive if the dividend is negative, else is negative.
  // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
  // FLOOR      3 The remainder has the same sign as the divisor (Python %).
  // HALF_EVEN  6 The IEEE 754 remainder function.
  // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
  //
  // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
  // division (9) are commonly used for the modulus operation. The other rounding modes can also
  // be used, but they may not give useful results.
  modulo: 1,
  // 0 to 9
  // The exponent value at and beneath which `toString` returns exponential notation.
  // JavaScript numbers: -7
  toExpNeg: -7,
  // 0 to -EXP_LIMIT
  // The exponent value at and above which `toString` returns exponential notation.
  // JavaScript numbers: 21
  toExpPos: 21,
  // 0 to EXP_LIMIT
  // The minimum exponent value, beneath which underflow to zero occurs.
  // JavaScript numbers: -324  (5e-324)
  minE: -EXP_LIMIT,
  // -1 to -EXP_LIMIT
  // The maximum exponent value, above which overflow to Infinity occurs.
  // JavaScript numbers: 308  (1.7976931348623157e+308)
  maxE: EXP_LIMIT,
  // 1 to EXP_LIMIT
  // Whether to use cryptographically-secure random number generation, if available.
  crypto: false
  // true/false
};
var inexact;
var quadrant;
var external = true;
var decimalError = "[DecimalError] ";
var invalidArgument = decimalError + "Invalid argument: ";
var precisionLimitExceeded = decimalError + "Precision limit exceeded";
var cryptoUnavailable = decimalError + "crypto unavailable";
var tag = "[object Decimal]";
var mathfloor = Math.floor;
var mathpow = Math.pow;
var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
var BASE = 1e7;
var LOG_BASE = 7;
var MAX_SAFE_INTEGER = 9007199254740991;
var LN10_PRECISION = LN10.length - 1;
var PI_PRECISION = PI.length - 1;
var P = { toStringTag: tag };
P.absoluteValue = P.abs = function() {
  var x = new this.constructor(this);
  if (x.s < 0) x.s = 1;
  return finalise(x);
};
P.ceil = function() {
  return finalise(new this.constructor(this), this.e + 1, 2);
};
P.clampedTo = P.clamp = function(min2, max2) {
  var k, x = this, Ctor = x.constructor;
  min2 = new Ctor(min2);
  max2 = new Ctor(max2);
  if (!min2.s || !max2.s) return new Ctor(NaN);
  if (min2.gt(max2)) throw Error(invalidArgument + max2);
  k = x.cmp(min2);
  return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
};
P.comparedTo = P.cmp = function(y) {
  var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
  if (!xd || !yd) {
    return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
  }
  if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
  if (xs !== ys) return xs;
  if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
  xdL = xd.length;
  ydL = yd.length;
  for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
    if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
  }
  return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
};
P.cosine = P.cos = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.d) return new Ctor(NaN);
  if (!x.d[0]) return new Ctor(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
};
P.cubeRoot = P.cbrt = function() {
  var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  external = false;
  s = x.s * mathpow(x.s * x, 1 / 3);
  if (!s || Math.abs(s) == 1 / 0) {
    n = digitsToString(x.d);
    e = x.e;
    if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
    s = mathpow(n, 1 / 3);
    e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
    r.s = x.s;
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    t3 = t.times(t).times(t);
    t3plusx = t3.plus(x);
    r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.decimalPlaces = P.dp = function() {
  var w, d = this.d, n = NaN;
  if (d) {
    w = d.length - 1;
    n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
    w = d[w];
    if (w) for (; w % 10 == 0; w /= 10) n--;
    if (n < 0) n = 0;
  }
  return n;
};
P.dividedBy = P.div = function(y) {
  return divide(this, new this.constructor(y));
};
P.dividedToIntegerBy = P.divToInt = function(y) {
  var x = this, Ctor = x.constructor;
  return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
};
P.equals = P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.floor = function() {
  return finalise(new this.constructor(this), this.e + 1, 3);
};
P.greaterThan = P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.greaterThanOrEqualTo = P.gte = function(y) {
  var k = this.cmp(y);
  return k == 1 || k === 0;
};
P.hyperbolicCosine = P.cosh = function() {
  var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
  if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
  if (x.isZero()) return one;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    n = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    n = "2.3283064365386962890625e-10";
  }
  x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
  var cosh2_x, i = k, d8 = new Ctor(8);
  for (; i--; ) {
    cosh2_x = x.times(x);
    x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
  }
  return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.hyperbolicSine = P.sinh = function() {
  var k, pr, rm, len, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
  Ctor.rounding = 1;
  len = x.d.length;
  if (len < 3) {
    x = taylorSeries(Ctor, 2, x, x, true);
  } else {
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x, true);
    var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sinh2_x = x.times(x);
      x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
    }
  }
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(x, pr, rm, true);
};
P.hyperbolicTangent = P.tanh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(x.s);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 7;
  Ctor.rounding = 1;
  return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
};
P.inverseCosine = P.acos = function() {
  var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
  if (k !== -1) {
    return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
  }
  if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseHyperbolicCosine = P.acosh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
  if (!x.isFinite()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).minus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicSine = P.asinh = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite() || x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
  Ctor.rounding = 1;
  external = false;
  x = x.times(x).plus(1).sqrt().plus(x);
  external = true;
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.ln();
};
P.inverseHyperbolicTangent = P.atanh = function() {
  var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  xsd = x.sd();
  if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
  Ctor.precision = wpr = xsd - x.e;
  x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
  Ctor.precision = pr + 4;
  Ctor.rounding = 1;
  x = x.ln();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(0.5);
};
P.inverseSine = P.asin = function() {
  var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
  if (x.isZero()) return new Ctor(x);
  k = x.abs().cmp(1);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (k !== -1) {
    if (k === 0) {
      halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
      halfPi.s = x.s;
      return halfPi;
    }
    return new Ctor(NaN);
  }
  Ctor.precision = pr + 6;
  Ctor.rounding = 1;
  x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return x.times(2);
};
P.inverseTangent = P.atan = function() {
  var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
  if (!x.isFinite()) {
    if (!x.s) return new Ctor(NaN);
    if (pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.5);
      r.s = x.s;
      return r;
    }
  } else if (x.isZero()) {
    return new Ctor(x);
  } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
    r = getPi(Ctor, pr + 4, rm).times(0.25);
    r.s = x.s;
    return r;
  }
  Ctor.precision = wpr = pr + 10;
  Ctor.rounding = 1;
  k = Math.min(28, wpr / LOG_BASE + 2 | 0);
  for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
  external = false;
  j = Math.ceil(wpr / LOG_BASE);
  n = 1;
  x2 = x.times(x);
  r = new Ctor(x);
  px = x;
  for (; i !== -1; ) {
    px = px.times(x2);
    t = r.minus(px.div(n += 2));
    px = px.times(x2);
    r = t.plus(px.div(n += 2));
    if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
  }
  if (k) r = r.times(2 << k - 1);
  external = true;
  return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
};
P.isFinite = function() {
  return !!this.d;
};
P.isInteger = P.isInt = function() {
  return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
};
P.isNaN = function() {
  return !this.s;
};
P.isNegative = P.isNeg = function() {
  return this.s < 0;
};
P.isPositive = P.isPos = function() {
  return this.s > 0;
};
P.isZero = function() {
  return !!this.d && this.d[0] === 0;
};
P.lessThan = P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lessThanOrEqualTo = P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.logarithm = P.log = function(base) {
  var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
  if (base == null) {
    base = new Ctor(10);
    isBase10 = true;
  } else {
    base = new Ctor(base);
    d = base.d;
    if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
    isBase10 = base.eq(10);
  }
  d = arg.d;
  if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
    return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
  }
  if (isBase10) {
    if (d.length > 1) {
      inf = true;
    } else {
      for (k = d[0]; k % 10 === 0; ) k /= 10;
      inf = k !== 1;
    }
  }
  external = false;
  sd = pr + guard;
  num = naturalLogarithm(arg, sd);
  denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
  r = divide(num, denominator, sd, 1);
  if (checkRoundingDigits(r.d, k = pr, rm)) {
    do {
      sd += 10;
      num = naturalLogarithm(arg, sd);
      denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
      r = divide(num, denominator, sd, 1);
      if (!inf) {
        if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
        break;
      }
    } while (checkRoundingDigits(r.d, k += 10, rm));
  }
  external = true;
  return finalise(r, pr, rm);
};
P.minus = P.sub = function(y) {
  var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (x.d) y.s = -y.s;
    else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.plus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (yd[0]) y.s = -y.s;
    else if (xd[0]) y = new Ctor(x);
    else return new Ctor(rm === 3 ? -0 : 0);
    return external ? finalise(y, pr, rm) : y;
  }
  e = mathfloor(y.e / LOG_BASE);
  xe = mathfloor(x.e / LOG_BASE);
  xd = xd.slice();
  k = xe - e;
  if (k) {
    xLTy = k < 0;
    if (xLTy) {
      d = xd;
      k = -k;
      len = yd.length;
    } else {
      d = yd;
      e = xe;
      len = xd.length;
    }
    i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
    if (k > i) {
      k = i;
      d.length = 1;
    }
    d.reverse();
    for (i = k; i--; ) d.push(0);
    d.reverse();
  } else {
    i = xd.length;
    len = yd.length;
    xLTy = i < len;
    if (xLTy) len = i;
    for (i = 0; i < len; i++) {
      if (xd[i] != yd[i]) {
        xLTy = xd[i] < yd[i];
        break;
      }
    }
    k = 0;
  }
  if (xLTy) {
    d = xd;
    xd = yd;
    yd = d;
    y.s = -y.s;
  }
  len = xd.length;
  for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
  for (i = yd.length; i > k; ) {
    if (xd[--i] < yd[i]) {
      for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
      --xd[j];
      xd[i] += BASE;
    }
    xd[i] -= yd[i];
  }
  for (; xd[--len] === 0; ) xd.pop();
  for (; xd[0] === 0; xd.shift()) --e;
  if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.modulo = P.mod = function(y) {
  var q, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
  if (!y.d || x.d && !x.d[0]) {
    return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
  }
  external = false;
  if (Ctor.modulo == 9) {
    q = divide(x, y.abs(), 0, 3, 1);
    q.s *= y.s;
  } else {
    q = divide(x, y, 0, Ctor.modulo, 1);
  }
  q = q.times(y);
  external = true;
  return x.minus(q);
};
P.naturalExponential = P.exp = function() {
  return naturalExponential(this);
};
P.naturalLogarithm = P.ln = function() {
  return naturalLogarithm(this);
};
P.negated = P.neg = function() {
  var x = new this.constructor(this);
  x.s = -x.s;
  return finalise(x);
};
P.plus = P.add = function(y) {
  var carry, d, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
  y = new Ctor(y);
  if (!x.d || !y.d) {
    if (!x.s || !y.s) y = new Ctor(NaN);
    else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
    return y;
  }
  if (x.s != y.s) {
    y.s = -y.s;
    return x.minus(y);
  }
  xd = x.d;
  yd = y.d;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (!xd[0] || !yd[0]) {
    if (!yd[0]) y = new Ctor(x);
    return external ? finalise(y, pr, rm) : y;
  }
  k = mathfloor(x.e / LOG_BASE);
  e = mathfloor(y.e / LOG_BASE);
  xd = xd.slice();
  i = k - e;
  if (i) {
    if (i < 0) {
      d = xd;
      i = -i;
      len = yd.length;
    } else {
      d = yd;
      e = k;
      len = xd.length;
    }
    k = Math.ceil(pr / LOG_BASE);
    len = k > len ? k + 1 : len + 1;
    if (i > len) {
      i = len;
      d.length = 1;
    }
    d.reverse();
    for (; i--; ) d.push(0);
    d.reverse();
  }
  len = xd.length;
  i = yd.length;
  if (len - i < 0) {
    i = len;
    d = yd;
    yd = xd;
    xd = d;
  }
  for (carry = 0; i; ) {
    carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
    xd[i] %= BASE;
  }
  if (carry) {
    xd.unshift(carry);
    ++e;
  }
  for (len = xd.length; xd[--len] == 0; ) xd.pop();
  y.d = xd;
  y.e = getBase10Exponent(xd, e);
  return external ? finalise(y, pr, rm) : y;
};
P.precision = P.sd = function(z) {
  var k, x = this;
  if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
  if (x.d) {
    k = getPrecision(x.d);
    if (z && x.e + 1 > k) k = x.e + 1;
  } else {
    k = NaN;
  }
  return k;
};
P.round = function() {
  var x = this, Ctor = x.constructor;
  return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
};
P.sine = P.sin = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
  Ctor.rounding = 1;
  x = sine(Ctor, toLessThanHalfPi(Ctor, x));
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
};
P.squareRoot = P.sqrt = function() {
  var m, n, sd, r, rep, t, x = this, d = x.d, e = x.e, s = x.s, Ctor = x.constructor;
  if (s !== 1 || !d || !d[0]) {
    return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
  }
  external = false;
  s = Math.sqrt(+x);
  if (s == 0 || s == 1 / 0) {
    n = digitsToString(d);
    if ((n.length + e) % 2 == 0) n += "0";
    s = Math.sqrt(n);
    e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
    if (s == 1 / 0) {
      n = "5e" + e;
    } else {
      n = s.toExponential();
      n = n.slice(0, n.indexOf("e") + 1) + e;
    }
    r = new Ctor(n);
  } else {
    r = new Ctor(s.toString());
  }
  sd = (e = Ctor.precision) + 3;
  for (; ; ) {
    t = r;
    r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
    if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
      n = n.slice(sd - 3, sd + 1);
      if (n == "9999" || !rep && n == "4999") {
        if (!rep) {
          finalise(t, e + 1, 0);
          if (t.times(t).eq(x)) {
            r = t;
            break;
          }
        }
        sd += 4;
        rep = 1;
      } else {
        if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
          finalise(r, e + 1, 1);
          m = !r.times(r).eq(x);
        }
        break;
      }
    }
  }
  external = true;
  return finalise(r, e, Ctor.rounding, m);
};
P.tangent = P.tan = function() {
  var pr, rm, x = this, Ctor = x.constructor;
  if (!x.isFinite()) return new Ctor(NaN);
  if (x.isZero()) return new Ctor(x);
  pr = Ctor.precision;
  rm = Ctor.rounding;
  Ctor.precision = pr + 10;
  Ctor.rounding = 1;
  x = x.sin();
  x.s = 1;
  x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
  Ctor.precision = pr;
  Ctor.rounding = rm;
  return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
};
P.times = P.mul = function(y) {
  var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
  y.s *= x.s;
  if (!xd || !xd[0] || !yd || !yd[0]) {
    return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
  }
  e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
  xdL = xd.length;
  ydL = yd.length;
  if (xdL < ydL) {
    r = xd;
    xd = yd;
    yd = r;
    rL = xdL;
    xdL = ydL;
    ydL = rL;
  }
  r = [];
  rL = xdL + ydL;
  for (i = rL; i--; ) r.push(0);
  for (i = ydL; --i >= 0; ) {
    carry = 0;
    for (k = xdL + i; k > i; ) {
      t = r[k] + yd[i] * xd[k - i - 1] + carry;
      r[k--] = t % BASE | 0;
      carry = t / BASE | 0;
    }
    r[k] = (r[k] + carry) % BASE | 0;
  }
  for (; !r[--rL]; ) r.pop();
  if (carry) ++e;
  else r.shift();
  y.d = r;
  y.e = getBase10Exponent(r, e);
  return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
};
P.toBinary = function(sd, rm) {
  return toStringBinary(this, 2, sd, rm);
};
P.toDecimalPlaces = P.toDP = function(dp, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (dp === void 0) return x;
  checkInt32(dp, 0, MAX_DIGITS);
  if (rm === void 0) rm = Ctor.rounding;
  else checkInt32(rm, 0, 8);
  return finalise(x, dp + x.e + 1, rm);
};
P.toExponential = function(dp, rm) {
  var str, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x, true);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), dp + 1, rm);
    str = finiteToString(x, true, dp + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFixed = function(dp, rm) {
  var str, y, x = this, Ctor = x.constructor;
  if (dp === void 0) {
    str = finiteToString(x);
  } else {
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    y = finalise(new Ctor(x), dp + x.e + 1, rm);
    str = finiteToString(y, false, dp + y.e + 1);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toFraction = function(maxD) {
  var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
  if (!xd) return new Ctor(x);
  n1 = d0 = new Ctor(1);
  d1 = n0 = new Ctor(0);
  d = new Ctor(d1);
  e = d.e = getPrecision(xd) - x.e - 1;
  k = e % LOG_BASE;
  d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
  if (maxD == null) {
    maxD = e > 0 ? d : n1;
  } else {
    n = new Ctor(maxD);
    if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
    maxD = n.gt(d) ? e > 0 ? d : n1 : n;
  }
  external = false;
  n = new Ctor(digitsToString(xd));
  pr = Ctor.precision;
  Ctor.precision = e = xd.length * LOG_BASE * 2;
  for (; ; ) {
    q = divide(n, d, 0, 1, 1);
    d2 = d0.plus(q.times(d1));
    if (d2.cmp(maxD) == 1) break;
    d0 = d1;
    d1 = d2;
    d2 = n1;
    n1 = n0.plus(q.times(d2));
    n0 = d2;
    d2 = d;
    d = n.minus(q.times(d2));
    n = d2;
  }
  d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
  n0 = n0.plus(d2.times(n1));
  d0 = d0.plus(d2.times(d1));
  n0.s = n1.s = x.s;
  r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
  Ctor.precision = pr;
  external = true;
  return r;
};
P.toHexadecimal = P.toHex = function(sd, rm) {
  return toStringBinary(this, 16, sd, rm);
};
P.toNearest = function(y, rm) {
  var x = this, Ctor = x.constructor;
  x = new Ctor(x);
  if (y == null) {
    if (!x.d) return x;
    y = new Ctor(1);
    rm = Ctor.rounding;
  } else {
    y = new Ctor(y);
    if (rm === void 0) {
      rm = Ctor.rounding;
    } else {
      checkInt32(rm, 0, 8);
    }
    if (!x.d) return y.s ? x : y;
    if (!y.d) {
      if (y.s) y.s = x.s;
      return y;
    }
  }
  if (y.d[0]) {
    external = false;
    x = divide(x, y, 0, rm, 1).times(y);
    external = true;
    finalise(x);
  } else {
    y.s = x.s;
    x = y;
  }
  return x;
};
P.toNumber = function() {
  return +this;
};
P.toOctal = function(sd, rm) {
  return toStringBinary(this, 8, sd, rm);
};
P.toPower = P.pow = function(y) {
  var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
  if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
  x = new Ctor(x);
  if (x.eq(1)) return x;
  pr = Ctor.precision;
  rm = Ctor.rounding;
  if (y.eq(1)) return finalise(x, pr, rm);
  e = mathfloor(y.e / LOG_BASE);
  if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
    r = intPow(Ctor, x, k, pr);
    return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
  }
  s = x.s;
  if (s < 0) {
    if (e < y.d.length - 1) return new Ctor(NaN);
    if ((y.d[e] & 1) == 0) s = 1;
    if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
      x.s = s;
      return x;
    }
  }
  k = mathpow(+x, yn);
  e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
  if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
  external = false;
  Ctor.rounding = x.s = 1;
  k = Math.min(12, (e + "").length);
  r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
  if (r.d) {
    r = finalise(r, pr + 5, 1);
    if (checkRoundingDigits(r.d, pr, rm)) {
      e = pr + 10;
      r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
      if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
        r = finalise(r, pr + 1, 0);
      }
    }
  }
  r.s = s;
  external = true;
  Ctor.rounding = rm;
  return finalise(r, pr, rm);
};
P.toPrecision = function(sd, rm) {
  var str, x = this, Ctor = x.constructor;
  if (sd === void 0) {
    str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    x = finalise(new Ctor(x), sd, rm);
    str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
  }
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.toSignificantDigits = P.toSD = function(sd, rm) {
  var x = this, Ctor = x.constructor;
  if (sd === void 0) {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  } else {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  }
  return finalise(new Ctor(x), sd, rm);
};
P.toString = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() && !x.isZero() ? "-" + str : str;
};
P.truncated = P.trunc = function() {
  return finalise(new this.constructor(this), this.e + 1, 1);
};
P.valueOf = P.toJSON = function() {
  var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
  return x.isNeg() ? "-" + str : str;
};
function digitsToString(d) {
  var i, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
  if (indexOfLastWord > 0) {
    str += w;
    for (i = 1; i < indexOfLastWord; i++) {
      ws = d[i] + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
      str += ws;
    }
    w = d[i];
    ws = w + "";
    k = LOG_BASE - ws.length;
    if (k) str += getZeroString(k);
  } else if (w === 0) {
    return "0";
  }
  for (; w % 10 === 0; ) w /= 10;
  return str + w;
}
function checkInt32(i, min2, max2) {
  if (i !== ~~i || i < min2 || i > max2) {
    throw Error(invalidArgument + i);
  }
}
function checkRoundingDigits(d, i, rm, repeating) {
  var di, k, r, rd;
  for (k = d[0]; k >= 10; k /= 10) --i;
  if (--i < 0) {
    i += LOG_BASE;
    di = 0;
  } else {
    di = Math.ceil((i + 1) / LOG_BASE);
    i %= LOG_BASE;
  }
  k = mathpow(10, LOG_BASE - i);
  rd = d[di] % k | 0;
  if (repeating == null) {
    if (i < 3) {
      if (i == 0) rd = rd / 100 | 0;
      else if (i == 1) rd = rd / 10 | 0;
      r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
    } else {
      r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
    }
  } else {
    if (i < 4) {
      if (i == 0) rd = rd / 1e3 | 0;
      else if (i == 1) rd = rd / 100 | 0;
      else if (i == 2) rd = rd / 10 | 0;
      r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
    } else {
      r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
    }
  }
  return r;
}
function convertBase(str, baseIn, baseOut) {
  var j, arr = [0], arrL, i = 0, strL = str.length;
  for (; i < strL; ) {
    for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
    arr[0] += NUMERALS.indexOf(str.charAt(i++));
    for (j = 0; j < arr.length; j++) {
      if (arr[j] > baseOut - 1) {
        if (arr[j + 1] === void 0) arr[j + 1] = 0;
        arr[j + 1] += arr[j] / baseOut | 0;
        arr[j] %= baseOut;
      }
    }
  }
  return arr.reverse();
}
function cosine(Ctor, x) {
  var k, len, y;
  if (x.isZero()) return x;
  len = x.d.length;
  if (len < 32) {
    k = Math.ceil(len / 3);
    y = (1 / tinyPow(4, k)).toString();
  } else {
    k = 16;
    y = "2.3283064365386962890625e-10";
  }
  Ctor.precision += k;
  x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
  for (var i = k; i--; ) {
    var cos2x = x.times(x);
    x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
  }
  Ctor.precision -= k;
  return x;
}
var divide = /* @__PURE__ */ (function() {
  function multiplyInteger(x, k, base) {
    var temp, carry = 0, i = x.length;
    for (x = x.slice(); i--; ) {
      temp = x[i] * k + carry;
      x[i] = temp % base | 0;
      carry = temp / base | 0;
    }
    if (carry) x.unshift(carry);
    return x;
  }
  function compare(a, b, aL, bL) {
    var i, r;
    if (aL != bL) {
      r = aL > bL ? 1 : -1;
    } else {
      for (i = r = 0; i < aL; i++) {
        if (a[i] != b[i]) {
          r = a[i] > b[i] ? 1 : -1;
          break;
        }
      }
    }
    return r;
  }
  function subtract(a, b, aL, base) {
    var i = 0;
    for (; aL--; ) {
      a[aL] -= i;
      i = a[aL] < b[aL] ? 1 : 0;
      a[aL] = i * base + a[aL] - b[aL];
    }
    for (; !a[0] && a.length > 1; ) a.shift();
  }
  return function(x, y, pr, rm, dp, base) {
    var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(
        // Return NaN if either NaN, or both Infinity or 0.
        !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
          // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
          xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
        )
      );
    }
    if (base) {
      logBase = 1;
      e = x.e - y.e;
    } else {
      base = BASE;
      logBase = LOG_BASE;
      e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
    }
    yL = yd.length;
    xL = xd.length;
    q = new Ctor(sign2);
    qd = q.d = [];
    for (i = 0; yd[i] == (xd[i] || 0); i++) ;
    if (yd[i] > (xd[i] || 0)) e--;
    if (pr == null) {
      sd = pr = Ctor.precision;
      rm = Ctor.rounding;
    } else if (dp) {
      sd = pr + (x.e - y.e) + 1;
    } else {
      sd = pr;
    }
    if (sd < 0) {
      qd.push(1);
      more = true;
    } else {
      sd = sd / logBase + 2 | 0;
      i = 0;
      if (yL == 1) {
        k = 0;
        yd = yd[0];
        sd++;
        for (; (i < xL || k) && sd--; i++) {
          t = k * base + (xd[i] || 0);
          qd[i] = t / yd | 0;
          k = t % yd | 0;
        }
        more = k || i < xL;
      } else {
        k = base / (yd[0] + 1) | 0;
        if (k > 1) {
          yd = multiplyInteger(yd, k, base);
          xd = multiplyInteger(xd, k, base);
          yL = yd.length;
          xL = xd.length;
        }
        xi = yL;
        rem = xd.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; ) rem[remL++] = 0;
        yz = yd.slice();
        yz.unshift(0);
        yd0 = yd[0];
        if (yd[1] >= base / 2) ++yd0;
        do {
          k = 0;
          cmp = compare(yd, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            k = rem0 / yd0 | 0;
            if (k > 1) {
              if (k >= base) k = base - 1;
              prod = multiplyInteger(yd, k, base);
              prodL = prod.length;
              remL = rem.length;
              cmp = compare(prod, rem, prodL, remL);
              if (cmp == 1) {
                k--;
                subtract(prod, yL < prodL ? yz : yd, prodL, base);
              }
            } else {
              if (k == 0) cmp = k = 1;
              prod = yd.slice();
            }
            prodL = prod.length;
            if (prodL < remL) prod.unshift(0);
            subtract(rem, prod, remL, base);
            if (cmp == -1) {
              remL = rem.length;
              cmp = compare(yd, rem, yL, remL);
              if (cmp < 1) {
                k++;
                subtract(rem, yL < remL ? yz : yd, remL, base);
              }
            }
            remL = rem.length;
          } else if (cmp === 0) {
            k++;
            rem = [0];
          }
          qd[i++] = k;
          if (cmp && rem[0]) {
            rem[remL++] = xd[xi] || 0;
          } else {
            rem = [xd[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] !== void 0) && sd--);
        more = rem[0] !== void 0;
      }
      if (!qd[0]) qd.shift();
    }
    if (logBase == 1) {
      q.e = e;
      inexact = more;
    } else {
      for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
      q.e = i + e * logBase - 1;
      finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
    }
    return q;
  };
})();
function finalise(x, sd, rm, isTruncated) {
  var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
  out: if (sd != null) {
    xd = x.d;
    if (!xd) return x;
    for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
    i = sd - digits;
    if (i < 0) {
      i += LOG_BASE;
      j = sd;
      w = xd[xdi = 0];
      rd = w / mathpow(10, digits - j - 1) % 10 | 0;
    } else {
      xdi = Math.ceil((i + 1) / LOG_BASE);
      k = xd.length;
      if (xdi >= k) {
        if (isTruncated) {
          for (; k++ <= xdi; ) xd.push(0);
          w = rd = 0;
          digits = 1;
          i %= LOG_BASE;
          j = i - LOG_BASE + 1;
        } else {
          break out;
        }
      } else {
        w = k = xd[xdi];
        for (digits = 1; k >= 10; k /= 10) digits++;
        i %= LOG_BASE;
        j = i - LOG_BASE + digits;
        rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
      }
    }
    isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
    roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
    (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
    if (sd < 1 || !xd[0]) {
      xd.length = 0;
      if (roundUp) {
        sd -= x.e + 1;
        xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
        x.e = -sd || 0;
      } else {
        xd[0] = x.e = 0;
      }
      return x;
    }
    if (i == 0) {
      xd.length = xdi;
      k = 1;
      xdi--;
    } else {
      xd.length = xdi + 1;
      k = mathpow(10, LOG_BASE - i);
      xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
    }
    if (roundUp) {
      for (; ; ) {
        if (xdi == 0) {
          for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
          j = xd[0] += k;
          for (k = 1; j >= 10; j /= 10) k++;
          if (i != k) {
            x.e++;
            if (xd[0] == BASE) xd[0] = 1;
          }
          break;
        } else {
          xd[xdi] += k;
          if (xd[xdi] != BASE) break;
          xd[xdi--] = 0;
          k = 1;
        }
      }
    }
    for (i = xd.length; xd[--i] === 0; ) xd.pop();
  }
  if (external) {
    if (x.e > Ctor.maxE) {
      x.d = null;
      x.e = NaN;
    } else if (x.e < Ctor.minE) {
      x.e = 0;
      x.d = [0];
    }
  }
  return x;
}
function finiteToString(x, isExp, sd) {
  if (!x.isFinite()) return nonFiniteToString(x);
  var k, e = x.e, str = digitsToString(x.d), len = str.length;
  if (isExp) {
    if (sd && (k = sd - len) > 0) {
      str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
    } else if (len > 1) {
      str = str.charAt(0) + "." + str.slice(1);
    }
    str = str + (x.e < 0 ? "e" : "e+") + x.e;
  } else if (e < 0) {
    str = "0." + getZeroString(-e - 1) + str;
    if (sd && (k = sd - len) > 0) str += getZeroString(k);
  } else if (e >= len) {
    str += getZeroString(e + 1 - len);
    if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
  } else {
    if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
    if (sd && (k = sd - len) > 0) {
      if (e + 1 === len) str += ".";
      str += getZeroString(k);
    }
  }
  return str;
}
function getBase10Exponent(digits, e) {
  var w = digits[0];
  for (e *= LOG_BASE; w >= 10; w /= 10) e++;
  return e;
}
function getLn10(Ctor, sd, pr) {
  if (sd > LN10_PRECISION) {
    external = true;
    if (pr) Ctor.precision = pr;
    throw Error(precisionLimitExceeded);
  }
  return finalise(new Ctor(LN10), sd, 1, true);
}
function getPi(Ctor, sd, rm) {
  if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
  return finalise(new Ctor(PI), sd, rm, true);
}
function getPrecision(digits) {
  var w = digits.length - 1, len = w * LOG_BASE + 1;
  w = digits[w];
  if (w) {
    for (; w % 10 == 0; w /= 10) len--;
    for (w = digits[0]; w >= 10; w /= 10) len++;
  }
  return len;
}
function getZeroString(k) {
  var zs = "";
  for (; k--; ) zs += "0";
  return zs;
}
function intPow(Ctor, x, n, pr) {
  var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
  external = false;
  for (; ; ) {
    if (n % 2) {
      r = r.times(x);
      if (truncate(r.d, k)) isTruncated = true;
    }
    n = mathfloor(n / 2);
    if (n === 0) {
      n = r.d.length - 1;
      if (isTruncated && r.d[n] === 0) ++r.d[n];
      break;
    }
    x = x.times(x);
    truncate(x.d, k);
  }
  external = true;
  return r;
}
function isOdd(n) {
  return n.d[n.d.length - 1] & 1;
}
function maxOrMin(Ctor, args, n) {
  var k, y, x = new Ctor(args[0]), i = 0;
  for (; ++i < args.length; ) {
    y = new Ctor(args[i]);
    if (!y.s) {
      x = y;
      break;
    }
    k = x.cmp(y);
    if (k === n || k === 0 && x.s === n) {
      x = y;
    }
  }
  return x;
}
function naturalExponential(x, sd) {
  var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (!x.d || !x.d[0] || x.e > 17) {
    return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  t = new Ctor(0.03125);
  while (x.e > -2) {
    x = x.times(t);
    k += 5;
  }
  guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
  wpr += guard;
  denominator = pow2 = sum2 = new Ctor(1);
  Ctor.precision = wpr;
  for (; ; ) {
    pow2 = finalise(pow2.times(x), wpr, 1);
    denominator = denominator.times(++i);
    t = sum2.plus(divide(pow2, denominator, wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      j = k;
      while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
      if (sd == null) {
        if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += 10;
          denominator = pow2 = t = new Ctor(1);
          i = 0;
          rep++;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
  }
}
function naturalLogarithm(y, sd) {
  var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
  if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
    return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
  }
  if (sd == null) {
    external = false;
    wpr = pr;
  } else {
    wpr = sd;
  }
  Ctor.precision = wpr += guard;
  c = digitsToString(xd);
  c0 = c.charAt(0);
  if (Math.abs(e = x.e) < 15e14) {
    while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
      x = x.times(y);
      c = digitsToString(x.d);
      c0 = c.charAt(0);
      n++;
    }
    e = x.e;
    if (c0 > 1) {
      x = new Ctor("0." + c);
      e++;
    } else {
      x = new Ctor(c0 + "." + c.slice(1));
    }
  } else {
    t = getLn10(Ctor, wpr + 2, pr).times(e + "");
    x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
    Ctor.precision = pr;
    return sd == null ? finalise(x, pr, rm, external = true) : x;
  }
  x1 = x;
  sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
  x2 = finalise(x.times(x), wpr, 1);
  denominator = 3;
  for (; ; ) {
    numerator = finalise(numerator.times(x2), wpr, 1);
    t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
    if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
      sum2 = sum2.times(2);
      if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
      sum2 = divide(sum2, new Ctor(n), wpr, 1);
      if (sd == null) {
        if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
          Ctor.precision = wpr += guard;
          t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
          x2 = finalise(x.times(x), wpr, 1);
          denominator = rep = 1;
        } else {
          return finalise(sum2, Ctor.precision = pr, rm, external = true);
        }
      } else {
        Ctor.precision = pr;
        return sum2;
      }
    }
    sum2 = t;
    denominator += 2;
  }
}
function nonFiniteToString(x) {
  return String(x.s * x.s / 0);
}
function parseDecimal(x, str) {
  var e, i, len;
  if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
  if ((i = str.search(/e/i)) > 0) {
    if (e < 0) e = i;
    e += +str.slice(i + 1);
    str = str.substring(0, i);
  } else if (e < 0) {
    e = str.length;
  }
  for (i = 0; str.charCodeAt(i) === 48; i++) ;
  for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
  str = str.slice(i, len);
  if (str) {
    len -= i;
    x.e = e = e - i - 1;
    x.d = [];
    i = (e + 1) % LOG_BASE;
    if (e < 0) i += LOG_BASE;
    if (i < len) {
      if (i) x.d.push(+str.slice(0, i));
      for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
      str = str.slice(i);
      i = LOG_BASE - str.length;
    } else {
      i -= len;
    }
    for (; i--; ) str += "0";
    x.d.push(+str);
    if (external) {
      if (x.e > x.constructor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < x.constructor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
  } else {
    x.e = 0;
    x.d = [0];
  }
  return x;
}
function parseOther(x, str) {
  var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
  if (str.indexOf("_") > -1) {
    str = str.replace(/(\d)_(?=\d)/g, "$1");
    if (isDecimal.test(str)) return parseDecimal(x, str);
  } else if (str === "Infinity" || str === "NaN") {
    if (!+str) x.s = NaN;
    x.e = NaN;
    x.d = null;
    return x;
  }
  if (isHex.test(str)) {
    base = 16;
    str = str.toLowerCase();
  } else if (isBinary.test(str)) {
    base = 2;
  } else if (isOctal.test(str)) {
    base = 8;
  } else {
    throw Error(invalidArgument + str);
  }
  i = str.search(/p/i);
  if (i > 0) {
    p = +str.slice(i + 1);
    str = str.substring(2, i);
  } else {
    str = str.slice(2);
  }
  i = str.indexOf(".");
  isFloat = i >= 0;
  Ctor = x.constructor;
  if (isFloat) {
    str = str.replace(".", "");
    len = str.length;
    i = len - i;
    divisor = intPow(Ctor, new Ctor(base), i, i * 2);
  }
  xd = convertBase(str, base, BASE);
  xe = xd.length - 1;
  for (i = xe; xd[i] === 0; --i) xd.pop();
  if (i < 0) return new Ctor(x.s * 0);
  x.e = getBase10Exponent(xd, xe);
  x.d = xd;
  external = false;
  if (isFloat) x = divide(x, divisor, len * 4);
  if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
  external = true;
  return x;
}
function sine(Ctor, x) {
  var k, len = x.d.length;
  if (len < 3) {
    return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
  }
  k = 1.4 * Math.sqrt(len);
  k = k > 16 ? 16 : k | 0;
  x = x.times(1 / tinyPow(5, k));
  x = taylorSeries(Ctor, 2, x, x);
  var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
  for (; k--; ) {
    sin2_x = x.times(x);
    x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
  }
  return x;
}
function taylorSeries(Ctor, n, x, y, isHyperbolic) {
  var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
  external = false;
  x2 = x.times(x);
  u = new Ctor(y);
  for (; ; ) {
    t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
    u = isHyperbolic ? y.plus(t) : y.minus(t);
    y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
    t = u.plus(y);
    if (t.d[k] !== void 0) {
      for (j = k; t.d[j] === u.d[j] && j--; ) ;
      if (j == -1) break;
    }
    j = u;
    u = y;
    y = t;
    t = j;
    i++;
  }
  external = true;
  t.d.length = k + 1;
  return t;
}
function tinyPow(b, e) {
  var n = b;
  while (--e) n *= b;
  return n;
}
function toLessThanHalfPi(Ctor, x) {
  var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
  x = x.abs();
  if (x.lte(halfPi)) {
    quadrant = isNeg ? 4 : 1;
    return x;
  }
  t = x.divToInt(pi);
  if (t.isZero()) {
    quadrant = isNeg ? 3 : 2;
  } else {
    x = x.minus(t.times(pi));
    if (x.lte(halfPi)) {
      quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
      return x;
    }
    quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
  }
  return x.minus(pi).abs();
}
function toStringBinary(x, baseOut, sd, rm) {
  var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
  if (isExp) {
    checkInt32(sd, 1, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
  } else {
    sd = Ctor.precision;
    rm = Ctor.rounding;
  }
  if (!x.isFinite()) {
    str = nonFiniteToString(x);
  } else {
    str = finiteToString(x);
    i = str.indexOf(".");
    if (isExp) {
      base = 2;
      if (baseOut == 16) {
        sd = sd * 4 - 3;
      } else if (baseOut == 8) {
        sd = sd * 3 - 2;
      }
    } else {
      base = baseOut;
    }
    if (i >= 0) {
      str = str.replace(".", "");
      y = new Ctor(1);
      y.e = str.length - i;
      y.d = convertBase(finiteToString(y), 10, base);
      y.e = y.d.length;
    }
    xd = convertBase(str, 10, base);
    e = len = xd.length;
    for (; xd[--len] == 0; ) xd.pop();
    if (!xd[0]) {
      str = isExp ? "0p+0" : "0";
    } else {
      if (i < 0) {
        e--;
      } else {
        x = new Ctor(x);
        x.d = xd;
        x.e = e;
        x = divide(x, y, sd, rm, 0, base);
        xd = x.d;
        e = x.e;
        roundUp = inexact;
      }
      i = xd[sd];
      k = base / 2;
      roundUp = roundUp || xd[sd + 1] !== void 0;
      roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
      xd.length = sd;
      if (roundUp) {
        for (; ++xd[--sd] > base - 1; ) {
          xd[sd] = 0;
          if (!sd) {
            ++e;
            xd.unshift(1);
          }
        }
      }
      for (len = xd.length; !xd[len - 1]; --len) ;
      for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
      if (isExp) {
        if (len > 1) {
          if (baseOut == 16 || baseOut == 8) {
            i = baseOut == 16 ? 4 : 3;
            for (--len; len % i; len++) str += "0";
            xd = convertBase(str, base, baseOut);
            for (len = xd.length; !xd[len - 1]; --len) ;
            for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
          } else {
            str = str.charAt(0) + "." + str.slice(1);
          }
        }
        str = str + (e < 0 ? "p" : "p+") + e;
      } else if (e < 0) {
        for (; ++e; ) str = "0" + str;
        str = "0." + str;
      } else {
        if (++e > len) for (e -= len; e--; ) str += "0";
        else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
  }
  return x.s < 0 ? "-" + str : str;
}
function truncate(arr, len) {
  if (arr.length > len) {
    arr.length = len;
    return true;
  }
}
function abs(x) {
  return new this(x).abs();
}
function acos(x) {
  return new this(x).acos();
}
function acosh(x) {
  return new this(x).acosh();
}
function add(x, y) {
  return new this(x).plus(y);
}
function asin(x) {
  return new this(x).asin();
}
function asinh(x) {
  return new this(x).asinh();
}
function atan(x) {
  return new this(x).atan();
}
function atanh(x) {
  return new this(x).atanh();
}
function atan2(y, x) {
  y = new this(y);
  x = new this(x);
  var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
  if (!y.s || !x.s) {
    r = new this(NaN);
  } else if (!y.d && !x.d) {
    r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
    r.s = y.s;
  } else if (!x.d || y.isZero()) {
    r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
    r.s = y.s;
  } else if (!y.d || x.isZero()) {
    r = getPi(this, wpr, 1).times(0.5);
    r.s = y.s;
  } else if (x.s < 0) {
    this.precision = wpr;
    this.rounding = 1;
    r = this.atan(divide(y, x, wpr, 1));
    x = getPi(this, wpr, 1);
    this.precision = pr;
    this.rounding = rm;
    r = y.s < 0 ? r.minus(x) : r.plus(x);
  } else {
    r = this.atan(divide(y, x, wpr, 1));
  }
  return r;
}
function cbrt(x) {
  return new this(x).cbrt();
}
function ceil(x) {
  return finalise(x = new this(x), x.e + 1, 2);
}
function clamp(x, min2, max2) {
  return new this(x).clamp(min2, max2);
}
function config(obj) {
  if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
  var i, p, v, useDefaults = obj.defaults === true, ps = [
    "precision",
    1,
    MAX_DIGITS,
    "rounding",
    0,
    8,
    "toExpNeg",
    -EXP_LIMIT,
    0,
    "toExpPos",
    0,
    EXP_LIMIT,
    "maxE",
    0,
    EXP_LIMIT,
    "minE",
    -EXP_LIMIT,
    0,
    "modulo",
    0,
    9
  ];
  for (i = 0; i < ps.length; i += 3) {
    if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
      else throw Error(invalidArgument + p + ": " + v);
    }
  }
  if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
  if ((v = obj[p]) !== void 0) {
    if (v === true || v === false || v === 0 || v === 1) {
      if (v) {
        if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
          this[p] = true;
        } else {
          throw Error(cryptoUnavailable);
        }
      } else {
        this[p] = false;
      }
    } else {
      throw Error(invalidArgument + p + ": " + v);
    }
  }
  return this;
}
function cos(x) {
  return new this(x).cos();
}
function cosh(x) {
  return new this(x).cosh();
}
function clone(obj) {
  var i, p, ps;
  function Decimal2(v) {
    var e, i2, t, x = this;
    if (!(x instanceof Decimal2)) return new Decimal2(v);
    x.constructor = Decimal2;
    if (isDecimalInstance(v)) {
      x.s = v.s;
      if (external) {
        if (!v.d || v.e > Decimal2.maxE) {
          x.e = NaN;
          x.d = null;
        } else if (v.e < Decimal2.minE) {
          x.e = 0;
          x.d = [0];
        } else {
          x.e = v.e;
          x.d = v.d.slice();
        }
      } else {
        x.e = v.e;
        x.d = v.d ? v.d.slice() : v.d;
      }
      return;
    }
    t = typeof v;
    if (t === "number") {
      if (v === 0) {
        x.s = 1 / v < 0 ? -1 : 1;
        x.e = 0;
        x.d = [0];
        return;
      }
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      if (v === ~~v && v < 1e7) {
        for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
        if (external) {
          if (e > Decimal2.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (e < Decimal2.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = e;
            x.d = [v];
          }
        } else {
          x.e = e;
          x.d = [v];
        }
        return;
      }
      if (v * 0 !== 0) {
        if (!v) x.s = NaN;
        x.e = NaN;
        x.d = null;
        return;
      }
      return parseDecimal(x, v.toString());
    }
    if (t === "string") {
      if ((i2 = v.charCodeAt(0)) === 45) {
        v = v.slice(1);
        x.s = -1;
      } else {
        if (i2 === 43) v = v.slice(1);
        x.s = 1;
      }
      return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
    }
    if (t === "bigint") {
      if (v < 0) {
        v = -v;
        x.s = -1;
      } else {
        x.s = 1;
      }
      return parseDecimal(x, v.toString());
    }
    throw Error(invalidArgument + v);
  }
  Decimal2.prototype = P;
  Decimal2.ROUND_UP = 0;
  Decimal2.ROUND_DOWN = 1;
  Decimal2.ROUND_CEIL = 2;
  Decimal2.ROUND_FLOOR = 3;
  Decimal2.ROUND_HALF_UP = 4;
  Decimal2.ROUND_HALF_DOWN = 5;
  Decimal2.ROUND_HALF_EVEN = 6;
  Decimal2.ROUND_HALF_CEIL = 7;
  Decimal2.ROUND_HALF_FLOOR = 8;
  Decimal2.EUCLID = 9;
  Decimal2.config = Decimal2.set = config;
  Decimal2.clone = clone;
  Decimal2.isDecimal = isDecimalInstance;
  Decimal2.abs = abs;
  Decimal2.acos = acos;
  Decimal2.acosh = acosh;
  Decimal2.add = add;
  Decimal2.asin = asin;
  Decimal2.asinh = asinh;
  Decimal2.atan = atan;
  Decimal2.atanh = atanh;
  Decimal2.atan2 = atan2;
  Decimal2.cbrt = cbrt;
  Decimal2.ceil = ceil;
  Decimal2.clamp = clamp;
  Decimal2.cos = cos;
  Decimal2.cosh = cosh;
  Decimal2.div = div;
  Decimal2.exp = exp;
  Decimal2.floor = floor;
  Decimal2.hypot = hypot;
  Decimal2.ln = ln;
  Decimal2.log = log;
  Decimal2.log10 = log10;
  Decimal2.log2 = log2;
  Decimal2.max = max;
  Decimal2.min = min;
  Decimal2.mod = mod;
  Decimal2.mul = mul;
  Decimal2.pow = pow;
  Decimal2.random = random;
  Decimal2.round = round;
  Decimal2.sign = sign;
  Decimal2.sin = sin;
  Decimal2.sinh = sinh;
  Decimal2.sqrt = sqrt;
  Decimal2.sub = sub;
  Decimal2.sum = sum;
  Decimal2.tan = tan;
  Decimal2.tanh = tanh;
  Decimal2.trunc = trunc;
  if (obj === void 0) obj = {};
  if (obj) {
    if (obj.defaults !== true) {
      ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
      for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
    }
  }
  Decimal2.config(obj);
  return Decimal2;
}
function div(x, y) {
  return new this(x).div(y);
}
function exp(x) {
  return new this(x).exp();
}
function floor(x) {
  return finalise(x = new this(x), x.e + 1, 3);
}
function hypot() {
  var i, n, t = new this(0);
  external = false;
  for (i = 0; i < arguments.length; ) {
    n = new this(arguments[i++]);
    if (!n.d) {
      if (n.s) {
        external = true;
        return new this(1 / 0);
      }
      t = n;
    } else if (t.d) {
      t = t.plus(n.times(n));
    }
  }
  external = true;
  return t.sqrt();
}
function isDecimalInstance(obj) {
  return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
}
function ln(x) {
  return new this(x).ln();
}
function log(x, y) {
  return new this(x).log(y);
}
function log2(x) {
  return new this(x).log(2);
}
function log10(x) {
  return new this(x).log(10);
}
function max() {
  return maxOrMin(this, arguments, -1);
}
function min() {
  return maxOrMin(this, arguments, 1);
}
function mod(x, y) {
  return new this(x).mod(y);
}
function mul(x, y) {
  return new this(x).mul(y);
}
function pow(x, y) {
  return new this(x).pow(y);
}
function random(sd) {
  var d, e, k, n, i = 0, r = new this(1), rd = [];
  if (sd === void 0) sd = this.precision;
  else checkInt32(sd, 1, MAX_DIGITS);
  k = Math.ceil(sd / LOG_BASE);
  if (!this.crypto) {
    for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
  } else if (crypto.getRandomValues) {
    d = crypto.getRandomValues(new Uint32Array(k));
    for (; i < k; ) {
      n = d[i];
      if (n >= 429e7) {
        d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
      } else {
        rd[i++] = n % 1e7;
      }
    }
  } else if (crypto.randomBytes) {
    d = crypto.randomBytes(k *= 4);
    for (; i < k; ) {
      n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 127) << 24);
      if (n >= 214e7) {
        crypto.randomBytes(4).copy(d, i);
      } else {
        rd.push(n % 1e7);
        i += 4;
      }
    }
    i = k / 4;
  } else {
    throw Error(cryptoUnavailable);
  }
  k = rd[--i];
  sd %= LOG_BASE;
  if (k && sd) {
    n = mathpow(10, LOG_BASE - sd);
    rd[i] = (k / n | 0) * n;
  }
  for (; rd[i] === 0; i--) rd.pop();
  if (i < 0) {
    e = 0;
    rd = [0];
  } else {
    e = -1;
    for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
    for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
    if (k < LOG_BASE) e -= LOG_BASE - k;
  }
  r.e = e;
  r.d = rd;
  return r;
}
function round(x) {
  return finalise(x = new this(x), x.e + 1, this.rounding);
}
function sign(x) {
  x = new this(x);
  return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
}
function sin(x) {
  return new this(x).sin();
}
function sinh(x) {
  return new this(x).sinh();
}
function sqrt(x) {
  return new this(x).sqrt();
}
function sub(x, y) {
  return new this(x).sub(y);
}
function sum() {
  var i = 0, args = arguments, x = new this(args[i]);
  external = false;
  for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
  external = true;
  return finalise(x, this.precision, this.rounding);
}
function tan(x) {
  return new this(x).tan();
}
function tanh(x) {
  return new this(x).tanh();
}
function trunc(x) {
  return finalise(x = new this(x), x.e + 1, 1);
}
P[Symbol.for("nodejs.util.inspect.custom")] = P.toString;
P[Symbol.toStringTag] = "Decimal";
var Decimal = P.constructor = clone(DEFAULTS);
LN10 = new Decimal(LN10);
PI = new Decimal(PI);
var decimal_default = Decimal;

// ../../section-properties/core/calculator.ts
var SOLVER_VERSION = "1.3.0";
var GEOMETRY_MODEL_VERSION = "1.0.0";
var Decimal80 = decimal_default.clone({ precision: 80, rounding: decimal_default.ROUND_HALF_EVEN });
var REQUIRED_PROPERTIES = /* @__PURE__ */ new Set([
  "torsion_constant_j",
  "warping_constant_cw",
  "shear_center",
  "effective_shear_area"
]);
var DIMENSIONS = {
  rectangle: ["width", "height"],
  circle: ["diameter"],
  i_section: ["depth", "top_flange_width", "bottom_flange_width", "web_thickness", "top_flange_thickness", "bottom_flange_thickness"],
  rectangular_hollow: ["width", "height", "thickness"],
  circular_hollow: ["diameter", "thickness"],
  channel: ["depth", "width", "web_thickness", "flange_thickness"],
  tee: ["depth", "width", "web_thickness", "flange_thickness"],
  angle: ["depth", "width", "thickness"],
  double_angle: ["depth", "width", "thickness", "distance"]
};
var DemoCalculationError = class extends Error {
  code;
  details;
  errors;
  constructor(code, message, details = {}, errors) {
    super(message);
    this.name = "DemoCalculationError";
    this.code = code;
    this.details = details;
    this.errors = errors;
  }
};
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keysOutside(value, allowed) {
  const accepted = new Set(allowed);
  return Object.keys(value).filter((key) => !accepted.has(key));
}
function inputError(errors) {
  const hasVariant = errors.some((item) => item.path.includes("geometry_variant"));
  const invalidGeometry = errors.some((item) => ["invalid_geometry", "union_tag_invalid", "union_tag_not_found", "extra_forbidden"].includes(item.type));
  const badUnits = errors.some((item) => item.path === "units");
  const badRequiredProperty = errors.some((item) => item.path.includes("required_properties"));
  const code = hasVariant ? "UNSUPPORTED_VARIANT" : invalidGeometry ? "INVALID_GEOMETRY" : badUnits ? "UNSUPPORTED_UNITS" : badRequiredProperty ? "UNSUPPORTED_PROPERTY" : "INVALID_DIMENSION";
  throw new DemoCalculationError(code, "Input validation failed.", { errors }, errors);
}
function requireRecord(value, path, errors) {
  if (!isRecord(value)) {
    errors.push({ path, type: "model_type", message: "Input should be a valid dictionary or object." });
    return void 0;
  }
  return value;
}
function finiteStrictNumber(value, path, errors, positive2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ path, type: typeof value === "number" ? "finite_number" : "float_type", message: typeof value === "number" ? "Input should be a finite number" : "Input should be a valid number" });
    return void 0;
  }
  if (positive2 && value <= 0) {
    errors.push({ path, type: "greater_than", message: "Input should be greater than 0" });
    return void 0;
  }
  return value;
}
function validateRequest(request) {
  const errors = [];
  const raw = requireRecord(request, "", errors);
  if (!raw) inputError(errors);
  const outerUnknown = keysOutside(raw, ["geometry", "units", "options"]);
  for (const key of outerUnknown) errors.push({ path: key, type: "extra_forbidden", message: "Extra inputs are not permitted" });
  if (raw.units !== void 0 && raw.units !== "mm") {
    errors.push({ path: "units", type: "literal_error", message: "Input should be 'mm'" });
  }
  if (raw.geometry === void 0) errors.push({ path: "geometry", type: "missing", message: "Field required" });
  const inputGeometry = requireRecord(raw.geometry, "geometry", errors);
  let geometry;
  if (inputGeometry) {
    const geometryUnknown = keysOutside(inputGeometry, ["type", "geometry_variant", "geometry_model_version", "dimensions"]);
    for (const key of geometryUnknown) errors.push({ path: `geometry.${key}`, type: "extra_forbidden", message: "Extra inputs are not permitted" });
    const type = inputGeometry.type;
    if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(DIMENSIONS, type)) {
      errors.push({ path: "geometry.type", type: typeof type === "string" ? "union_tag_invalid" : "union_tag_not_found", message: "Input tag does not match any expected tag" });
    }
    const variant = inputGeometry.geometry_variant;
    if (typeof variant !== "string" || !["solid", "sharp_corner", "uniform_wall", "back_to_back"].includes(variant)) {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be a supported geometry variant" });
    } else if ((type === "rectangle" || type === "circle") && variant !== "solid") {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be 'solid'" });
    } else if (type === "i_section" && variant !== "sharp_corner") {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be 'sharp_corner'" });
    } else if (type === "circular_hollow" && variant !== "uniform_wall") {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be 'uniform_wall'" });
    } else if (type === "double_angle" && variant !== "back_to_back") {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be 'back_to_back'" });
    } else if (typeof type === "string" && ["rectangular_hollow", "channel", "tee", "angle"].includes(type) && variant !== "sharp_corner") {
      errors.push({ path: "geometry.geometry_variant", type: "literal_error", message: "Input should be 'sharp_corner'" });
    }
    const modelVersion = inputGeometry.geometry_model_version === void 0 ? GEOMETRY_MODEL_VERSION : inputGeometry.geometry_model_version;
    if (modelVersion !== GEOMETRY_MODEL_VERSION) errors.push({ path: "geometry.geometry_model_version", type: "literal_error", message: "Input should be '1.0.0'" });
    const dimensionsRaw = requireRecord(inputGeometry.dimensions, "geometry.dimensions", errors);
    const dimensions = {};
    if (dimensionsRaw && typeof type === "string" && Object.prototype.hasOwnProperty.call(DIMENSIONS, type)) {
      const names = DIMENSIONS[type];
      for (const key of keysOutside(dimensionsRaw, names)) errors.push({ path: `geometry.dimensions.${key}`, type: "extra_forbidden", message: "Extra inputs are not permitted" });
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(dimensionsRaw, name)) {
          errors.push({ path: `geometry.dimensions.${name}`, type: "missing", message: "Field required" });
        } else {
          const value = finiteStrictNumber(dimensionsRaw[name], `geometry.dimensions.${name}`, errors, !(type === "double_angle" && name === "distance"));
          if (type === "double_angle" && name === "distance" && value !== void 0 && value < 0) {
            errors.push({ path: "geometry.dimensions.distance", type: "greater_than_equal", message: "Input should be greater than or equal to 0" });
          }
          if (value !== void 0) dimensions[name] = value;
        }
      }
      if (type === "i_section" && names.every((key) => dimensions[key] !== void 0)) {
        const { depth, top_flange_width, bottom_flange_width, web_thickness, top_flange_thickness, bottom_flange_thickness } = dimensions;
        if (depth <= top_flange_thickness + bottom_flange_thickness) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "depth must exceed the sum of flange thicknesses" });
        }
        if (web_thickness > Math.min(top_flange_width, bottom_flange_width)) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "web_thickness must not exceed either flange width" });
        }
      }
      if (type === "rectangular_hollow" && names.every((key) => dimensions[key] !== void 0)) {
        const { width, height, thickness } = dimensions;
        if (!(width - 2 * thickness > 0 && width - 2 * thickness < width && height - 2 * thickness > 0 && height - 2 * thickness < height)) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "2 * thickness must be representably less than width and height" });
        }
      }
      if (type === "circular_hollow" && names.every((key) => dimensions[key] !== void 0)) {
        const { diameter, thickness } = dimensions;
        if (!(diameter - 2 * thickness > 0 && diameter - 2 * thickness < diameter)) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "2 * thickness must be representably less than diameter" });
        }
      }
      if ((type === "channel" || type === "tee") && names.every((key) => dimensions[key] !== void 0)) {
        const { depth, width, web_thickness, flange_thickness } = dimensions;
        const clearDepth = type === "channel" ? depth - 2 * flange_thickness : depth - flange_thickness;
        if (!(clearDepth > 0 && clearDepth < depth && width - web_thickness > 0 && width - web_thickness < width)) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: `${type} needs representable clear web depth and flange projection` });
        }
      }
      if (type === "angle" && names.every((key) => dimensions[key] !== void 0)) {
        const { depth, width, thickness } = dimensions;
        if (!(depth - thickness > 0 && depth - thickness < depth && width - thickness > 0 && width - thickness < width)) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "angle thickness must be representably less than width and depth" });
        }
      }
      if (type === "double_angle" && names.every((key) => dimensions[key] !== void 0)) {
        const { depth, width, thickness, distance } = dimensions;
        const clearDepth = depth - thickness;
        const clearWidth = width - thickness;
        const overallWidth = 2 * width + distance;
        if (distance >= 0 && !(clearDepth > 0 && clearDepth < depth && clearWidth > 0 && clearWidth < width && Number.isFinite(overallWidth) && overallWidth > width && (distance === 0 || overallWidth > 2 * width))) {
          errors.push({ path: "geometry", type: "invalid_geometry", message: "double-angle dimensions must leave representable legs and overall width" });
        }
      }
      if (errors.length === 0) {
        geometry = {
          type,
          geometry_variant: variant,
          geometry_model_version: GEOMETRY_MODEL_VERSION,
          dimensions
        };
      }
    }
  }
  const rawOptions = raw.options === void 0 ? {} : requireRecord(raw.options, "options", errors);
  let options;
  if (rawOptions) {
    for (const key of keysOutside(rawOptions, ["solver", "include_plastic", "include_advanced", "rectangle_j_relative_tolerance", "rectangle_j_max_terms", "required_properties"])) {
      errors.push({ path: `options.${key}`, type: "extra_forbidden", message: "Extra inputs are not permitted" });
    }
    const solver = rawOptions.solver ?? "analytical";
    if (solver !== "analytical") errors.push({ path: "options.solver", type: "literal_error", message: "Input should be 'analytical'" });
    const includePlastic = rawOptions.include_plastic ?? true;
    const includeAdvanced = rawOptions.include_advanced ?? false;
    if (typeof includePlastic !== "boolean") errors.push({ path: "options.include_plastic", type: "bool_type", message: "Input should be a valid boolean" });
    if (typeof includeAdvanced !== "boolean") errors.push({ path: "options.include_advanced", type: "bool_type", message: "Input should be a valid boolean" });
    const tolerance = rawOptions.rectangle_j_relative_tolerance === void 0 ? 1e-10 : finiteStrictNumber(rawOptions.rectangle_j_relative_tolerance, "options.rectangle_j_relative_tolerance", errors, true);
    if (tolerance !== void 0 && tolerance > 0.01) errors.push({ path: "options.rectangle_j_relative_tolerance", type: "less_than_equal", message: "Input should be less than or equal to 0.01" });
    let maxTerms = 1e4;
    if (rawOptions.rectangle_j_max_terms !== void 0) {
      const value = rawOptions.rectangle_j_max_terms;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1e5) {
        errors.push({ path: "options.rectangle_j_max_terms", type: typeof value === "number" && Number.isInteger(value) ? value < 1 ? "greater_than_equal" : "less_than_equal" : "int_type", message: "Input should be a valid bounded integer" });
      } else maxTerms = value;
    }
    let requiredProperties = [];
    if (rawOptions.required_properties !== void 0) {
      if (!Array.isArray(rawOptions.required_properties)) {
        errors.push({ path: "options.required_properties", type: "tuple_type", message: "Input should be a valid array" });
      } else {
        requiredProperties = rawOptions.required_properties.map((value, index) => {
          if (typeof value !== "string" || !REQUIRED_PROPERTIES.has(value)) {
            errors.push({ path: `options.required_properties.${index}`, type: "literal_error", message: "Input should be a supported property" });
          }
          return String(value);
        });
      }
    }
    if (typeof includePlastic === "boolean" && typeof includeAdvanced === "boolean" && tolerance !== void 0 && tolerance <= 0.01 && Number.isFinite(tolerance)) {
      options = {
        solver: "analytical",
        include_plastic: includePlastic,
        include_advanced: includeAdvanced,
        rectangle_j_relative_tolerance: tolerance,
        rectangle_j_max_terms: maxTerms,
        required_properties: requiredProperties
      };
    }
  }
  if (errors.length) inputError(errors);
  return { geometry, options };
}
function pyFloat(value) {
  if (!Number.isFinite(value)) throw calculationError("Calculation cannot produce finite, positive properties at this numerical scale.", { reason: "floating_point_range" });
  if (Object.is(value, -0)) return "-0.0";
  const source = String(value).toLowerCase();
  const [mantissa, sourceExponent] = source.split("e");
  const exponentPart = sourceExponent === void 0 ? 0 : Number(sourceExponent);
  const unsigned = mantissa.startsWith("-") ? mantissa.slice(1) : mantissa;
  const dot = unsigned.indexOf(".");
  const decimalPosition = dot < 0 ? unsigned.length : dot;
  let digits = unsigned.replace(".", "");
  let first = 0;
  while (first < digits.length && digits[first] === "0") first++;
  if (first === digits.length) return "0.0";
  let significant = digits.slice(first).replace(/0+$/, "");
  const decimalExponent = decimalPosition + exponentPart - first - 1;
  const sign2 = mantissa.startsWith("-") ? "-" : "";
  if (decimalExponent < -4 || decimalExponent >= 16) {
    const fraction = significant.length > 1 ? `.${significant.slice(1)}` : "";
    const exponent = `${decimalExponent >= 0 ? "+" : "-"}${String(Math.abs(decimalExponent)).padStart(2, "0")}`;
    return `${sign2}${significant[0]}${fraction}e${exponent}`;
  }
  const point = decimalExponent + 1;
  let fixed;
  if (point <= 0) fixed = `0.${"0".repeat(-point)}${significant}`;
  else if (point >= significant.length) fixed = `${significant}${"0".repeat(point - significant.length)}.0`;
  else fixed = `${significant.slice(0, point)}.${significant.slice(point)}`;
  return sign2 + fixed;
}
function quote(value) {
  return JSON.stringify(value);
}
function geometryHash(geometry) {
  const dimensions = Object.keys(geometry.dimensions).sort().map((key) => `${quote(key)}:${pyFloat(geometry.dimensions[key])}`).join(",");
  const canonical = `{"dimensions":{${dimensions}},"geometry_model_version":${quote(GEOMETRY_MODEL_VERSION)},"geometry_variant":${quote(geometry.geometry_variant)},"type":${quote(geometry.type)},"units":"mm"}`;
  return sha256(canonical);
}
function configHash(options) {
  const canonical = `{"include_advanced":${options.include_advanced},"include_plastic":${options.include_plastic},"rectangle_j_max_terms":${options.rectangle_j_max_terms},"rectangle_j_relative_tolerance":${pyFloat(options.rectangle_j_relative_tolerance)},"required_properties":[${options.required_properties.map(quote).join(",")}],"solver":"analytical"}`;
  return sha256(canonical);
}
function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const k = SHA256_K;
  const h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  const w = new Uint32Array(64);
  const rotate = (x, n) => x >>> n | x << 32 - n;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ x >>> 3;
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ y >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + s1 + ch + k[i] + w[i] >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = s0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  return Array.from(h, (part) => part.toString(16).padStart(8, "0")).join("");
}
var SHA256_K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function calculationError(message, details) {
  return new DemoCalculationError("CALCULATION_ERROR", message, details);
}
function fsum(values) {
  const partials = [];
  for (let x of values) {
    let j = 0;
    for (let i = 0; i < partials.length; i++) {
      let y = partials[i];
      if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
      const hi2 = x + y;
      const lo2 = y - (hi2 - x);
      if (lo2 !== 0) partials[j++] = lo2;
      x = hi2;
    }
    partials.length = j;
    partials.push(x);
  }
  let n = partials.length;
  let hi = 0;
  let lo = 0;
  while (n) {
    n--;
    const x = hi;
    const y = partials[n];
    hi = x + y;
    const yr = hi - x;
    lo = y - yr;
    if (lo !== 0) break;
  }
  if (n > 0 && (lo < 0 && partials[n - 1] < 0 || lo > 0 && partials[n - 1] > 0)) {
    const y = lo * 2;
    const x = hi + y;
    const yr = x - hi;
    if (y === yr) hi = x;
  }
  return hi;
}
function components(g) {
  const d = g.dimensions;
  if (g.type === "i_section") {
    const { depth, top_flange_width: top, bottom_flange_width: bottom, web_thickness: web, top_flange_thickness: topT, bottom_flange_thickness: bottomT } = d;
    const width = Math.max(top, bottom);
    const webHeight = depth - topT - bottomT;
    return [
      { width: bottom, height: bottomT, x: (width - bottom) / 2, y: 0, area: bottom * bottomT },
      { width: web, height: webHeight, x: (width - web) / 2, y: bottomT, area: web * webHeight },
      { width: top, height: topT, x: (width - top) / 2, y: depth - topT, area: top * topT }
    ];
  }
  if (g.type === "rectangular_hollow") {
    const { width, height, thickness } = d;
    const innerHeight = height - 2 * thickness;
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width, height: thickness, x: 0, y: height - thickness, area: width * thickness },
      { width: thickness, height: innerHeight, x: 0, y: thickness, area: thickness * innerHeight },
      { width: thickness, height: innerHeight, x: width - thickness, y: thickness, area: thickness * innerHeight }
    ];
  }
  if (g.type === "channel") {
    const { depth, width, web_thickness: web, flange_thickness: flange } = d;
    const clearDepth = depth - 2 * flange;
    return [
      { width, height: flange, x: 0, y: 0, area: width * flange },
      { width: web, height: clearDepth, x: 0, y: flange, area: web * clearDepth },
      { width, height: flange, x: 0, y: depth - flange, area: width * flange }
    ];
  }
  if (g.type === "tee") {
    const { depth, width, web_thickness: web, flange_thickness: flange } = d;
    const clearDepth = depth - flange;
    return [
      { width: web, height: clearDepth, x: (width - web) / 2, y: 0, area: web * clearDepth },
      { width, height: flange, x: 0, y: depth - flange, area: width * flange }
    ];
  }
  if (g.type === "angle") {
    const { depth, width, thickness } = d;
    const clearDepth = depth - thickness;
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: 0, y: thickness, area: thickness * clearDepth }
    ];
  }
  if (g.type === "double_angle") {
    const { depth, width, thickness, distance } = d;
    const clearDepth = depth - thickness;
    return [
      { width, height: thickness, x: 0, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: width - thickness, y: thickness, area: thickness * clearDepth },
      { width, height: thickness, x: width + distance, y: 0, area: width * thickness },
      { width: thickness, height: clearDepth, x: width + distance, y: thickness, area: thickness * clearDepth }
    ];
  }
  throw calculationError("Composite components are not defined for this geometry.", { geometry_type: g.type });
}
function decimalPlasticAxisForComponents(parts, axis) {
  const blocks = parts.map((part) => axis === "y" ? [new Decimal80(String(part.width)), new Decimal80(String(part.y)), new Decimal80(String(part.y + part.height))] : [new Decimal80(String(part.height)), new Decimal80(String(part.x)), new Decimal80(String(part.x + part.width))]);
  const area = blocks.reduce((sum2, [span, start, end]) => sum2.plus(span.times(end.minus(start))), new Decimal80(0));
  if (!area.gt(0)) throw new ArithmeticError();
  const target = area.div(2);
  const below = (cut2) => blocks.reduce((sum2, [span, start, end]) => {
    const interval = end.minus(start);
    const length = Decimal80.max(new Decimal80(0), Decimal80.min(interval, cut2.minus(start)));
    return sum2.plus(span.times(length));
  }, new Decimal80(0));
  let low = Decimal80.min(...blocks.map(([, start]) => start));
  let high = Decimal80.max(...blocks.map(([, , end]) => end));
  let cut = new Decimal80(0), iteration = 0;
  for (iteration = 1; iteration <= 256; iteration++) {
    cut = low.plus(high).div(2);
    const currentArea = below(cut);
    if (currentArea.times(2).minus(area).abs().div(area).lte("1e-24")) break;
    if (currentArea.lt(target)) {
      if (low.eq(cut)) break;
      low = cut;
    } else {
      if (high.eq(cut)) break;
      high = cut;
    }
  }
  const slope = blocks.reduce((sum2, [span, start, end]) => start.lte(cut) && cut.lt(end) ? sum2.plus(span) : sum2, new Decimal80(0));
  if (!slope.isZero()) cut = cut.plus(target.minus(below(cut)).div(slope));
  const pna = cut.toNumber();
  const actualCut = new Decimal80(String(pna));
  const actualBelow = below(actualCut);
  const balance = actualBelow.times(2).minus(area).abs().div(area);
  const min2 = Decimal80.min(...blocks.map(([, start]) => start)).toNumber();
  const max2 = Decimal80.max(...blocks.map(([, , end]) => end)).toNumber();
  if (!Number.isFinite(pna) || !(pna > min2 && pna < max2) || balance.gt("1e-10")) {
    throw calculationError("Plastic neutral axis did not meet the area-balance tolerance.", { axis, relative_area_imbalance: balance.toNumber() });
  }
  const moments = blocks.map(([span, start, end]) => {
    const interval = end.minus(start);
    if (actualCut.lte(start)) return span.times(interval).times(start.plus(end).div(2).minus(actualCut));
    if (actualCut.gte(end)) return span.times(interval).times(actualCut.minus(start.plus(end).div(2)));
    return span.times(actualCut.minus(start).pow(2).plus(end.minus(actualCut).pow(2))).div(2);
  });
  return {
    pna,
    z: Decimal80.sum(...moments).toNumber(),
    diagnostics: {
      method: "component_area_bisection_with_piecewise_linear_refinement",
      arithmetic: "decimal_80_then_float64",
      iterations: Math.min(iteration, 256),
      relative_area_imbalance: balance.toNumber()
    }
  };
}
function principalProperties(ix, iy, ixy) {
  if (ix === iy && ixy === 0) {
    return { i_major: ix, i_minor: iy, major_axis_angle_degrees: null, orientation_status: "indeterminate" };
  }
  const scale = Math.max(Math.abs(ix), Math.abs(iy), Math.abs(ixy));
  const mean = (ix / scale + iy / scale) / 2;
  const radius = Math.hypot((ix / scale - iy / scale) / 2, ixy / scale);
  const major = scale * (mean + radius);
  const determinant = new Decimal80(String(ix)).times(String(iy)).minus(new Decimal80(String(ixy)).pow(2));
  const minor = determinant.div(String(major)).toNumber();
  if (![major, minor].every(Number.isFinite) || major <= 0 || minor <= 0) throw new ArithmeticError();
  let angle = (0.5 * Math.atan2(-2 * ixy, ix - iy) * 180 / Math.PI % 180 + 180) % 180;
  if (angle >= 180 - 1e-12) angle = 0;
  return { i_major: major, i_minor: minor, major_axis_angle_degrees: angle, orientation_status: "determinate" };
}
function decimalPlasticAxis(g) {
  const d = Object.fromEntries(Object.entries(g.dimensions).map(([key, value]) => [key, new Decimal80(String(value))]));
  const h = d.depth, bt = d.top_flange_width, bb = d.bottom_flange_width, tw = d.web_thickness, tt = d.top_flange_thickness, tb = d.bottom_flange_thickness;
  const blocks = [[bb, new Decimal80(0), tb], [tw, tb, h.minus(tt)], [bt, h.minus(tt), h]];
  const area = blocks.reduce((sum2, [width, start, end]) => sum2.plus(width.times(end.minus(start))), new Decimal80(0));
  const target = area.div(2);
  const below = (cut2) => blocks.reduce((sum2, [width, start, end]) => {
    const band = end.minus(start);
    const height = Decimal80.max(new Decimal80(0), Decimal80.min(band, cut2.minus(start)));
    return sum2.plus(width.times(height));
  }, new Decimal80(0));
  let low = new Decimal80(0), high = h, cut = new Decimal80(0), iteration = 0;
  for (iteration = 1; iteration <= 256; iteration++) {
    cut = low.plus(high).div(2);
    const currentArea = below(cut);
    if (currentArea.times(2).minus(area).abs().div(area).lte("1e-24")) break;
    if (currentArea.lt(target)) {
      if (low.eq(cut)) break;
      low = cut;
    } else {
      if (high.eq(cut)) break;
      high = cut;
    }
  }
  const slope = blocks.reduce((sum2, [width, start, end]) => start.lte(cut) && cut.lt(end) ? sum2.plus(width) : sum2, new Decimal80(0));
  if (!slope.isZero()) cut = cut.plus(target.minus(below(cut)).div(slope));
  const pna = cut.toNumber();
  const actualCut = new Decimal80(String(pna));
  const actualBelow = below(actualCut);
  const balance = actualBelow.times(2).minus(area).abs().div(area);
  if (!actualCut.gt(0) || !actualCut.lt(h) || balance.gt("1e-10") || !Number.isFinite(pna)) {
    throw calculationError("Plastic neutral axis did not meet the area-balance tolerance.", { relative_area_imbalance: balance.toNumber() });
  }
  const moments = blocks.map(([width, start, end]) => {
    const blockHeight = end.minus(start);
    if (actualCut.lte(start)) return width.times(blockHeight).times(start.plus(end).div(2).minus(actualCut));
    if (actualCut.gte(end)) return width.times(blockHeight).times(actualCut.minus(start.plus(end).div(2)));
    return width.times(actualCut.minus(start).pow(2).plus(end.minus(actualCut).pow(2))).div(2);
  });
  const zx = Decimal80.sum(...moments).toNumber();
  return {
    pna,
    zx,
    diagnostics: {
      method: "area_bisection_with_piecewise_linear_refinement",
      arithmetic: "decimal_80_then_float64",
      iterations: Math.min(iteration, 256),
      area_below: actualBelow.toNumber(),
      area_above: area.minus(actualBelow).toNumber(),
      relative_area_imbalance: balance.toNumber()
    }
  };
}
function nextUp(value) {
  if (Number.isNaN(value) || value === Infinity) return value;
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  let high = view.getUint32(0, false);
  let low = view.getUint32(4, false);
  if (value > 0) {
    if (low === 4294967295) {
      high = high + 1 >>> 0;
      low = 0;
    } else low++;
  } else {
    if (low === 0) {
      high = high - 1 >>> 0;
      low = 4294967295;
    } else low--;
  }
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);
  return view.getFloat64(0, false);
}
function ulp(value) {
  return nextUp(Math.abs(value)) - Math.abs(value);
}
function rectangleTorsion(width, height, tolerance, maxTerms) {
  const a = Math.max(width, height), b = Math.min(width, height);
  const base = a * b ** 3 / 3;
  const coefficient = 192 * b / (Math.PI ** 5 * a);
  if (!Number.isFinite(base) || base <= 0) throw new ArithmeticError();
  let total = 0, compensation = 0;
  let diagnostics = {};
  for (let count = 1; count <= maxTerms; count++) {
    const n = 2 * count - 1;
    const term = Math.tanh(n * Math.PI * (a / b) / 2) / n ** 5;
    const corrected = term - compensation;
    const updated = total + corrected;
    compensation = updated - total - corrected;
    total = updated;
    const scaledValue = 1 - coefficient * total;
    const estimate = base * scaledValue;
    const scaledTailBound = coefficient / (8 * n ** 4);
    const scaledRoundoffEstimate = 32 * Number.EPSILON * (1 + Math.abs(coefficient * total)) + 2 * ulp(base) / base;
    const lower = scaledValue - scaledTailBound - scaledRoundoffEstimate;
    const relativeBound = lower > 0 ? (scaledTailBound + scaledRoundoffEstimate) / lower : null;
    const truncationBound = nextUp(base * scaledTailBound);
    const roundingEstimate = nextUp(base * scaledRoundoffEstimate);
    const converged = relativeBound !== null && relativeBound <= tolerance;
    diagnostics = {
      method: "saint_venant_odd_series",
      terms: count,
      requested_relative_tolerance: tolerance,
      truncation_abs_error_bound: truncationBound,
      floating_point_abs_error_estimate: roundingEstimate,
      relative_error_bound_with_roundoff_estimate: relativeBound,
      scaled_tail_bound: scaledTailBound,
      scaled_roundoff_estimate: scaledRoundoffEstimate,
      converged
    };
    if (converged) return { value: estimate, converged: true, reason: null, diagnostics };
    if (scaledValue > 0 && scaledRoundoffEstimate / scaledValue >= tolerance) {
      return { value: null, converged: false, reason: "numerical_precision_limit", diagnostics };
    }
  }
  return { value: null, converged: false, reason: "convergence_not_achieved", diagnostics };
}
function rescaleDimensionless(value, scale, power, allowZero = false) {
  if (!Number.isFinite(value) || value < 0 || !allowZero && value === 0) return null;
  const converted = new Decimal80(String(value)).times(new Decimal80(String(scale)).pow(power)).toNumber();
  if (!Number.isFinite(converted) || value !== 0 && converted === 0) return null;
  return converted;
}
function wallSegments(g, scale) {
  const d = g.dimensions;
  const n = (value) => value / scale;
  if (g.type === "i_section") {
    const h = n(d.depth), bt = n(d.top_flange_width), bb = n(d.bottom_flange_width);
    const tt = n(d.top_flange_thickness), tb = n(d.bottom_flange_thickness), tw = n(d.web_thickness);
    const width = Math.max(bt, bb), xc = width / 2, yb = tb / 2, yt = h - tt / 2;
    return [
      { x0: xc - bb / 2, y0: yb, x1: xc, y1: yb, thickness: tb, label: "bottom_flange_left" },
      { x0: xc, y0: yb, x1: xc, y1: yt, thickness: tw, label: "web" },
      { x0: xc, y0: yb, x1: xc + bb / 2, y1: yb, thickness: tb, label: "bottom_flange_right" },
      { x0: xc - bt / 2, y0: yt, x1: xc, y1: yt, thickness: tt, label: "top_flange_left" },
      { x0: xc, y0: yt, x1: xc + bt / 2, y1: yt, thickness: tt, label: "top_flange_right" }
    ];
  }
  if (g.type === "channel") {
    const h = n(d.depth), w = n(d.width), tw = n(d.web_thickness), tf = n(d.flange_thickness);
    const xw = tw / 2, yb = tf / 2, yt = h - tf / 2;
    return [
      { x0: xw, y0: yb, x1: w, y1: yb, thickness: tf, label: "bottom_flange" },
      { x0: xw, y0: yb, x1: xw, y1: yt, thickness: tw, label: "web" },
      { x0: xw, y0: yt, x1: w, y1: yt, thickness: tf, label: "top_flange" }
    ];
  }
  if (g.type === "tee") {
    const h = n(d.depth), w = n(d.width), tw = n(d.web_thickness), tf = n(d.flange_thickness);
    const xw = w / 2, yf = h - tf / 2;
    return [
      { x0: xw, y0: 0, x1: xw, y1: yf, thickness: tw, label: "web" },
      { x0: 0, y0: yf, x1: xw, y1: yf, thickness: tf, label: "flange_left" },
      { x0: xw, y0: yf, x1: w, y1: yf, thickness: tf, label: "flange_right" }
    ];
  }
  if (g.type === "angle") {
    const h = n(d.depth), w = n(d.width), t = n(d.thickness), hx = t / 2, hy = t / 2;
    return [
      { x0: hx, y0: hy, x1: hx, y1: h, thickness: t, label: "vertical_leg" },
      { x0: hx, y0: hy, x1: w, y1: hy, thickness: t, label: "horizontal_leg" }
    ];
  }
  if (g.type === "double_angle") {
    const h = n(d.depth), b = n(d.width), t = n(d.thickness), gap = n(d.distance);
    const leftHeel = b - t / 2, rightHeel = b + gap + t / 2, overallWidth = 2 * b + gap, yheel = t / 2;
    return [
      { x0: 0, y0: yheel, x1: leftHeel, y1: yheel, thickness: t, label: "left_toe" },
      { x0: leftHeel, y0: yheel, x1: leftHeel, y1: h, thickness: t, label: "left_web" },
      { x0: leftHeel, y0: yheel, x1: rightHeel, y1: yheel, thickness: 0, label: "ideal_rigid_heel_link" },
      { x0: rightHeel, y0: yheel, x1: rightHeel, y1: h, thickness: t, label: "right_web" },
      { x0: rightHeel, y0: yheel, x1: overallWidth, y1: yheel, thickness: t, label: "right_toe" }
    ];
  }
  throw calculationError("Open thin-wall model does not apply to this geometry.", { geometry_type: g.type });
}
function rhsSegments(g, scale) {
  const d = g.dimensions, w = d.width / scale, h = d.height / scale, t = d.thickness / scale;
  const left = t / 2, right = w - t / 2, bottom = t / 2, top = h - t / 2;
  return [
    { x0: left, y0: bottom, x1: right, y1: bottom, thickness: t, label: "bottom_wall" },
    { x0: right, y0: bottom, x1: right, y1: top, thickness: t, label: "right_wall" },
    { x0: right, y0: top, x1: left, y1: top, thickness: t, label: "top_wall" },
    { x0: left, y0: top, x1: left, y1: bottom, thickness: t, label: "left_wall" }
  ];
}
function segmentLength(segment) {
  return Math.hypot(segment.x1 - segment.x0, segment.y1 - segment.y0);
}
function pointKey(x, y) {
  return `${x},${y}`;
}
function lineProperties(segments) {
  const material = segments.filter((segment) => segment.thickness > 0);
  const area = fsum(material.map((segment) => segment.thickness * segmentLength(segment)));
  if (!Number.isFinite(area) || area <= 0) throw new ArithmeticError();
  const cx = fsum(material.map((s) => s.thickness * segmentLength(s) * (s.x0 + s.x1) / 2)) / area;
  const cy = fsum(material.map((s) => s.thickness * segmentLength(s) * (s.y0 + s.y1) / 2)) / area;
  const ix = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.y0 + s.y1) / 2 - cy) ** 2 + (s.y1 - s.y0) ** 2 / 12)));
  const iy = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.x0 + s.x1) / 2 - cx) ** 2 + (s.x1 - s.x0) ** 2 / 12)));
  const ixy = fsum(material.map((s) => s.thickness * segmentLength(s) * (((s.x0 + s.x1) / 2 - cx) * ((s.y0 + s.y1) / 2 - cy) + (s.x1 - s.x0) * (s.y1 - s.y0) / 12)));
  return { area, cx, cy, ix, iy, ixy };
}
function orientedTree(segments) {
  const adjacency = /* @__PURE__ */ new Map();
  segments.forEach((segment, index) => {
    const start = pointKey(segment.x0, segment.y0), end = pointKey(segment.x1, segment.y1);
    const fromStart = adjacency.get(start) || [];
    fromStart.push({ index, x: segment.x1, y: segment.y1 });
    adjacency.set(start, fromStart);
    const fromEnd = adjacency.get(end) || [];
    fromEnd.push({ index, x: segment.x0, y: segment.y0 });
    adjacency.set(end, fromEnd);
  });
  const roots = Array.from(adjacency.entries()).filter(([, edges]) => edges.length === 1);
  if (roots.length < 2) throw new ArithmeticError();
  const visitedNodes = /* @__PURE__ */ new Set([roots[0][0]]);
  const todo = [roots[0][0]];
  const result = [];
  while (todo.length) {
    const key = todo.pop();
    const [x, y] = key.split(",").map(Number);
    for (const edge of adjacency.get(key) || []) {
      const child = pointKey(edge.x, edge.y);
      if (visitedNodes.has(child)) continue;
      const original = segments[edge.index];
      result.push(pointKey(original.x0, original.y0) === key ? original : {
        ...original,
        x0: original.x1,
        y0: original.y1,
        x1: original.x0,
        y1: original.y0
      });
      visitedNodes.add(child);
      todo.push(child);
    }
  }
  if (result.length !== segments.length) throw new ArithmeticError();
  return result;
}
function flowCoefficients(segment, centroidX, centroidY, ix, iy, ixy, determinant, axis) {
  const length = segmentLength(segment), ux = (segment.x1 - segment.x0) / length, uy = (segment.y1 - segment.y0) / length;
  const derivative = (s) => {
    const x = segment.x0 + ux * s - centroidX, y = segment.y0 + uy * s - centroidY;
    return axis === "x" ? -segment.thickness * (ix * x - ixy * y) / determinant : -segment.thickness * (iy * y - ixy * x) / determinant;
  };
  const start = derivative(0), end = derivative(length);
  return [start, (end - start) / length, length];
}
function flowPolynomials(segments, centroidX, centroidY, ix, iy, ixy, axis, closed = false) {
  const determinant = ix * iy - ixy ** 2;
  if (!Number.isFinite(determinant) || determinant <= 0) throw new ArithmeticError();
  const ordered = closed ? segments : orientedTree(segments);
  const coefficients = ordered.map((segment) => flowCoefficients(segment, centroidX, centroidY, ix, iy, ixy, determinant, axis));
  const sources = coefficients.map(([start, slope, length]) => start * length + slope * length ** 2 / 2);
  const starts = Array(ordered.length).fill(0);
  if (!closed) {
    const startChildren = /* @__PURE__ */ new Map();
    ordered.forEach((segment, index) => {
      const key = pointKey(segment.x0, segment.y0), list = startChildren.get(key) || [];
      list.push(index);
      startChildren.set(key, list);
    });
    for (let i = ordered.length - 1; i >= 0; i--) {
      const endKey = pointKey(ordered[i].x1, ordered[i].y1);
      const children = (startChildren.get(endKey) || []).filter((child) => child > i);
      starts[i] = fsum(children.map((child) => starts[child])) - sources[i];
    }
    const endNodes = new Set(ordered.map((s) => pointKey(s.x1, s.y1)));
    const startRoots = new Set(ordered.map((s) => pointKey(s.x0, s.y0)).filter((key) => !endNodes.has(key)));
    if (startRoots.size !== 1) throw new ArithmeticError();
    const root = Array.from(startRoots)[0];
    const rootFlow = fsum(ordered.map((segment, index) => pointKey(segment.x0, segment.y0) === root ? starts[index] : 0));
    const balanceScale = Math.max(1, fsum(sources.map(Math.abs)));
    if (Math.abs(rootFlow) > 2e-10 * balanceScale) throw new ArithmeticError();
    return ordered.map((segment, index) => ({ segment, q0: starts[index], a: coefficients[index][0], b: coefficients[index][1] }));
  }
  for (let i = 1; i < ordered.length; i++) starts[i] = starts[i - 1] + sources[i - 1];
  if (Math.abs(starts[starts.length - 1] + sources[sources.length - 1]) > 2e-10) throw new ArithmeticError();
  const compatibility = fsum(ordered.map((segment, i) => {
    const [qDerivative, slope, length] = coefficients[i];
    return (starts[i] * length + qDerivative * length ** 2 / 2 + slope * length ** 3 / 6) / segment.thickness;
  }));
  const compliance = fsum(ordered.map((segment, i) => coefficients[i][2] / segment.thickness));
  const constant = -compatibility / compliance;
  return ordered.map((segment, index) => ({ segment, q0: starts[index] + constant, a: coefficients[index][0], b: coefficients[index][1] }));
}
function polynomialIntegrals(q0, a, b, length) {
  const qIntegral = q0 * length + a * length ** 2 / 2 + b * length ** 3 / 6;
  const coefficients = [q0, a, b / 2];
  const terms = [];
  coefficients.forEach((left, i) => coefficients.forEach((right, j) => terms.push(left * right * length ** (i + j + 1) / (i + j + 1))));
  return [qIntegral, fsum(terms)];
}
function flowResponse(flow, centroidX, centroidY) {
  const forceX = [], forceY = [], torque = [], energy = [];
  for (const item of flow) {
    const s = item.segment, length = segmentLength(s), ux = (s.x1 - s.x0) / length, uy = (s.y1 - s.y0) / length;
    const [qIntegral, q2Integral] = polynomialIntegrals(item.q0, item.a, item.b, length);
    forceX.push(qIntegral * ux);
    forceY.push(qIntegral * uy);
    torque.push(((s.x0 - centroidX) * uy - (s.y0 - centroidY) * ux) * qIntegral);
    if (s.thickness > 0) energy.push(q2Integral / s.thickness);
  }
  return { force_x: fsum(forceX), force_y: fsum(forceY), torque: fsum(torque), energy: fsum(energy) };
}
function sectorialProperties(segments, centroidX, centroidY, shearCenterX, shearCenterY, ix, iy, closed = false) {
  if (closed) {
    const length = fsum(segments.map(segmentLength));
    const twiceArea = Math.abs(fsum(segments.map((s) => s.x0 * s.y1 - s.x1 * s.y0)));
    const closureSlope = twiceArea / length;
    let cumulative = 0;
    const raw = segments.map((segment) => {
      const l = segmentLength(segment), ux = (segment.x1 - segment.x0) / l, uy = (segment.y1 - segment.y0) / l;
      const derivative = (segment.x0 - shearCenterX) * uy - (segment.y0 - shearCenterY) * ux - closureSlope;
      const item = { segment, start: cumulative, derivative, length: l };
      cumulative += derivative * l;
      return item;
    });
    const area = fsum(segments.map((s) => s.thickness * segmentLength(s)));
    const mean2 = fsum(raw.map((item) => item.segment.thickness * (item.start * item.length + item.derivative * item.length ** 2 / 2))) / area;
    const cw2 = fsum(raw.map((item) => {
      const base = item.start - mean2, l = item.length, slope = item.derivative;
      return item.segment.thickness * l * ((base + slope * l / 2) ** 2 + (slope * l) ** 2 / 12);
    }));
    return { value: cw2, diagnostics: { closure_slope: closureSlope, mean_sectorial_coordinate: mean2, orthogonality_x: 0, orthogonality_y: 0 } };
  }
  const ordered = orientedTree(segments), starts = [], derivatives = [];
  const nodeOmega = /* @__PURE__ */ new Map();
  for (const segment of ordered) {
    const startKey = pointKey(segment.x0, segment.y0), endKey = pointKey(segment.x1, segment.y1), l = segmentLength(segment);
    const ux = (segment.x1 - segment.x0) / l, uy = (segment.y1 - segment.y0) / l;
    const omegaStart = nodeOmega.get(startKey) || 0;
    const derivative = (segment.x0 - shearCenterX) * uy - (segment.y0 - shearCenterY) * ux;
    starts.push(omegaStart);
    derivatives.push(derivative);
    nodeOmega.set(endKey, omegaStart + derivative * l);
  }
  const lineArea = fsum(ordered.map((s) => s.thickness * segmentLength(s)));
  const mean = fsum(ordered.map((s, i) => s.thickness * (starts[i] * segmentLength(s) + derivatives[i] * segmentLength(s) ** 2 / 2))) / lineArea;
  const cwTerms = [], orthX = [], orthY = [];
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i], l = segmentLength(s), ux = (s.x1 - s.x0) / l, uy = (s.y1 - s.y0) / l;
    const base = starts[i] - mean, derivative = derivatives[i];
    cwTerms.push(s.thickness * l * ((base + derivative * l / 2) ** 2 + (derivative * l) ** 2 / 12));
    const xbase = s.x0 - centroidX, ybase = s.y0 - centroidY;
    orthX.push(s.thickness * (base * xbase * l + (base * ux + derivative * xbase) * l ** 2 / 2 + derivative * ux * l ** 3 / 3));
    orthY.push(s.thickness * (base * ybase * l + (base * uy + derivative * ybase) * l ** 2 / 2 + derivative * uy * l ** 3 / 3));
  }
  const cw = fsum(cwTerms);
  const omegaX = fsum(orthX), omegaY = fsum(orthY);
  if (cw === 0) return { value: cw, diagnostics: { mean_sectorial_coordinate: mean, orthogonality_x: null, orthogonality_y: null } };
  return {
    value: cw,
    diagnostics: {
      mean_sectorial_coordinate: mean,
      orthogonality_x: omegaX / Math.max(Math.sqrt(Math.abs(cw * iy)), 1e-300),
      orthogonality_y: omegaY / Math.max(Math.sqrt(Math.abs(cw * ix)), 1e-300)
    }
  };
}
function sectionWallMechanics(geometry, scale) {
  const closed = geometry.type === "rectangular_hollow";
  const walls = closed ? rhsSegments(geometry, scale) : orientedTree(wallSegments(geometry, scale));
  const line = lineProperties(walls);
  const flowX = flowPolynomials(walls, line.cx, line.cy, line.ix, line.iy, line.ixy, "x", closed);
  const flowY = flowPolynomials(walls, line.cx, line.cy, line.ix, line.iy, line.ixy, "y", closed);
  const responseX = flowResponse(flowX, line.cx, line.cy), responseY = flowResponse(flowY, line.cx, line.cy);
  const pole = closed ? { x: line.cx, y: line.cy } : { x: line.cx + responseY.torque, y: line.cy - responseX.torque };
  const lengths = walls.map(segmentLength);
  const closureSlope = closed ? Math.abs(fsum(walls.map((s) => s.x0 * s.y1 - s.x1 * s.y0))) / fsum(lengths) : 0;
  const nodeOmega = /* @__PURE__ */ new Map();
  let cumulative = 0;
  const zeroWarping = geometry.type === "angle" || geometry.type === "tee" || closed && geometry.dimensions.width === geometry.dimensions.height;
  const raw = walls.map((wall, index) => {
    const length = lengths[index], ux = (wall.x1 - wall.x0) / length, uy = (wall.y1 - wall.y0) / length;
    const start = closed ? cumulative : nodeOmega.get(pointKey(wall.x0, wall.y0)) ?? 0;
    const derivative = (wall.x0 - pole.x) * uy - (wall.y0 - pole.y) * ux - closureSlope;
    cumulative = start + derivative * length;
    nodeOmega.set(pointKey(wall.x1, wall.y1), cumulative);
    return { wall, length, start, derivative };
  });
  const mean = fsum(raw.map((s) => s.wall.thickness * s.length * (s.start + s.derivative * s.length / 2))) / line.area;
  const warping = raw.map((s) => ({ ...s, start: zeroWarping ? 0 : s.start - mean, derivative: zeroWarping ? 0 : s.derivative }));
  return { walls, line, pole, flowX, flowY, responseX, responseY, warping, closed };
}
function rectangleWarpingConstant(width, height) {
  const a = Math.max(width, height) / 2, b = Math.min(width, height) / 2;
  const method = "solid_rectangle_fourier_warping_norm";
  const stableFactor = (z) => {
    if (z < 1e-3) {
      const z2 = z * z;
      return z * z2 * (2 / 3 + z2 * (-8 / 15 + z2 * (34 / 105)));
    }
    if (z > 350) return 1;
    const c = Math.cosh(z);
    return Math.tanh(z) - z / (c * c);
  };
  let value = 0, absoluteTailBound = Infinity, roundoffEstimate = Infinity, used = 0;
  for (const terms of [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536]) {
    try {
      const ks = Array.from({ length: terms }, (_, n) => (n + 0.5) * Math.PI / b);
      const ls = Array.from({ length: terms }, (_, m) => (m + 0.5) * Math.PI / a);
      if (ks.some((k) => !Number.isFinite(k ** 7)) || ls.some((l) => !Number.isFinite(l ** 7))) {
        return { value: null, diagnostics: { method, terms, status: "numerical_range" } };
      }
      const u = 4 / b * fsum(ks.map((k) => stableFactor(k * a) / k ** 7));
      const v = 4 / a * fsum(ls.map((l) => stableFactor(l * b) / l ** 7));
      const cross = -32 / (a * b) * fsum(ks.map((k) => {
        const z = a * k, sech2 = z > 350 ? 0 : 1 / Math.cosh(z) ** 2;
        return a * a / (4 * k ** 6) * (2 + sech2) - 3 * a * Math.tanh(z) / (4 * k ** 7);
      }));
      value = fsum([u, v, cross]);
      const denominator = Math.max(terms - 0.5, 0.5);
      const uTail = 4 * b ** 6 / (6 * Math.PI ** 7 * denominator ** 6);
      const vTail = 4 * a ** 6 / (6 * Math.PI ** 7 * denominator ** 6);
      const crossTail = 16 * a / b * (b / Math.PI) ** 6 / (5 * denominator ** 5);
      absoluteTailBound = fsum([uTail, vTail, crossTail]);
      roundoffEstimate = 64 * Number.EPSILON * fsum([Math.abs(u), Math.abs(v), Math.abs(cross)]);
    } catch {
      return { value: null, diagnostics: { method, terms_per_axis: terms, status: "numerical_range" } };
    }
    used = terms;
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(absoluteTailBound)) {
      return { value: null, diagnostics: { method, terms_per_axis: terms, status: "numerical_range" } };
    }
    const relativeBound2 = (absoluteTailBound + roundoffEstimate) / value;
    if (relativeBound2 <= 1e-10) {
      return { value, diagnostics: { method, terms_per_axis: terms, absolute_tail_bound: absoluteTailBound, floating_point_abs_error_estimate: roundoffEstimate, relative_error_bound_with_roundoff_estimate: relativeBound2, relative_tolerance: 1e-10, converged: true } };
    }
  }
  const relativeBound = value > 0 ? (absoluteTailBound + roundoffEstimate) / value : Infinity;
  return { value: null, diagnostics: { method, terms_per_axis: used, absolute_tail_bound: absoluteTailBound, floating_point_abs_error_estimate: roundoffEstimate, relative_error_bound_with_roundoff_estimate: relativeBound, relative_tolerance: 1e-10, converged: false } };
}
function centerProperty(x, y, centroidX, centroidY, method) {
  const values = [x, y, x - centroidX, y - centroidY];
  if (!values.every(Number.isFinite)) return unavailable("numerical_range");
  return { status: "computed", value: { x, y, offset_x: x - centroidX, offset_y: y - centroidY }, reason: null, method };
}
function centerPropertyWithOffsets(x, y, offsetX, offsetY, method) {
  if (![x, y, offsetX, offsetY].every(Number.isFinite)) return unavailable("numerical_range");
  return { status: "computed", value: { x, y, offset_x: offsetX, offset_y: offsetY }, reason: null, method };
}
function iSectionCenter(d) {
  const dec = (value) => new Decimal80(String(value));
  const h = dec(d.depth), bt = dec(d.top_flange_width), bb = dec(d.bottom_flange_width);
  const tw = dec(d.web_thickness), tt = dec(d.top_flange_thickness), tb = dec(d.bottom_flange_thickness);
  const webHeight = h.minus(tt).minus(tb), yb = tb.div(2), yt = h.minus(tt.div(2));
  const bottomArea = bb.times(tb), webArea = tw.times(webHeight), topArea = bt.times(tt);
  const grossArea = bottomArea.plus(webArea).plus(topArea);
  const grossY = bottomArea.times(yb).plus(webArea.times(tb.plus(webHeight.div(2)))).plus(topArea.times(yt)).div(grossArea);
  const iyBottom = tb.times(bb.pow(3)).div(12), iyTop = tt.times(bt.pow(3)).div(12);
  const centerY = iyBottom.times(yb).plus(iyTop.times(yt)).div(iyBottom.plus(iyTop));
  return [Decimal80.max(bt, bb).div(2).toNumber(), centerY.toNumber(), centerY.minus(grossY).toNumber()];
}
function scalarProperty(value, method) {
  if (value === null) return unavailable("numerical_range");
  return { status: "computed", value, reason: null, method };
}
function shearAreaProperty(x, y, method) {
  if (x === null || y === null) return unavailable("numerical_range");
  return { status: "computed", value: { x, y }, reason: null, method };
}
function advancedModel(geometry, width, height, centroidX, centroidY, options) {
  const scale = Math.max(width, height), wn = width / scale, hn = height / scale;
  const needed = new Set(options.required_properties);
  if (options.include_advanced) for (const property of REQUIRED_PROPERTIES) needed.add(property);
  const properties = {
    torsion_constant_j: unavailable("not_requested"),
    warping_constant_cw: unavailable("not_requested"),
    shear_center: unavailable("not_requested"),
    effective_shear_area: unavailable("not_requested")
  };
  if (!needed.size) return { properties, diagnostics: { status: "not_requested", model: "advanced_properties_not_requested", assumptions: [] } };
  const rangeFailures = [];
  let diag;
  let assumptions;
  if (geometry.type === "rectangle") {
    const d = geometry.dimensions, scx = wn / 2, scy = hn / 2;
    let torsion = null;
    let torsionDiagnostics;
    if (needed.has("torsion_constant_j")) {
      torsion = rectangleTorsion(wn, hn, options.rectangle_j_relative_tolerance, options.rectangle_j_max_terms);
      torsionDiagnostics = { ...torsion.diagnostics };
      for (const key of ["truncation_abs_error_bound", "floating_point_abs_error_estimate"]) {
        const value2 = torsionDiagnostics[key];
        if (typeof value2 === "number") torsionDiagnostics[key] = rescaleDimensionless(value2, scale, 4);
      }
      if (!torsion.converged && options.required_properties.includes("torsion_constant_j")) {
        throw calculationError("Required rectangle torsion did not meet the requested tolerance.", {
          property: "torsion_constant_j",
          reason: torsion.reason,
          ...torsionDiagnostics
        });
      }
      const value = torsion.value === null ? null : rescaleDimensionless(torsion.value, scale, 4);
      properties.torsion_constant_j = value === null ? unavailable(torsion.reason || "numerical_range") : { status: "computed", value, reason: null, method: "solid_rectangle_saint_venant_odd_series" };
      if (properties.torsion_constant_j.status !== "computed") rangeFailures.push("torsion_constant_j");
    } else {
      torsionDiagnostics = { method: "solid_rectangle_saint_venant_odd_series", status: "not_requested" };
    }
    let warpingDiagnostics = null;
    if (needed.has("warping_constant_cw")) {
      const cw = rectangleWarpingConstant(wn, hn);
      warpingDiagnostics = cw.diagnostics;
      const value = cw.value === null ? null : rescaleDimensionless(cw.value, scale, 6);
      properties.warping_constant_cw = value === null ? unavailable(cw.diagnostics.converged === false ? "convergence_not_achieved" : "numerical_range") : { status: "computed", value, reason: null, method: "solid_rectangle_saint_venant_fourier" };
      if (properties.warping_constant_cw.status !== "computed") rangeFailures.push("warping_constant_cw");
    } else {
    }
    if (needed.has("shear_center")) properties.shear_center = centerProperty(scx * scale, scy * scale, centroidX, centroidY, "geometric_symmetry");
    if (needed.has("effective_shear_area")) {
      const area = rescaleDimensionless(wn * hn * 5 / 6, scale, 2);
      properties.effective_shear_area = shearAreaProperty(area, area, "jourawski_rectangle_five_sixths_area");
      if (properties.effective_shear_area.status !== "computed") rangeFailures.push("effective_shear_area");
    }
    diag = { model: "solid_rectangle", torsion: torsionDiagnostics };
    if (warpingDiagnostics) diag.warping = warpingDiagnostics;
    assumptions = ["homogeneous_isotropic_geometry_only", "rectangle_shear_area_uses_jourawski_five_sixths_convention"];
  } else if (geometry.type === "circle") {
    const diameter = geometry.dimensions.diameter / scale;
    if (needed.has("torsion_constant_j")) properties.torsion_constant_j = scalarProperty(rescaleDimensionless(Math.PI * diameter ** 4 / 32, scale, 4), "solid_circle_closed_form");
    if (needed.has("warping_constant_cw")) properties.warping_constant_cw = { status: "computed", value: 0, reason: null, method: "axisymmetric_zero_warping" };
    if (needed.has("shear_center")) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, "axisymmetric_centroid");
    if (needed.has("effective_shear_area")) {
      const area = rescaleDimensionless(Math.PI * diameter ** 2 / 4 * 0.9, scale, 2);
      properties.effective_shear_area = shearAreaProperty(area, area, "solid_circle_geometric_nine_tenths_area");
      if (properties.effective_shear_area.status !== "computed") rangeFailures.push("effective_shear_area");
    }
    diag = { model: "solid_circle", warping: { method: "axisymmetric_zero_warping" } };
    assumptions = ["homogeneous_isotropic_geometry_only", "solid_circle_effective_shear_area_uses_geometric_nine_tenths_area_convention"];
  } else if (geometry.type === "circular_hollow") {
    const d = geometry.dimensions.diameter / scale, t = geometry.dimensions.thickness / scale;
    if (needed.has("torsion_constant_j")) {
      const j = rescaleDimensionless(Math.PI * t * (d - t) * (d ** 2 + (d - 2 * t) ** 2) / 8, scale, 4);
      properties.torsion_constant_j = scalarProperty(j, "circular_hollow_exact_polar_moment");
      if (properties.torsion_constant_j.status !== "computed") rangeFailures.push("torsion_constant_j");
    }
    if (needed.has("warping_constant_cw")) properties.warping_constant_cw = { status: "computed", value: 0, reason: null, method: "axisymmetric_zero_warping" };
    if (needed.has("shear_center")) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, "axisymmetric_centroid");
    if (needed.has("effective_shear_area")) {
      const area = rescaleDimensionless(Math.PI * (d - t) / 2 * t, scale, 2);
      properties.effective_shear_area = shearAreaProperty(area, area, "circular_hollow_thin_wall_shear_flow");
      if (properties.effective_shear_area.status !== "computed") rangeFailures.push("effective_shear_area");
    }
    diag = { model: "uniform_wall_circular", warping: { method: "axisymmetric_zero_warping" }, effective_shear_area: { formula: "pi*R_m*t" } };
    assumptions = ["circular_closed_form_geometry", "thin_wall_shear_energy_uses_median_radius"];
  } else if (geometry.type === "rectangular_hollow") {
    const t = geometry.dimensions.thickness / scale, segments = rhsSegments(geometry, scale);
    const bw = wn - t, bh = hn - t, medianArea = bw * bh, medianPerimeter = 2 * (bw + bh);
    const line = lineProperties(segments), jdim = 4 * medianArea ** 2 / (medianPerimeter / t);
    if (needed.has("torsion_constant_j")) {
      properties.torsion_constant_j = scalarProperty(rescaleDimensionless(jdim, scale, 4), "single_cell_bredt_thin_wall");
      if (properties.torsion_constant_j.status !== "computed") rangeFailures.push("torsion_constant_j");
    }
    if (needed.has("shear_center")) properties.shear_center = centerProperty(width / 2, height / 2, centroidX, centroidY, "closed_cell_shear_flow_symmetry");
    let sectorial = null;
    if (needed.has("warping_constant_cw")) {
      sectorial = sectorialProperties(segments, wn / 2, hn / 2, wn / 2, hn / 2, 1, 1, true);
      const cwDimensionless = geometry.dimensions.width === geometry.dimensions.height ? 0 : sectorial.value;
      const cw = rescaleDimensionless(Math.max(cwDimensionless, 0), scale, 6, true);
      properties.warping_constant_cw = scalarProperty(cw, "closed_section_sectorial_thin_wall");
      if (properties.warping_constant_cw.status !== "computed") rangeFailures.push("warping_constant_cw");
    }
    let flowResponses = null;
    if (needed.has("effective_shear_area")) {
      const fx = flowResponse(flowPolynomials(segments, line.cx, line.cy, line.ix, line.iy, line.ixy, "x", true), line.cx, line.cy);
      const fy = flowResponse(flowPolynomials(segments, line.cx, line.cy, line.ix, line.iy, line.ixy, "y", true), line.cx, line.cy);
      flowResponses = { x: fx, y: fy };
      const ax = rescaleDimensionless(1 / fx.energy, scale, 2), ay = rescaleDimensionless(1 / fy.energy, scale, 2);
      properties.effective_shear_area = shearAreaProperty(ax, ay, "closed_cell_thin_wall_shear_energy");
      if (properties.effective_shear_area.status !== "computed") rangeFailures.push("effective_shear_area");
    }
    diag = {
      model: "sharp_corner_closed_cell_centerline_thin_wall",
      median_cell_area: medianArea,
      median_perimeter: medianPerimeter,
      line_area: line.area,
      line_centroid: { x: line.cx, y: line.cy },
      line_inertias: { ix: line.ix, iy: line.iy, ixy: line.ixy },
      sectorial: sectorial?.diagnostics || {}
    };
    if (flowResponses) diag.unit_shear_responses = flowResponses;
    assumptions = ["sharp_corner_uniform_thickness_median_line", "single_cell_bredt_torsion", "closed_cell_shear_flow_uses_zero_twist_compatibility", "no_corner_radii_or_thick_wall_elasticity"];
  } else {
    const segments = wallSegments(geometry, scale), ordered = orientedTree(segments), line = lineProperties(ordered);
    if (![line.area, line.ix, line.iy].every((value) => Number.isFinite(value) && value > 0)) throw new ArithmeticError();
    const needsFlow = ["warping_constant_cw", "shear_center", "effective_shear_area"].some((key) => needed.has(key));
    let responseX = null, responseY = null;
    let flowScx = line.cx, flowScy = line.cy;
    if (needsFlow) {
      responseX = flowResponse(flowPolynomials(ordered, line.cx, line.cy, line.ix, line.iy, line.ixy, "x"), line.cx, line.cy);
      responseY = flowResponse(flowPolynomials(ordered, line.cx, line.cy, line.ix, line.iy, line.ixy, "y"), line.cx, line.cy);
      flowScx = line.cx + responseY.torque;
      flowScy = line.cy - responseX.torque;
    }
    if (needed.has("torsion_constant_j")) {
      const jdim = fsum(ordered.filter((s) => s.thickness > 0).map((s) => segmentLength(s) * s.thickness ** 3 / 3));
      properties.torsion_constant_j = scalarProperty(rescaleDimensionless(jdim, scale, 4), "open_section_thin_wall_j");
      if (properties.torsion_constant_j.status !== "computed") rangeFailures.push("torsion_constant_j");
    }
    if (needed.has("shear_center")) {
      if (geometry.type === "i_section") {
        const [x, y, offsetY] = iSectionCenter(geometry.dimensions);
        properties.shear_center = centerPropertyWithOffsets(x, y, 0, offsetY, "open_section_shear_flow");
      } else if (geometry.type === "channel") {
        const x = flowScx * scale;
        properties.shear_center = centerPropertyWithOffsets(x, height / 2, x - centroidX, 0, "open_section_shear_flow");
      } else if (geometry.type === "tee" || geometry.type === "double_angle") {
        const y = flowScy * scale;
        properties.shear_center = centerPropertyWithOffsets(width / 2, y, 0, y - centroidY, "open_section_shear_flow");
      } else {
        properties.shear_center = centerProperty(flowScx * scale, flowScy * scale, centroidX, centroidY, "open_section_shear_flow");
      }
    }
    if (needed.has("effective_shear_area")) {
      const ax = rescaleDimensionless(1 / responseX.energy, scale, 2), ay = rescaleDimensionless(1 / responseY.energy, scale, 2);
      properties.effective_shear_area = shearAreaProperty(ax, ay, "open_section_thin_wall_shear_energy");
      if (properties.effective_shear_area.status !== "computed") rangeFailures.push("effective_shear_area");
    }
    let orthogonality = {};
    if (needed.has("warping_constant_cw")) {
      let sectorial = sectorialProperties(ordered, line.cx, line.cy, flowScx, flowScy, line.ix, line.iy);
      if (geometry.type === "tee" || geometry.type === "angle") {
        sectorial = { value: 0, diagnostics: { mean_sectorial_coordinate: sectorial.diagnostics.mean_sectorial_coordinate, orthogonality_x: null, orthogonality_y: null } };
      }
      orthogonality = sectorial.diagnostics;
      const cw = rescaleDimensionless(sectorial.value, scale, 6, true);
      properties.warping_constant_cw = scalarProperty(cw, "open_section_sectorial_thin_wall");
      if (properties.warping_constant_cw.status !== "computed") rangeFailures.push("warping_constant_cw");
    }
    diag = {
      model: "centerline_open_thin_wall",
      line_area: line.area,
      line_centroid: { x: line.cx, y: line.cy },
      line_inertias: { ix: line.ix, iy: line.iy, ixy: line.ixy }
    };
    if (needsFlow) diag.unit_shear_responses = { x: responseX, y: responseY };
    if (needed.has("warping_constant_cw")) diag.sectorial_orthogonality = orthogonality;
    assumptions = geometry.type === "double_angle" ? ["open_section_centerline_thin_wall", "uniform_thickness_on_each_wall", "ideal_rigid_link_has_no_area_j_or_shear_energy", "two_mirrored_angles_share_equal_twist", "rigid_heel_link_transfers_reaction_flow_without_area_or_energy", "zero_clear_gap_does_not_create_a_continuous_welded_web"] : ["open_section_centerline_thin_wall", "uniform_thickness_on_each_wall", "no_fillet_or_finite_wall_elasticity"];
  }
  for (const name of options.required_properties) {
    const property = properties[name];
    if (property.status !== "computed") throw calculationError("A required advanced property is outside the numerical range.", { property: name, reason: property.reason || "numerical_range" });
  }
  const diagnostics = {
    status: rangeFailures.length ? "partial" : "computed",
    model: diag.model,
    assumptions,
    range_failures: rangeFailures,
    normalization_length_mm: scale,
    normalized_geometry_diagnostics: true,
    ...Object.fromEntries(Object.entries(diag).filter(([key]) => key !== "model"))
  };
  if (properties.torsion_constant_j.status !== "not_computed" || properties.torsion_constant_j.reason !== "not_requested") diagnostics.torsion_method = properties.torsion_constant_j.method;
  if (properties.warping_constant_cw.status !== "not_computed" || properties.warping_constant_cw.reason !== "not_requested") diagnostics.warping_method = properties.warping_constant_cw.method;
  if (properties.shear_center.status !== "not_computed" || properties.shear_center.reason !== "not_requested") diagnostics.shear_center_method = properties.shear_center.method;
  if (properties.effective_shear_area.status !== "not_computed" || properties.effective_shear_area.reason !== "not_requested") diagnostics.effective_shear_area_method = properties.effective_shear_area.method;
  return { properties, diagnostics };
}
var ArithmeticError = class extends Error {
};
function unavailable(reason) {
  return { status: "not_computed", value: null, reason, method: null };
}
function assertFiniteTree(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(assertFiniteTree);
  if (isRecord(value)) return Object.values(value).every(assertFiniteTree);
  return true;
}
function calculateCoreValues(request) {
  const { geometry, options } = validateRequest(request);
  try {
    let width, height, area, perimeter, centroidX, centroidY, ix, iy, ixy = 0;
    let plastic = null;
    const intermediates = {};
    const diagnostics = { plastic: { status: "not_computed", reason: "not_requested" } };
    let geometryComponents = null;
    const d = geometry.dimensions;
    if (geometry.type === "rectangle") {
      width = d.width;
      height = d.height;
      area = width * height;
      centroidX = width / 2;
      centroidY = height / 2;
      perimeter = 2 * (width + height);
      ix = width * height ** 3 / 12;
      iy = height * width ** 3 / 12;
      if (options.include_plastic) {
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: width * height ** 2 / 4, zy: height * width ** 2 / 4 };
        diagnostics.plastic = { status: "computed", method: "symmetric_closed_form", relative_area_imbalance: 0 };
      }
    } else if (geometry.type === "circle") {
      width = d.diameter;
      height = d.diameter;
      area = Math.PI * width ** 2 / 4;
      centroidX = width / 2;
      centroidY = height / 2;
      perimeter = Math.PI * width;
      ix = Math.PI * width ** 4 / 64;
      iy = ix;
      if (options.include_plastic) {
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: width ** 3 / 6, zy: width ** 3 / 6 };
        diagnostics.plastic = { status: "computed", method: "symmetric_closed_form", relative_area_imbalance: 0 };
      }
    } else if (geometry.type === "circular_hollow") {
      width = d.diameter;
      height = d.diameter;
      const innerDiameter = width - 2 * d.thickness;
      area = Math.PI * d.thickness * (width - d.thickness);
      centroidX = width / 2;
      centroidY = height / 2;
      perimeter = Math.PI * (width + innerDiameter);
      ix = area * (width ** 2 + innerDiameter ** 2) / 16;
      iy = ix;
      if (options.include_plastic) {
        const plasticZ = 2 * d.thickness * (width ** 2 + width * innerDiameter + innerDiameter ** 2) / 6;
        plastic = { pna_x: centroidX, pna_y: centroidY, zx: plasticZ, zy: plasticZ };
        diagnostics.plastic = { status: "computed", method: "annulus_symmetric_closed_form", relative_area_imbalance: 0 };
      }
    } else {
      const parts = components(geometry);
      geometryComponents = parts;
      if (geometry.type === "i_section") width = Math.max(d.top_flange_width, d.bottom_flange_width);
      else if (geometry.type === "rectangular_hollow") width = d.width;
      else if (geometry.type === "double_angle") width = 2 * d.width + d.distance;
      else width = d.width;
      height = geometry.type === "rectangular_hollow" ? d.height : d.depth;
      area = fsum(parts.map((part) => part.area));
      if (!Number.isFinite(area) || area <= 0) throw new ArithmeticError();
      centroidX = geometry.type === "i_section" ? width / 2 : fsum(parts.map((part) => part.area * (part.x + part.width / 2))) / area;
      centroidY = fsum(parts.map((part) => part.area * (part.y + part.height / 2))) / area;
      ix = fsum(parts.map((part) => part.width * part.height ** 3 / 12 + part.area * (part.y + part.height / 2 - centroidY) ** 2));
      iy = fsum(parts.map((part) => part.height * part.width ** 3 / 12 + part.area * (part.x + part.width / 2 - centroidX) ** 2));
      ixy = fsum(parts.map((part) => part.area * (part.x + part.width / 2 - centroidX) * (part.y + part.height / 2 - centroidY)));
      if (geometry.type !== "angle") ixy = 0;
      if (geometry.type === "i_section") {
        perimeter = 2 * (d.top_flange_width + d.bottom_flange_width + height - d.web_thickness);
        intermediates.web_clear_depth = parts[1].height;
        intermediates.bottom_flange_area = parts[0].area;
        intermediates.web_area = parts[1].area;
        intermediates.top_flange_area = parts[2].area;
      } else if (geometry.type === "rectangular_hollow") {
        const innerWidth = width - 2 * d.thickness;
        const innerHeight = height - 2 * d.thickness;
        perimeter = 2 * (width + height) + 2 * (innerWidth + innerHeight);
        intermediates.inner_width = innerWidth;
        intermediates.inner_height = innerHeight;
        intermediates.wall_thickness = d.thickness;
      } else if (geometry.type === "channel") {
        perimeter = 2 * height + 4 * width - 2 * d.web_thickness;
        intermediates.clear_web_depth = parts[1].height;
        intermediates.web_area = parts[1].area;
        intermediates.flange_area_each = parts[0].area;
      } else if (geometry.type === "tee") {
        perimeter = 2 * (width + height);
        intermediates.clear_web_depth = parts[0].height;
        intermediates.web_area = parts[0].area;
        intermediates.flange_area = parts[1].area;
      } else if (geometry.type === "double_angle") {
        perimeter = 4 * (d.width + d.depth) - (d.distance === 0 ? 2 * d.depth : 0);
        intermediates.overall_width = width;
        intermediates.clear_distance = d.distance;
        intermediates.clear_vertical_leg_depth = parts[1].height;
        intermediates.horizontal_leg_area_each = parts[0].area;
        intermediates.vertical_leg_area_each = parts[1].area;
      } else {
        perimeter = 2 * (width + height);
        intermediates.clear_vertical_leg_depth = parts[1].height;
        intermediates.horizontal_leg_area = parts[0].area;
        intermediates.vertical_leg_area = parts[1].area;
      }
      if (options.include_plastic) {
        if (geometry.type === "i_section") {
          const axis = decimalPlasticAxis(geometry);
          const pnaX = width / 2;
          const zy = fsum(parts.map((part) => part.height * part.width ** 2 / 4));
          plastic = { pna_x: pnaX, pna_y: axis.pna, zx: axis.zx, zy };
          intermediates.pna_x = pnaX;
          intermediates.pna_y = axis.pna;
          diagnostics.plastic = { status: "computed", ...axis.diagnostics };
        } else {
          const xAxis = decimalPlasticAxisForComponents(parts, "x");
          const yAxis = decimalPlasticAxisForComponents(parts, "y");
          plastic = { pna_x: xAxis.pna, pna_y: yAxis.pna, zx: yAxis.z, zy: xAxis.z };
          intermediates.pna_x = xAxis.pna;
          intermediates.pna_y = yAxis.pna;
          diagnostics.plastic = {
            status: "computed",
            method: "component_area_bisection_with_piecewise_linear_refinement",
            x_axis: xAxis.diagnostics,
            y_axis: yAxis.diagnostics
          };
        }
      }
    }
    if (![area, ix, iy].every((value) => Number.isFinite(value) && value > 0)) throw new ArithmeticError();
    if (!Number.isFinite(perimeter) || perimeter <= 0 || !Number.isFinite(ixy)) throw new ArithmeticError();
    if (!(centroidX > 0 && centroidX < width && centroidY > 0 && centroidY < height)) throw new ArithmeticError();
    const elastic = {
      ix,
      iy,
      ixy,
      sx_positive: ix / (height - centroidY),
      sx_negative: ix / centroidY,
      sy_positive: iy / (width - centroidX),
      sy_negative: iy / centroidX,
      rx: Math.sqrt(ix / area),
      ry: Math.sqrt(iy / area)
    };
    const principal = principalProperties(ix, iy, ixy);
    const advancedModelResult = advancedModel(geometry, width, height, centroidX, centroidY, options);
    diagnostics.advanced_model = advancedModelResult.diagnostics;
    if (geometryComponents) diagnostics.components = geometryComponents;
    const advancedTorsion = advancedModelResult.diagnostics.torsion;
    if (isRecord(advancedTorsion) && advancedTorsion.status !== "not_requested") diagnostics.torsion = advancedTorsion;
    const result = {
      schema_version: "1.0",
      geometry_model_version: GEOMETRY_MODEL_VERSION,
      geometry_type: geometry.type,
      geometry_hash: geometryHash(geometry),
      solver: { method: "analytical", version: SOLVER_VERSION, config_hash: configHash(options) },
      units: { length: "mm", area: "mm2", section_modulus: "mm3", second_moment: "mm4", torsion_constant: "mm4", warping_constant: "mm6", shear_center: "mm", effective_shear_area: "mm2", angle: "deg" },
      normalized_input: { geometry, units: "mm", options },
      properties: {
        geometric: { area, perimeter, centroid_x: centroidX, centroid_y: centroidY },
        elastic,
        plastic,
        principal
      },
      advanced: advancedModelResult.properties,
      diagnostics: {
        ...diagnostics,
        intermediate: intermediates,
        bounding_box: { x_min: 0, y_min: 0, x_max: width, y_max: height },
        assumptions: ["dimensions_in_mm", "xy_plane_x_right_y_up", "bbox_origin_bottom_left", "centroidal_unrotated_inertias", "positive_coordinate_product_ixy", "sharp_corners", "homogeneous_geometric_plastic_properties"]
      },
      status: "success"
    };
    if (!assertFiniteTree(result)) throw new ArithmeticError();
    return result;
  } catch (error) {
    if (error instanceof DemoCalculationError) throw error;
    if (error instanceof ArithmeticError || error instanceof RangeError || error instanceof Error && error.message.startsWith("[DecimalError]")) {
      throw calculationError("Calculation cannot produce finite, positive properties at this numerical scale.", { reason: "floating_point_range" });
    }
    throw error;
  }
}
async function calculateDemoSection(request) {
  return calculateCoreValues(request);
}

// ../../section-properties/section-registry.json
var section_registry_default = {
  schema_version: "1.0",
  library_version: "1.1.0",
  geometry_model_version: "1.0.0",
  canonical_units: "mm",
  coordinate_system: {
    origin: "bounding_box_lower_left",
    x: "right",
    y: "up",
    ixy: "positive_coordinate_product",
    principal_angle: "counterclockwise_from_x_modulo_180",
    advanced_flow_convention: "xc\u2113,yc\u2113 and Ix\u2113,Iy\u2113,Ixy\u2113 are median-wall area centroid/inertias; unit-force q gradients and torque use those centroidal coordinates. Sectorial warping uses the shear-center pole. Offsets use the gross centroid. Normalized diagnostic wall data are scaled by normalization_length_mm; returned properties and formula dimensions are physical mm powers.",
    component_convention: "Nonoverlapping material rectangles; x_i,y_i in stored components are lower-left corners, centroid x_i+b_i/2,y_i+h_i/2; A_i=b_i*h_i and intrinsic product inertia=0. Principal u follows major-inertia axis, v is its counterclockwise perpendicular; X=x-xbar,Y=y-ybar. Indeterminate principal bases use reference u=X,v=Y, explicitly nonunique.",
    mechanical_moment_convention: "Normal stress tensile positive; generalized Mx=integral(Y*sigma)dA and My=integral(X*sigma)dA. Other physical/member moment sign conventions require an explicit adapter."
  },
  dimensions: {
    width: {
      symbol: "b",
      name_en: "Width",
      name_vi: "B\u1EC1 r\u1ED9ng",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    height: {
      symbol: "h",
      name_en: "Height",
      name_vi: "Chi\u1EC1u cao",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false,
      catalog_key: "depth"
    },
    depth: {
      symbol: "h",
      name_en: "Depth",
      name_vi: "Chi\u1EC1u cao",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    diameter: {
      symbol: "D",
      name_en: "Diameter",
      name_vi: "\u0110\u01B0\u1EDDng k\xEDnh",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    thickness: {
      symbol: "t",
      name_en: "Thickness",
      name_vi: "B\u1EC1 d\xE0y",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    web_thickness: {
      symbol: "tw",
      name_en: "Web thickness",
      name_vi: "B\u1EC1 d\xE0y b\u1EE5ng",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    flange_thickness: {
      symbol: "tf",
      name_en: "Flange thickness",
      name_vi: "B\u1EC1 d\xE0y c\xE1nh",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    top_flange_width: {
      symbol: "bt",
      name_en: "Top flange width",
      name_vi: "B\u1EC1 r\u1ED9ng c\xE1nh tr\xEAn",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    bottom_flange_width: {
      symbol: "bb",
      name_en: "Bottom flange width",
      name_vi: "B\u1EC1 r\u1ED9ng c\xE1nh d\u01B0\u1EDBi",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    top_flange_thickness: {
      symbol: "tt",
      name_en: "Top flange thickness",
      name_vi: "B\u1EC1 d\xE0y c\xE1nh tr\xEAn",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    bottom_flange_thickness: {
      symbol: "tb",
      name_en: "Bottom flange thickness",
      name_vi: "B\u1EC1 d\xE0y c\xE1nh d\u01B0\u1EDBi",
      unit: "mm",
      minimum: 1e-3,
      allow_zero: false
    },
    distance: {
      symbol: "g",
      name_en: "Clear distance between angle backs",
      name_vi: "Kho\u1EA3ng h\u1EDF gi\u1EEFa hai m\u1EB7t l\u01B0ng",
      unit: "mm",
      minimum: 0,
      allow_zero: true
    }
  },
  profiles: [
    {
      id: "rectangle",
      geometry_type: "rectangle",
      catalog_shape: "rectangle",
      label: "RECTANGLE",
      name_en: "RECTANGLE",
      name_vi: "RECTANGLE",
      geometry_variant: "solid",
      dimensions: [
        "width",
        "height"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        width: "width",
        height: "height"
      }
    },
    {
      id: "circle",
      geometry_type: "circle",
      catalog_shape: "circle",
      label: "CIRCLE",
      name_en: "CIRCLE",
      name_vi: "CIRCLE",
      geometry_variant: "solid",
      dimensions: [
        "diameter"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        diameter: "diameter"
      }
    },
    {
      id: "chs",
      geometry_type: "circular_hollow",
      catalog_shape: "circular_hollow",
      label: "CHS",
      name_en: "CHS",
      name_vi: "CHS",
      geometry_variant: "uniform_wall",
      dimensions: [
        "diameter",
        "thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        diameter: "diameter",
        thickness: "thickness"
      }
    },
    {
      id: "shs_rhs",
      geometry_type: "rectangular_hollow",
      catalog_shape: "rectangular_hollow",
      label: "SHS/RHS",
      name_en: "SHS/RHS",
      name_vi: "SHS/RHS",
      geometry_variant: "sharp_corner",
      dimensions: [
        "width",
        "height",
        "thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        width: "width",
        height: "height",
        thickness: "thickness"
      }
    },
    {
      id: "symmetric_i",
      geometry_type: "i_section",
      catalog_shape: "i",
      label: "SYMMETRIC I/H",
      name_en: "SYMMETRIC I/H",
      name_vi: "SYMMETRIC I/H",
      geometry_variant: "sharp_corner",
      dimensions: [
        "depth",
        "width",
        "web_thickness",
        "flange_thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        top_flange_width: "width",
        bottom_flange_width: "width",
        web_thickness: "web_thickness",
        top_flange_thickness: "flange_thickness",
        bottom_flange_thickness: "flange_thickness"
      }
    },
    {
      id: "asymmetric_i",
      geometry_type: "i_section",
      catalog_shape: "i",
      label: "ASYMMETRIC I/H",
      name_en: "ASYMMETRIC I/H",
      name_vi: "ASYMMETRIC I/H",
      geometry_variant: "sharp_corner",
      dimensions: [
        "depth",
        "top_flange_width",
        "bottom_flange_width",
        "web_thickness",
        "top_flange_thickness",
        "bottom_flange_thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        top_flange_width: "top_flange_width",
        bottom_flange_width: "bottom_flange_width",
        web_thickness: "web_thickness",
        top_flange_thickness: "top_flange_thickness",
        bottom_flange_thickness: "bottom_flange_thickness"
      }
    },
    {
      id: "channel",
      geometry_type: "channel",
      catalog_shape: "channel",
      label: "CHANNEL",
      name_en: "CHANNEL",
      name_vi: "CHANNEL",
      geometry_variant: "sharp_corner",
      dimensions: [
        "depth",
        "width",
        "web_thickness",
        "flange_thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        width: "width",
        web_thickness: "web_thickness",
        flange_thickness: "flange_thickness"
      }
    },
    {
      id: "angle",
      geometry_type: "angle",
      catalog_shape: "angle",
      label: "ANGLE",
      name_en: "ANGLE",
      name_vi: "ANGLE",
      geometry_variant: "sharp_corner",
      dimensions: [
        "depth",
        "width",
        "thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        width: "width",
        thickness: "thickness"
      }
    },
    {
      id: "tee",
      geometry_type: "tee",
      catalog_shape: "tee",
      label: "TEE",
      name_en: "TEE",
      name_vi: "TEE",
      geometry_variant: "sharp_corner",
      dimensions: [
        "depth",
        "width",
        "web_thickness",
        "flange_thickness"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        width: "width",
        web_thickness: "web_thickness",
        flange_thickness: "flange_thickness"
      }
    },
    {
      id: "double_angle",
      geometry_type: "double_angle",
      catalog_shape: "double_angle",
      label: "DOUBLE ANGLE",
      name_en: "DOUBLE ANGLE",
      name_vi: "DOUBLE ANGLE",
      geometry_variant: "back_to_back",
      dimensions: [
        "depth",
        "width",
        "thickness",
        "distance"
      ],
      default_dimensions: {
        width: 200,
        height: 400,
        depth: 400,
        diameter: 200,
        thickness: 10,
        web_thickness: 8,
        flange_thickness: 12,
        top_flange_width: 200,
        bottom_flange_width: 250,
        top_flange_thickness: 12,
        bottom_flange_thickness: 16,
        distance: 20
      },
      engine_dimensions: {
        depth: "depth",
        width: "width",
        thickness: "thickness",
        distance: "distance"
      }
    }
  ],
  aliases: {
    "i-h": "symmetric_i",
    i: "symmetric_i",
    i_section: "asymmetric_i",
    "circular-tube": "chs",
    circular_hollow: "chs",
    "rectangular-tube": "shs_rhs",
    rectangular_hollow: "shs_rhs",
    shs: "shs_rhs",
    rhs: "shs_rhs",
    "double-angle": "double_angle"
  },
  properties: [
    {
      key: "geometric.area",
      symbol: "A",
      unit: "mm2",
      expression: "A = \u222B_\u03A9 dA = \u03A3 A_i",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "geometric.perimeter",
      symbol: "P",
      unit: "mm",
      expression: "P = \u222B_\u2202\u03A9 ds (outer + inner boundaries)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "geometric.centroid_x",
      symbol: "x\u0304",
      unit: "mm",
      expression: "x\u0304 = \u03A3(A_i x_i)/A",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "geometric.centroid_y",
      symbol: "\u0233",
      unit: "mm",
      expression: "\u0233 = \u03A3(A_i y_i)/A",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.ix",
      symbol: "Ix",
      unit: "mm4",
      expression: "Ix = \u03A3[b_i h_i\xB3/12 + A_i(y_i \u2212 \u0233)\xB2]",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.iy",
      symbol: "Iy",
      unit: "mm4",
      expression: "Iy = \u03A3[h_i b_i\xB3/12 + A_i(x_i \u2212 x\u0304)\xB2]",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.ixy",
      symbol: "Ixy",
      unit: "mm4",
      expression: "Ixy = \u03A3 A_i(x_i \u2212 x\u0304)(y_i \u2212 \u0233)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.sx_positive",
      symbol: "Sx+",
      unit: "mm3",
      expression: "Sx+ = Ix/(H \u2212 \u0233)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.sx_negative",
      symbol: "Sx\u2212",
      unit: "mm3",
      expression: "Sx\u2212 = Ix/\u0233",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.sy_positive",
      symbol: "Sy+",
      unit: "mm3",
      expression: "Sy+ = Iy/(B \u2212 x\u0304)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.sy_negative",
      symbol: "Sy\u2212",
      unit: "mm3",
      expression: "Sy\u2212 = Iy/x\u0304",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.rx",
      symbol: "rx",
      unit: "mm",
      expression: "rx = \u221A(Ix/A)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "elastic.ry",
      symbol: "ry",
      unit: "mm",
      expression: "ry = \u221A(Iy/A)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "plastic.pna_x",
      symbol: "PNAx",
      unit: "mm",
      expression: "\u222B_{x \u2264 xp} dA = A/2",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "plastic.pna_y",
      symbol: "PNAy",
      unit: "mm",
      expression: "\u222B_{y \u2264 yp} dA = A/2",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "plastic.zx",
      symbol: "Zx",
      unit: "mm3",
      expression: "Zx = \u222B_\u03A9 |y \u2212 yp| dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "plastic.zy",
      symbol: "Zy",
      unit: "mm3",
      expression: "Zy = \u222B_\u03A9 |x \u2212 xp| dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "principal.i_major",
      symbol: "Imax",
      unit: "mm4",
      expression: "Imax = (Ix + Iy)/2 + \u221A[((Ix \u2212 Iy)/2)\xB2 + Ixy\xB2]",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "principal.i_minor",
      symbol: "Imin",
      unit: "mm4",
      expression: "Imin = (Ix + Iy)/2 \u2212 \u221A[((Ix \u2212 Iy)/2)\xB2 + Ixy\xB2]",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "principal.major_axis_angle_degrees",
      symbol: "\u03B8",
      unit: "deg",
      expression: "\u03B8 = \xBD atan2(\u22122Ixy, Ix \u2212 Iy), modulo 180\xB0",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "principal.orientation_status",
      symbol: "Orientation",
      unit: "1",
      expression: "Indeterminate when Ix = Iy and Ixy = 0",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "advanced.torsion_constant_j",
      symbol: "J",
      unit: "mm4",
      expression: "J = 2\u222B_\u03A9 \u03C6 dA, \u2207\xB2\u03C6 = \u22122; boundary conditions per geometry",
      reference_ids: [
        "saint_venant",
        "vlasov"
      ]
    },
    {
      key: "advanced.warping_constant_cw",
      symbol: "Cw",
      unit: "mm6",
      expression: "Cw = \u222B_\u03A9 \u03C9_n\xB2 dA (normalized warping about shear center)",
      reference_ids: [
        "saint_venant",
        "vlasov"
      ]
    },
    {
      key: "advanced.shear_center",
      symbol: "SC",
      unit: "mm",
      expression: "SC: torque of shear flow is zero about (xs, ys); \u0394 = SC \u2212 centroid",
      reference_ids: [
        "saint_venant",
        "vlasov"
      ]
    },
    {
      key: "advanced.effective_shear_area",
      symbol: "Ax/Ay",
      unit: "mm2",
      expression: "Ak = Vk\xB2 / \u222B_\u03A9 \u03C4k\xB2 dA; thin-wall: Ak = Vk\xB2 / \u222B qk\xB2/t ds",
      reference_ids: [
        "saint_venant",
        "vlasov"
      ]
    },
    {
      key: "mechanics.geometry.polar_centroidal.inertia_mm4",
      symbol: "Ip",
      unit: "mm4",
      expression: "Ip = Ix + Iy",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.polar_centroidal.radius_mm",
      symbol: "rp",
      unit: "mm",
      expression: "rp = sqrt(Ip/A)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.extreme_positive_mm",
      symbol: "cmajor+",
      unit: "mm",
      expression: "cmajor+ = max_material(v); u=X cos(theta)+Y sin(theta), v=-X sin(theta)+Y cos(theta)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.extreme_negative_mm",
      symbol: "cmajor-",
      unit: "mm",
      expression: "cmajor- = min_material(v) (signed coordinate)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.elastic_modulus_positive_mm3",
      symbol: "Smajor+",
      unit: "mm3",
      expression: "Smajor = Imax/abs(cmajor); use the stated positive/negative extreme",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.elastic_modulus_negative_mm3",
      symbol: "Smajor-",
      unit: "mm3",
      expression: "Smajor = Imax/abs(cmajor); use the stated positive/negative extreme",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.radius_mm",
      symbol: "rmajor",
      unit: "mm",
      expression: "rmajor = sqrt(Imax/A)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.plastic_neutral_coordinate_mm",
      symbol: "pmajor",
      unit: "mm",
      expression: "integral_material(v <= pmajor) dA = A/2; local centroid coordinate",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.major.plastic_modulus_mm3",
      symbol: "Zmajor",
      unit: "mm3",
      expression: "Zmajor = integral_material(abs(v-pmajor)) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.extreme_positive_mm",
      symbol: "cminor+",
      unit: "mm",
      expression: "cminor+ = max_material(u); u=X cos(theta)+Y sin(theta), v=-X sin(theta)+Y cos(theta)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.extreme_negative_mm",
      symbol: "cminor-",
      unit: "mm",
      expression: "cminor- = min_material(u) (signed coordinate)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.elastic_modulus_positive_mm3",
      symbol: "Sminor+",
      unit: "mm3",
      expression: "Sminor = Imin/abs(cminor); use the stated positive/negative extreme",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.elastic_modulus_negative_mm3",
      symbol: "Sminor-",
      unit: "mm3",
      expression: "Sminor = Imin/abs(cminor); use the stated positive/negative extreme",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.radius_mm",
      symbol: "rminor",
      unit: "mm",
      expression: "rminor = sqrt(Imin/A)",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.plastic_neutral_coordinate_mm",
      symbol: "pminor",
      unit: "mm",
      expression: "integral_material(u <= pminor) dA = A/2; local centroid coordinate",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.principal.minor.plastic_modulus_mm3",
      symbol: "Zminor",
      unit: "mm3",
      expression: "Zminor = integral_material(abs(u-pminor)) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments.m30_mm5",
      symbol: "M30",
      unit: "mm5",
      expression: "M30 = integral_material(X^3 Y^0) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments.m21_mm5",
      symbol: "M21",
      unit: "mm5",
      expression: "M21 = integral_material(X^2 Y^1) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments.m12_mm5",
      symbol: "M12",
      unit: "mm5",
      expression: "M12 = integral_material(X^1 Y^2) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments.m03_mm5",
      symbol: "M03",
      unit: "mm5",
      expression: "M03 = integral_material(X^0 Y^3) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments_principal.m30_mm5",
      symbol: "M30_uv",
      unit: "mm5",
      expression: "M30 = integral_material(u^3 v^0) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments_principal.m21_mm5",
      symbol: "M21_uv",
      unit: "mm5",
      expression: "M21 = integral_material(u^2 v^1) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments_principal.m12_mm5",
      symbol: "M12_uv",
      unit: "mm5",
      expression: "M12 = integral_material(u^1 v^2) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.third_moments_principal.m03_mm5",
      symbol: "M03_uv",
      unit: "mm5",
      expression: "M03 = integral_material(u^0 v^3) dA",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.advanced.shear_center_geometry.polar_inertia_mm4",
      symbol: "IpSC",
      unit: "mm4",
      expression: "IpSC = Ix+Iy+A*(ex^2+ey^2)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear_center_geometry.polar_radius_mm",
      symbol: "r0",
      unit: "mm",
      expression: "r0 = sqrt((Ix+Iy)/A+ex^2+ey^2)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear_center_geometry.coupling_factor",
      symbol: "H",
      unit: "1",
      expression: "H = ((Ix+Iy)/A)/r0^2",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear_center_geometry.offset_x_mm",
      symbol: "ex",
      unit: "mm",
      expression: "ex = xs-xbar",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear_center_geometry.offset_y_mm",
      symbol: "ey",
      unit: "mm",
      expression: "ey = ys-ybar",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.wagner.beta_x_mm",
      symbol: "beta_x",
      unit: "mm",
      expression: "beta_x = (M21+M03)/Ix-2ey; eu=ex*cos(theta)+ey*sin(theta), ev=-ex*sin(theta)+ey*cos(theta)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.wagner.beta_y_mm",
      symbol: "beta_y",
      unit: "mm",
      expression: "beta_y = (M30+M12)/Iy-2ex; eu=ex*cos(theta)+ey*sin(theta), ev=-ex*sin(theta)+ey*cos(theta)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.wagner.beta_major_mm",
      symbol: "beta_major",
      unit: "mm",
      expression: "beta_major = (M21_uv+M03_uv)/Imax-2ev; eu=ex*cos(theta)+ey*sin(theta), ev=-ex*sin(theta)+ey*cos(theta)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.wagner.beta_minor_mm",
      symbol: "beta_minor",
      unit: "mm",
      expression: "beta_minor = (M30_uv+M12_uv)/Imin-2eu; eu=ex*cos(theta)+ey*sin(theta), ev=-ex*sin(theta)+ey*cos(theta)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.torsion.modulus_mm3",
      symbol: "Wt",
      unit: "mm3",
      expression: "Wt = 1/max_material(abs(tau/T)); circle/CHS: J/R; open walls: J/max(t); closed uniform cell: 2Am*t; rectangle: J/max_boundary(abs(grad(phi)))",
      reference_ids: [
        "saint_venant"
      ]
    },
    {
      key: "mechanics.advanced.torsion.unit_max_shear_per_torque_mm3_inverse",
      symbol: "tauTmax",
      unit: "mm-3",
      expression: "max(abs(tau/T)) = 1/Wt",
      reference_ids: [
        "saint_venant"
      ]
    },
    {
      key: "mechanics.advanced.shear.modulus_x_mm2",
      symbol: "Wvx",
      unit: "mm2",
      expression: "Wvx = 1/max_material(abs(tau/Vx)); unit-force distribution stored in mechanics.advanced.fields",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear.modulus_y_mm2",
      symbol: "Wvy",
      unit: "mm2",
      expression: "Wvy = 1/max_material(abs(tau/Vy)); unit-force distribution stored in mechanics.advanced.fields",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear.compliance.xx_mm2_inverse",
      symbol: "Cxx",
      unit: "mm-2",
      expression: "Cxx = integral(qx*qx/t) ds for unit forces; U_shear=(Cxx*Vx^2+2Cxy*Vx*Vy+Cyy*Vy^2)/(2G)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear.compliance.xy_mm2_inverse",
      symbol: "Cxy",
      unit: "mm-2",
      expression: "Cxy = integral(qx*qy/t) ds for unit forces; U_shear=(Cxx*Vx^2+2Cxy*Vx*Vy+Cyy*Vy^2)/(2G)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.shear.compliance.yy_mm2_inverse",
      symbol: "Cyy",
      unit: "mm-2",
      expression: "Cyy = integral(qy*qy/t) ds for unit forces; U_shear=(Cxx*Vx^2+2Cxy*Vx*Vy+Cyy*Vy^2)/(2G)",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.warping.omega_positive_mm2",
      symbol: "omega+",
      unit: "mm2",
      expression: "max_material(omega); normalized zero area-weighted mean about shear-center pole",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.warping.modulus_positive_mm4",
      symbol: "Womega+",
      unit: "mm4",
      expression: "Womega = Cw/abs(omega_extreme); zero Cw -> not applicable, value null. Solid rectangle uses upper extrema enclosure to produce a lower modulus bound.",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.warping.omega_negative_mm2",
      symbol: "omega-",
      unit: "mm2",
      expression: "min_material(omega); normalized zero area-weighted mean about shear-center pole",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.advanced.warping.modulus_negative_mm4",
      symbol: "Womega-",
      unit: "mm4",
      expression: "Womega = Cw/abs(omega_extreme); zero Cw -> not applicable, value null. Solid rectangle uses upper extrema enclosure to produce a lower modulus bound.",
      reference_ids: [
        "vlasov"
      ]
    },
    {
      key: "mechanics.geometry.coupled_bending.mx.elastic_modulus_positive_mm3",
      symbol: "S_mx_positive",
      unit: "mm3",
      expression: "S_mx_positive = 1/extreme_abs(psi_mx); psi_mx=(-Ixy*X+Iy*Y)/(Ix*Iy-Ixy^2), psi_my=(Ix*X-Ixy*Y)/(Ix*Iy-Ixy^2); use max positive or abs min negative over material",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.coupled_bending.mx.elastic_modulus_negative_mm3",
      symbol: "S_mx_negative",
      unit: "mm3",
      expression: "S_mx_negative = 1/extreme_abs(psi_mx); psi_mx=(-Ixy*X+Iy*Y)/(Ix*Iy-Ixy^2), psi_my=(Ix*X-Ixy*Y)/(Ix*Iy-Ixy^2); use max positive or abs min negative over material",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.coupled_bending.my.elastic_modulus_positive_mm3",
      symbol: "S_my_positive",
      unit: "mm3",
      expression: "S_my_positive = 1/extreme_abs(psi_my); psi_mx=(-Ixy*X+Iy*Y)/(Ix*Iy-Ixy^2), psi_my=(Ix*X-Ixy*Y)/(Ix*Iy-Ixy^2); use max positive or abs min negative over material",
      reference_ids: [
        "geometric_integrals"
      ]
    },
    {
      key: "mechanics.geometry.coupled_bending.my.elastic_modulus_negative_mm3",
      symbol: "S_my_negative",
      unit: "mm3",
      expression: "S_my_negative = 1/extreme_abs(psi_my); psi_mx=(-Ixy*X+Iy*Y)/(Ix*Iy-Ixy^2), psi_my=(Ix*X-Ixy*Y)/(Ix*Iy-Ixy^2); use max positive or abs min negative over material",
      reference_ids: [
        "geometric_integrals"
      ]
    }
  ],
  geometry_expressions: {
    rectangle: {
      "geometric.area": "A = b h",
      "geometric.perimeter": "P = 2(b + h)",
      "geometric.centroid_x": "x\u0304 = b/2",
      "geometric.centroid_y": "\u0233 = h/2",
      "elastic.ix": "Ix = b h\xB3/12",
      "elastic.iy": "Iy = h b\xB3/12",
      "elastic.ixy": "Ixy = 0",
      "plastic.pna_x": "xp = b/2",
      "plastic.pna_y": "yp = h/2",
      "plastic.zx": "Zx = b h\xB2/4",
      "plastic.zy": "Zy = h b\xB2/4",
      "advanced.torsion_constant_j": "a = max(b,h); c = min(b,h); J = ac\xB3/3 [1 \u2212 192c/(\u03C0\u2075a) \u03A3_{n=1,3,5,\u2026} tanh(n\u03C0a/(2c))/n\u2075]",
      "advanced.warping_constant_cw": "a = b/2; c = h/2; \u2207\xB2\u03C8 = 0; \u03C8_x = y on x=\xB1a, \u03C8_y = \u2212x on y=\xB1c; Cw = \u222B_{\u2212a}^{a}\u222B_{\u2212c}^{c} \u03C8\xB2 dy dx (convergent harmonic Fourier series)",
      "advanced.shear_center": "xs = b/2; ys = h/2; \u0394x = \u0394y = 0",
      "advanced.effective_shear_area": "Ax = Ay = 5 b h/6 (Jourawski shear-energy convention)"
    },
    circle: {
      "geometric.area": "A = \u03C0D\xB2/4",
      "geometric.perimeter": "P = \u03C0D",
      "geometric.centroid_x": "x\u0304 = D/2",
      "geometric.centroid_y": "\u0233 = D/2",
      "elastic.ix": "Ix = \u03C0D\u2074/64",
      "elastic.iy": "Iy = \u03C0D\u2074/64",
      "elastic.ixy": "Ixy = 0",
      "plastic.zx": "Zx = D\xB3/6",
      "plastic.zy": "Zy = D\xB3/6",
      "advanced.torsion_constant_j": "J = \u03C0D\u2074/32 = Ix + Iy",
      "advanced.warping_constant_cw": "\u03C8 = 0 for a circular section; Cw = \u222B\u03C8\xB2 dA = 0",
      "advanced.shear_center": "xs = ys = D/2; \u0394x = \u0394y = 0",
      "advanced.effective_shear_area": "Ax = Ay = 9A/10 (geometric Jourawski convention)",
      "plastic.pna_x": "xp = D/2",
      "plastic.pna_y": "yp = D/2"
    },
    circular_hollow: {
      "geometric.area": "d = D \u2212 2t; A = \u03C0(D\xB2 \u2212 d\xB2)/4",
      "geometric.perimeter": "P = \u03C0(D + d)",
      "elastic.ix": "Ix = \u03C0(D\u2074 \u2212 d\u2074)/64",
      "elastic.iy": "Iy = \u03C0(D\u2074 \u2212 d\u2074)/64",
      "elastic.ixy": "Ixy = 0",
      "plastic.zx": "Zx = (D\xB3 \u2212 d\xB3)/6",
      "plastic.zy": "Zy = (D\xB3 \u2212 d\xB3)/6",
      "advanced.torsion_constant_j": "d = D \u2212 2t; J = \u03C0(D\u2074 \u2212 d\u2074)/32 = Ix + Iy",
      "advanced.warping_constant_cw": "\u03C8 = 0 for a concentric annulus; Cw = 0",
      "advanced.shear_center": "xs = ys = D/2; \u0394x = \u0394y = 0",
      "advanced.effective_shear_area": "Rm = (D \u2212 t)/2; Ax = Ay = \u03C0Rm t = A/2; q = V cos\u03B8/(\u03C0Rm), As = V\xB2 / \u222Eq\xB2/t ds (median-circle model)",
      "geometric.centroid_x": "x\u0304 = D/2",
      "geometric.centroid_y": "\u0233 = D/2",
      "plastic.pna_x": "xp = D/2",
      "plastic.pna_y": "yp = D/2"
    },
    rectangular_hollow: {
      "geometric.area": "bi = b \u2212 2t; hi = h \u2212 2t; A = b h \u2212 bi hi",
      "geometric.perimeter": "P = 2(b + h + bi + hi)",
      "elastic.ix": "Ix = (b h\xB3 \u2212 bi hi\xB3)/12",
      "elastic.iy": "Iy = (h b\xB3 \u2212 hi bi\xB3)/12",
      "elastic.ixy": "Ixy = 0",
      "plastic.zx": "Zx = (b h\xB2 \u2212 bi hi\xB2)/4",
      "plastic.zy": "Zy = (h b\xB2 \u2212 hi bi\xB2)/4",
      "advanced.torsion_constant_j": "bm = b \u2212 t; hm = h \u2212 t; Am = bm hm; J = 4Am\xB2 / [2(bm+hm)/t] (Bredt single-cell model)",
      "advanced.warping_constant_cw": "L = 2(bm+hm); d\u03C9/ds = x dy/ds \u2212 y dx/ds \u2212 2Am/L; \u03C9n = \u03C9 \u2212 (\u222Et\u03C9 ds)/(\u222Et ds); Cw = \u222Et\u03C9n\xB2 ds",
      "advanced.shear_center": "xs = b/2; ys = h/2; \u0394x = \u0394y = 0",
      "advanced.effective_shear_area": "q = qb + q0; q0 = \u2212[\u222Eqb/t ds]/[\u222E1/t ds]; Ak = Vk\xB2 / \u222Eqk\xB2/t ds (closed-cell shear energy)",
      "geometric.centroid_x": "x\u0304 = b/2",
      "geometric.centroid_y": "\u0233 = h/2",
      "plastic.pna_x": "xp = b/2",
      "plastic.pna_y": "yp = h/2"
    },
    i_section: {
      "geometric.area": "hw = h \u2212 tt \u2212 tb; A = bt tt + tw hw + bb tb",
      "geometric.perimeter": "P = 2(bt + bb + h \u2212 tw)",
      "elastic.iy": "Iy = (tt bt\xB3 + hw tw\xB3 + tb bb\xB3)/12",
      "elastic.ixy": "Ixy = 0",
      "plastic.zy": "Zy = (tt bt\xB2 + hw tw\xB2 + tb bb\xB2)/4",
      "advanced.torsion_constant_j": "h0 = h \u2212 (tt+tb)/2; J = (bt tt\xB3 + bb tb\xB3 + h0 tw\xB3)/3 (median-wall approximation)",
      "advanced.warping_constant_cw": "Ib = tb bb\xB3/12; It = tt bt\xB3/12; h0 = h \u2212 (tt+tb)/2; Cw = [Ib It/(Ib+It)] h0\xB2 (Vlasov median-wall model)",
      "advanced.shear_center": "Ib = tb bb\xB3/12; It = tt bt\xB3/12; h0 = h \u2212 (tt+tb)/2; xs = max(bt,bb)/2; ys = tb/2 + h0 It/(Ib+It); \u0394x = xs \u2212 x\u0304; \u0394y = ys \u2212 \u0233",
      "advanced.effective_shear_area": "Ax = 1/\u222Bqx\xB2/t ds; Ay = 1/\u222Bqy\xB2/t ds for unit global shear; q=0 at free ends and flow conservation at junctions"
    },
    channel: {
      "geometric.area": "hw = h \u2212 2tf; A = 2b tf + tw hw",
      "geometric.perimeter": "P = 2h + 4b \u2212 2tw",
      "elastic.ixy": "Ixy = 0",
      "advanced.torsion_constant_j": "h0 = h \u2212 tf; c0 = b \u2212 tw/2; J = [h0 tw\xB3 + 2c0 tf\xB3]/3 (median-wall approximation)",
      "advanced.warping_constant_cw": "h0 = h \u2212 tf; c0 = b \u2212 tw/2; Cw = tf c0\xB3 h0\xB2 (2tw h0 + 3tf c0) / [12(tw h0 + 6tf c0)]",
      "advanced.shear_center": "h0 = h \u2212 tf; c0 = b \u2212 tw/2; e = 3tf c0\xB2/(tw h0 + 6tf c0); xs = tw/2 \u2212 e; ys = h/2; \u0394 = SC \u2212 gross centroid",
      "advanced.effective_shear_area": "Ax = 1/\u222Bqx\xB2/t ds; Ay = 1/\u222Bqy\xB2/t ds for unit global shear; q=0 at free ends and flow conservation at junctions"
    },
    tee: {
      "geometric.area": "hw = h \u2212 tf; A = b tf + tw hw",
      "geometric.perimeter": "P = 2(b + h)",
      "elastic.ixy": "Ixy = 0",
      "advanced.torsion_constant_j": "h0 = h \u2212 tf/2; J = [b tf\xB3 + h0 tw\xB3]/3 (median-wall approximation)",
      "advanced.warping_constant_cw": "Cw = 0 in the ideal median-line model: every branch is radial from its shear-center pole, so d\u03C9 = 0. Local finite-thickness plate warping is excluded.",
      "advanced.shear_center": "xs = b/2; ys = h \u2212 tf/2 (web/flange median-line intersection); \u0394 = SC \u2212 gross centroid",
      "advanced.effective_shear_area": "Ax = 1/\u222Bqx\xB2/t ds; Ay = 1/\u222Bqy\xB2/t ds for unit global shear; q=0 at free ends and flow conservation at junctions"
    },
    angle: {
      "geometric.area": "A = t(b + h \u2212 t)",
      "geometric.perimeter": "P = 2(b + h)",
      "advanced.torsion_constant_j": "Lh = h \u2212 t/2; Lb = b \u2212 t/2; J = t\xB3(Lh+Lb)/3",
      "advanced.warping_constant_cw": "Cw = 0 in the ideal median-line model: both legs are radial from the heel pole, so d\u03C9 = 0. Local finite-thickness plate warping is excluded.",
      "advanced.shear_center": "xs = ys = t/2 (heel median-line intersection); \u0394 = SC \u2212 gross centroid",
      "advanced.effective_shear_area": "Ax = 1/\u222Bqx\xB2/t ds; Ay = 1/\u222Bqy\xB2/t ds for unit global shear; q=0 at free ends and flow conservation at junctions",
      "geometric.centroid_x": "AL = t(b+h\u2212t); x\u0304L = [b\xB2 + t(h\u2212t)]/[2(b+h\u2212t)] (from the vertical back face)",
      "geometric.centroid_y": "\u0233L = [h\xB2 + b t \u2212 t\xB2]/[2(b+h\u2212t)] (from the bottom face)"
    },
    double_angle: {
      "geometric.area": "AL = t(b + h \u2212 t); A = 2AL",
      "geometric.perimeter": "P = 4(b + h), g > 0; P = 4(b + h) \u2212 2h, g = 0 (union boundary)",
      "geometric.centroid_x": "B = 2b + g; x\u0304 = B/2",
      "elastic.ix": "Ix = 2Ix,L",
      "elastic.iy": "AL = t(b+h\u2212t); x\u0304L = [b\xB2 + t(h\u2212t)]/[2(b+h\u2212t)]; d = g/2 + x\u0304L; Iy = 2[Iy,L + AL d\xB2] (single-L centroid measured from its vertical back face)",
      "elastic.ixy": "Ixy = 0",
      "advanced.torsion_constant_j": "J = 2 t\xB3[(h\u2212t/2)+(b\u2212t/2)]/3; rigid heel link adds no material/torsion constant",
      "advanced.warping_constant_cw": "d\u03C9 = (x\u2212xs)dy \u2212 (y\u2212ys)dx; \u222Bt\u03C9n ds = \u222Bt\u03C9n(x\u2212xc) ds = \u222Bt\u03C9n(y\u2212yc) ds = 0; Cw = \u222Bt\u03C9n\xB2 ds",
      "advanced.shear_center": "D\u2113 = Ix\u2113 Iy\u2113 \u2212 Ixy\u2113\xB2; qx\u2032 = \u2212t[Ix\u2113(x\u2212xc\u2113)\u2212Ixy\u2113(y\u2212yc\u2113)]/D\u2113; qy\u2032 = \u2212t[Iy\u2113(y\u2212yc\u2113)\u2212Ixy\u2113(x\u2212xc\u2113)]/D\u2113; Tk = \u222Bqk[(x\u2212xc\u2113)dy\u2212(y\u2212yc\u2113)dx]; xs = xc\u2113 + Ty; ys = yc\u2113 \u2212 Tx (unit Vx/Vy)",
      "advanced.effective_shear_area": "Ax = 1/\u222Bqx\xB2/t ds; Ay = 1/\u222Bqy\xB2/t ds for unit global shear; q=0 at free ends and flow conservation at junctions",
      "geometric.centroid_y": "\u0233 = \u0233L = [h\xB2 + b t \u2212 t\xB2]/[2(b+h\u2212t)]",
      "plastic.pna_x": "xp = (2b+g)/2 is the symmetric representative; if g>0, every cut inside the clear gap divides A equally.",
      "plastic.zy": "Zy = 2 AL (g/2 + x\u0304L) for the symmetric back-to-back pair",
      "plastic.zx": "Zx = 2 Zx,L; yp = yp,L (same y-coordinate plastic cut in both angles)"
    }
  },
  method_expressions: {},
  references: [
    {
      id: "geometric_integrals",
      title: "Area, first/second moments and plastic modulus: integral definitions and parallel-axis theorem"
    },
    {
      id: "saint_venant",
      title: "Saint-Venant torsion; Prandtl stress-function formulation"
    },
    {
      id: "vlasov",
      title: "V. Z. Vlasov, Thin-Walled Elastic Beams (1961): sectorial-coordinate and shear-flow theory"
    }
  ],
  double_angle: {
    arrangement: "back_to_back",
    distance_definition: "clear_gap_between_vertical_back_faces",
    horizontal_legs: "bottom_toes_outward",
    connection_model: "ideal_rigid_heel_link",
    distance_zero_perimeter: "union_boundary",
    assumptions: [
      "Both angles are constrained to act together in bending and shear; connection adequacy is outside geometric calculation.",
      "Gap contains no material; no fictitious spacer area, torsion or stiffness is added.",
      "A rigid kinematic link between the two heels carries reaction shear but has zero area, torsion constant and strain energy.",
      "Sectorial warping is integrated continuously through the heel link, then normalized globally; per-angle mean subtraction is not used.",
      "Zero clear gap does not imply a continuously welded 2t web; plate torsion remains the sum of the two angle contributions."
    ]
  },
  mechanics_solver_version: "1.0.0"
};

// ../../section-properties/core/formula-report.ts
var get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
var printable = (value) => typeof value === "number" ? String(value) : JSON.stringify(value);
var propertyValue = (result, key) => key.startsWith("advanced.") ? get(result, `${key}.value`) : key.startsWith("mechanics.") ? get(result, key) : get(result, `properties.${key}`);
function substitute(expression, symbols, outputSymbol) {
  const equals = expression.indexOf("=");
  const prefix = equals < 0 ? "" : expression.slice(0, equals + 1);
  let right = equals < 0 ? expression : expression.slice(equals + 1);
  right = right.replace(/π(?=[A-Za-z])/g, "\u03C0 \xD7 ").replace(/(\d)(?=[A-Za-z])/g, "$1 \xD7 ");
  const keys = Object.keys(symbols).filter((key) => key !== outputSymbol).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    right = right.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu"), `(${symbols[key]})`);
  }
  return prefix + right;
}
async function buildFormulaReport(result, selectedProfileId) {
  const geometry = result.normalized_input.geometry;
  const dimensions = geometry.dimensions;
  const symmetricI = geometry.type === "i_section" && dimensions.top_flange_width === dimensions.bottom_flange_width && dimensions.top_flange_thickness === dimensions.bottom_flange_thickness;
  const profile = section_registry_default.profiles.find((profile2) => profile2.id === (selectedProfileId ?? (geometry.type === "i_section" ? symmetricI ? "symmetric_i" : "asymmetric_i" : section_registry_default.aliases[geometry.type] ?? geometry.type)));
  const symbolDimensions = Object.entries(dimensions).map(([key, value]) => {
    const descriptor = section_registry_default.dimensions[key];
    return { key, symbol: descriptor?.symbol ?? key, value, unit: "mm" };
  });
  if (symmetricI) {
    symbolDimensions.push({ key: "width", symbol: "b", value: dimensions.top_flange_width, unit: "mm" });
    symbolDimensions.push({ key: "flange_thickness", symbol: "tf", value: dimensions.top_flange_thickness, unit: "mm" });
  }
  const assumptions = [.../* @__PURE__ */ new Set([
    ...result.diagnostics.assumptions ?? [],
    ...result.diagnostics.i_section_advanced?.assumptions ?? [],
    ...result.diagnostics.advanced?.assumptions ?? [],
    ...result.diagnostics.advanced_model?.assumptions ?? [],
    ...geometry.type === "double_angle" ? section_registry_default.double_angle.assumptions : []
  ])];
  const dimensionSymbols = Object.fromEntries(symbolDimensions.map((dimension) => [dimension.symbol, dimension.value]));
  const numericSymbols = { ...dimensionSymbols };
  for (const descriptor of section_registry_default.properties) {
    const value = propertyValue(result, descriptor.key);
    if (typeof value === "number") numericSymbols[descriptor.symbol] = value;
  }
  const properties = section_registry_default.properties.map((descriptor) => {
    const advanced = descriptor.key.startsWith("advanced.");
    const mechanics = descriptor.key.startsWith("mechanics.");
    const property = mechanics ? get(result, descriptor.key) : get(result, advanced ? descriptor.key : `properties.${descriptor.key}`);
    let status = advanced ? property?.status ?? "not_computed" : property === void 0 || property === null && descriptor.key !== "principal.major_axis_angle_degrees" ? "not_computed" : "computed";
    const value = propertyValue(result, descriptor.key) ?? null;
    const mechanicsGroup = mechanics ? get(result, descriptor.key.startsWith("mechanics.geometry.") ? "mechanics.geometry" : "mechanics.advanced") : null;
    let reason = advanced ? property?.reason ?? null : status === "not_computed" ? mechanicsGroup?.reason ?? "not_requested" : null;
    if (mechanics && descriptor.key.includes(".warping.modulus_") && value === null && get(result, "mechanics.advanced.warping.status") === "not_applicable") {
      status = "not_applicable";
      reason = "zero_warping";
    }
    const method = advanced ? property?.method ?? null : mechanics ? mechanicsGroup?.method ?? "strength_of_materials_section_response" : "gross_geometry_integrals";
    const overrides = section_registry_default.geometry_expressions[geometry.type];
    const methodExpressions = section_registry_default.method_expressions;
    const methodExpression = method ? methodExpressions[method] : void 0;
    const expression = (typeof methodExpression === "string" ? methodExpression : methodExpression?.[descriptor.key]) ?? overrides?.[descriptor.key] ?? descriptor.expression;
    return {
      key: descriptor.key,
      symbol: descriptor.symbol,
      unit: descriptor.unit,
      status,
      value,
      method,
      expression,
      substitution: {
        expression: substitute(expression, numericSymbols, descriptor.symbol),
        dimensions: dimensionSymbols,
        context_ref: "inputs",
        result: `${descriptor.symbol} = ${printable(value)} ${descriptor.unit}`
      },
      reason,
      reference_ids: descriptor.reference_ids
    };
  });
  const bytes = new TextEncoder().encode(JSON.stringify(section_registry_default));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const manifestHash = Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join("");
  return {
    schema_version: section_registry_default.schema_version,
    library_version: section_registry_default.library_version,
    manifest_hash: manifestHash,
    core: "section-properties/shared-typescript",
    core_version: result.solver.version,
    profile_id: profile.id,
    geometry_type: geometry.type,
    profile_label: profile.label,
    geometry_model_version: section_registry_default.geometry_model_version,
    normalized_geometry: geometry,
    geometry_hash: result.geometry_hash,
    solver: result.solver,
    mechanics_solver: result.mechanics ? { schema_version: result.mechanics.schema_version, version: result.mechanics.solver_version } : null,
    coordinate_system: section_registry_default.coordinate_system,
    units: "mm",
    dimensions: symbolDimensions,
    components: result.diagnostics.components ?? result.diagnostics.intermediate?.components ?? [],
    inputs: {
      dimensions: dimensionSymbols,
      symbols: numericSymbols,
      bounding_box: result.diagnostics.bounding_box,
      geometric: result.properties.geometric,
      elastic: result.properties.elastic,
      plastic: result.properties.plastic,
      intermediate: result.diagnostics.intermediate,
      advanced_model: result.diagnostics.advanced_model,
      mechanics: result.mechanics,
      options: result.normalized_input.options
    },
    properties,
    assumptions,
    references: section_registry_default.references,
    reference_ids: section_registry_default.references.map((reference) => reference.id),
    ...geometry.type === "double_angle" ? { connection_model: section_registry_default.double_angle } : {}
  };
}

// ../../section-properties/core/mechanics-geometry.ts
var MechanicsGeometryError = class extends RangeError {
  constructor(message) {
    super(message);
    this.name = "MechanicsGeometryError";
  }
};
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Mechanics geometry requires a finite ${label}.`);
  }
  return value;
}
function positive(value, label) {
  const result = finite(value, label);
  if (result <= 0) throw new TypeError(`Mechanics geometry requires a positive ${label}.`);
  return result;
}
function safeValue(value, label) {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`);
  return value;
}
function scaled(value, scale, power, label) {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} is not finite before unit scaling.`);
  if (value === 0) return 0;
  let output = value;
  for (let i = 0; i < power; i++) {
    output *= scale;
    if (!Number.isFinite(output)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`);
    if (output === 0) throw new MechanicsGeometryError(`${label} underflows the finite numeric range.`);
  }
  return output;
}
function unscaled(value, scale, power, label) {
  if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} is not finite before normalization.`);
  if (value === 0) return 0;
  let output = value;
  for (let i = 0; i < power; i++) {
    output /= scale;
    if (!Number.isFinite(output)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`);
    if (output === 0) throw new MechanicsGeometryError(`${label} underflows the finite numeric range.`);
  }
  return output;
}
function closeEnough(actual, expected, label) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new MechanicsGeometryError(`${label} cannot be checked because a normalized value is nonfinite.`);
  }
  if (actual === expected) return;
  const magnitude = Math.max(Math.abs(actual), Math.abs(expected));
  if (magnitude === 0 || Math.abs(actual - expected) > 2048 * Number.EPSILON * magnitude) {
    throw new MechanicsGeometryError(`${label} does not match the canonical gross property.`);
  }
}
function canonicalGross(result) {
  const properties = result.properties;
  if (!record(properties?.geometric) || !record(properties?.elastic) || !record(properties?.principal)) {
    throw new TypeError("Canonical geometric, elastic, and principal properties are required.");
  }
  const geometric = properties.geometric;
  const elastic = properties.elastic;
  const principal = properties.principal;
  const area = positive(geometric.area, "canonical area");
  const centroidX = finite(geometric.centroid_x, "canonical x centroid");
  const centroidY = finite(geometric.centroid_y, "canonical y centroid");
  const ix = positive(elastic.ix, "canonical Ix");
  const iy = positive(elastic.iy, "canonical Iy");
  const ixy = finite(elastic.ixy, "canonical Ixy");
  const iMajor = positive(principal.i_major, "canonical major principal inertia");
  const iMinor = positive(principal.i_minor, "canonical minor principal inertia");
  const orientation = principal.orientation_status;
  if (orientation !== "determinate" && orientation !== "indeterminate") {
    throw new TypeError("Canonical principal orientation status must be determinate or indeterminate.");
  }
  const angle = orientation === "determinate" ? finite(principal.major_axis_angle_degrees, "canonical principal angle") : 0;
  if (orientation === "determinate" && (angle < 0 || angle >= 180)) {
    throw new TypeError("Canonical principal angle must be in [0, 180) degrees.");
  }
  return { area, centroidX, centroidY, ix, iy, ixy, iMajor, iMinor, basisAngle: angle, basisUnique: orientation === "determinate" };
}
function compensatedSum(values, label) {
  let sum2 = 0;
  let correction = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new MechanicsGeometryError(`${label} contains a nonfinite integration term.`);
    const updated = sum2 + value;
    correction += Math.abs(sum2) >= Math.abs(value) ? sum2 - updated + value : value - updated + sum2;
    sum2 = updated;
    if (!Number.isFinite(sum2) || !Number.isFinite(correction)) throw new MechanicsGeometryError(`${label} exceeds the finite numeric range.`);
  }
  return safeValue(sum2 + correction, label);
}
function normalizedDimension(value, scale, label) {
  const result = value / scale;
  if (!Number.isFinite(result) || result <= 0) {
    throw new MechanicsGeometryError(`${label} is not representable after geometry normalization.`);
  }
  return result;
}
function rectangleIntegral1D(offset, span, power) {
  let value;
  if (power === 0) value = span;
  else if (power === 1) value = span * offset;
  else if (power === 2) value = span * (offset * offset + span * span / 12);
  else if (power === 3) value = span * (offset * offset * offset + offset * span * span / 4);
  else throw new RangeError("Only moments through total order three are supported.");
  const mathematicallyNonzero = power === 0 || (power === 1 || power === 3) && offset !== 0 || power === 2 && span !== 0;
  if (value === 0 && mathematicallyNonzero) throw new MechanicsGeometryError("A normalized rectangle moment underflows the finite numeric range.");
  return safeValue(value, "normalized rectangle moment");
}
function rectMoment(rectangles, cx, cy, scale, px, py) {
  return compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, "component width");
    const height = normalizedDimension(rectangle.height, scale, "component height");
    const dx = (rectangle.x + rectangle.width / 2) / scale - cx;
    const dy = (rectangle.y + rectangle.height / 2) / scale - cy;
    const xMoment = rectangleIntegral1D(dx, width, px);
    const yMoment = rectangleIntegral1D(dy, height, py);
    const term = xMoment * yMoment;
    if (term === 0 && xMoment !== 0 && yMoment !== 0) throw new MechanicsGeometryError("A normalized component moment underflows the finite numeric range.");
    return safeValue(term, `component moment M${px}${py}`);
  }), `centroidal moment M${px}${py}`);
}
function momentKey(px, py) {
  return `${px},${py}`;
}
function transformedMoment(moments, px, py, cosine2, sine2) {
  let terms = /* @__PURE__ */ new Map([[momentKey(0, 0), 1]]);
  const multiply = (xCoefficient, yCoefficient) => {
    const next = /* @__PURE__ */ new Map();
    for (const [key, coefficient] of terms) {
      const [xPower, yPower] = key.split(",").map(Number);
      const xKey = momentKey(xPower + 1, yPower);
      const yKey = momentKey(xPower, yPower + 1);
      next.set(xKey, (next.get(xKey) ?? 0) + coefficient * xCoefficient);
      next.set(yKey, (next.get(yKey) ?? 0) + coefficient * yCoefficient);
    }
    terms = next;
  };
  for (let i = 0; i < px; i++) multiply(cosine2, sine2);
  for (let i = 0; i < py; i++) multiply(-sine2, cosine2);
  return compensatedSum(Array.from(terms, ([key, coefficient]) => coefficient * (moments.get(key) ?? 0)), `principal moment M${px}${py}`);
}
function rectanglePolygons(rectangles, cx, cy, scale, cosine2, sine2, axis) {
  return rectangles.map((rectangle) => {
    const x0 = rectangle.x / scale - cx, x1 = (rectangle.x + rectangle.width) / scale - cx;
    const y0 = rectangle.y / scale - cy, y1 = (rectangle.y + rectangle.height) / scale - cy;
    const points = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    return points.map(({ x, y }) => axis === "major" ? { q: -sine2 * x + cosine2 * y, p: cosine2 * x + sine2 * y } : { q: cosine2 * x + sine2 * y, p: -sine2 * x + cosine2 * y });
  });
}
function polygonStats(polygon) {
  if (polygon.length < 3) return { area: 0, firstMoment: 0 };
  const crosses = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return point.q * next.p - next.q * point.p;
  });
  const twiceArea = compensatedSum(crosses, "clipped polygon area");
  if (twiceArea === 0) return { area: 0, firstMoment: 0 };
  const signedArea = twiceArea / 2;
  const centroidNumerator = compensatedSum(polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return (point.q + next.q) * crosses[index];
  }), "clipped polygon first moment");
  const centroidQ = centroidNumerator / (6 * signedArea);
  return { area: Math.abs(signedArea), firstMoment: Math.abs(signedArea) * centroidQ };
}
function clipPolygon(polygon, cut, keepBelow) {
  if (polygon.length === 0) return [];
  const output = [];
  const inside = (point) => keepBelow ? point.q <= cut : point.q >= cut;
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentInside = inside(current), previousInside = inside(previous);
    if (currentInside !== previousInside) {
      const denominator = current.q - previous.q;
      const fraction = (cut - previous.q) / denominator;
      output.push({ q: cut, p: previous.p + fraction * (current.p - previous.p) });
    }
    if (currentInside) output.push(current);
  }
  return output;
}
function clippedStats(polygons, cut, keepBelow) {
  const stats = polygons.map((polygon) => polygonStats(clipPolygon(polygon, cut, keepBelow)));
  return {
    area: compensatedSum(stats.map((item) => item.area), "clipped section area"),
    firstMoment: compensatedSum(stats.map((item) => item.firstMoment), "clipped section first moment")
  };
}
function polygonExtremes(polygons) {
  const values = polygons.flatMap((polygon) => polygon.map((point) => point.q));
  if (values.length === 0 || !values.every(Number.isFinite)) throw new MechanicsGeometryError("Principal-axis boundary coordinates are not finite.");
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}
function coupledBending(ix, iy, ixy, scale, points, circularRadius) {
  const determinant = ix * iy - ixy * ixy;
  if (!Number.isFinite(determinant) || determinant <= 0) {
    throw new MechanicsGeometryError("Normalized inertia determinant is not positive and finite.");
  }
  const mxGradient = { x: -ixy / determinant, y: iy / determinant };
  const myGradient = { x: ix / determinant, y: -ixy / determinant };
  const values = (gradient) => {
    if (circularRadius !== null) {
      const maximum = circularRadius * Math.hypot(gradient.x, gradient.y);
      return { minimum: -maximum, maximum };
    }
    if (!points || points.length === 0) throw new MechanicsGeometryError("Material boundary points are required for coupled bending.");
    const responses = points.map((point) => gradient.x * point.x + gradient.y * point.y);
    if (!responses.every(Number.isFinite)) throw new MechanicsGeometryError("Coupled-bending response exceeds the finite numeric range.");
    return { minimum: Math.min(...responses), maximum: Math.max(...responses) };
  };
  const modulus = (gradient, label) => {
    const extremes = values(gradient);
    if (extremes.maximum <= 0 || extremes.minimum >= 0) {
      throw new MechanicsGeometryError(`${label} centroid does not lie inside its material boundary.`);
    }
    return {
      elastic_modulus_positive_mm3: scaled(1 / extremes.maximum, scale, 3, `${label} positive elastic modulus`),
      elastic_modulus_negative_mm3: scaled(1 / -extremes.minimum, scale, 3, `${label} negative elastic modulus`)
    };
  };
  return { mx: modulus(mxGradient, "Mx coupled bending"), my: modulus(myGradient, "My coupled bending") };
}
function polygonPlasticProperties(polygons, area, label) {
  const { minimum, maximum } = polygonExtremes(polygons);
  let lower = minimum, upper = maximum;
  for (let iteration = 0; iteration < 128; iteration++) {
    const middle = lower + (upper - lower) / 2;
    if (middle === lower || middle === upper) break;
    const below = clippedStats(polygons, middle, true).area;
    if (below < area / 2) lower = middle;
    else upper = middle;
  }
  const pna = lower + (upper - lower) / 2;
  if (!Number.isFinite(pna)) throw new MechanicsGeometryError(`${label} plastic neutral coordinate is not finite.`);
  return polygonPlasticPropertiesAt(polygons, pna, label);
}
function polygonPlasticPropertiesAt(polygons, pna, label) {
  const { minimum, maximum } = polygonExtremes(polygons);
  const below = clippedStats(polygons, pna, true);
  const above = clippedStats(polygons, pna, false);
  const modulus = compensatedSum([
    pna * below.area - below.firstMoment,
    above.firstMoment - pna * above.area
  ], `${label} plastic modulus`);
  if (!Number.isFinite(modulus) || modulus <= 0) throw new MechanicsGeometryError(`${label} plastic modulus is not positive and finite.`);
  return { pna, modulus, minimum, maximum };
}
function axisResult(axis, polygons, scale, canonicalArea, canonicalInertia, angle, label, includePlastic, areaNormalized, exactPnaAtCentroid = false) {
  const { minimum, maximum } = polygonExtremes(polygons);
  const plastic = includePlastic ? exactPnaAtCentroid ? polygonPlasticPropertiesAt(polygons, 0, label) : polygonPlasticProperties(polygons, areaNormalized, label) : null;
  const positiveExtreme = maximum;
  const negativeExtreme = minimum;
  if (positiveExtreme <= 0 || negativeExtreme >= 0) throw new MechanicsGeometryError(`${label} centroid does not lie inside its section boundary.`);
  const positiveDistance = scaled(positiveExtreme, scale, 1, `${label} positive extreme`);
  const negativeDistance = scaled(-negativeExtreme, scale, 1, `${label} negative extreme`);
  const elasticPositive = canonicalInertia / positiveDistance;
  const elasticNegative = canonicalInertia / negativeDistance;
  if (![elasticPositive, elasticNegative].every((value) => Number.isFinite(value) && value > 0)) {
    throw new MechanicsGeometryError(`${label} elastic section modulus is outside the finite numeric range.`);
  }
  return {
    axis_angle_degrees: angle,
    bending_coordinate: axis === "major" ? "v" : "u",
    inertia_mm4: canonicalInertia,
    extreme_positive_mm: positiveDistance,
    extreme_negative_mm: -negativeDistance,
    elastic_modulus_positive_mm3: elasticPositive,
    elastic_modulus_negative_mm3: elasticNegative,
    radius_mm: safeValue(Math.sqrt(canonicalInertia / canonicalArea), `${label} radius of gyration`),
    plastic_neutral_coordinate_mm: plastic === null ? null : scaled(plastic.pna, scale, 1, `${label} plastic neutral coordinate`),
    plastic_modulus_mm3: plastic === null ? null : scaled(plastic.modulus, scale, 3, `${label} plastic modulus`),
    plastic_status: plastic === null ? "not_requested" : "computed"
  };
}
function normalizedAngle(degrees) {
  const angle = (degrees % 180 + 180) % 180;
  return angle === 180 ? 0 : angle;
}
function reflectionSymmetries(type, dimensions) {
  if (type === "rectangle" || type === "rectangular_hollow") return { x: true, y: true };
  if (type === "i_section") {
    return {
      x: true,
      y: dimensions.top_flange_width === dimensions.bottom_flange_width && dimensions.top_flange_thickness === dimensions.bottom_flange_thickness
    };
  }
  if (type === "channel") return { x: false, y: true };
  if (type === "tee" || type === "double_angle") return { x: true, y: false };
  return { x: false, y: false };
}
function pnaIsExactlyCentroid(type, dimensions, axis, angle) {
  const symmetry = reflectionSymmetries(type, dimensions);
  if (symmetry.x && symmetry.y) return true;
  if (angle === 0) return axis === "major" ? symmetry.y : symmetry.x;
  if (angle === 90) return axis === "major" ? symmetry.x : symmetry.y;
  return false;
}
function geometryBox(type, dimensions, componentRects) {
  if (type === "rectangle") return { width: positive(dimensions.width, "width"), height: positive(dimensions.height, "height") };
  if (type === "circle" || type === "circular_hollow") {
    const diameter = positive(dimensions.diameter, "diameter");
    return { width: diameter, height: diameter };
  }
  const height = positive(type === "rectangular_hollow" ? dimensions.height : dimensions.depth, "section height");
  const width = type === "i_section" ? Math.max(positive(dimensions.top_flange_width, "top flange width"), positive(dimensions.bottom_flange_width, "bottom flange width")) : type === "double_angle" ? 2 * positive(dimensions.width, "angle width") + (() => {
    const gap = finite(dimensions.distance, "clear angle distance");
    if (gap < 0) throw new TypeError("Double-angle clear distance cannot be negative.");
    return gap;
  })() : positive(dimensions.width, "section width");
  if (componentRects?.length) return { width, height };
  throw new TypeError(`Rectangular material components are required for ${type}.`);
}
function readRectangles(result, type, dimensions) {
  if (type === "rectangle") {
    return [{ x: 0, y: 0, width: positive(dimensions.width, "width"), height: positive(dimensions.height, "height") }];
  }
  const source = result.diagnostics?.components;
  if (!Array.isArray(source) || source.length === 0) throw new TypeError(`Calculation result has no rectangular material components for ${type}.`);
  return source.map((part, index) => {
    if (!record(part)) throw new TypeError(`Component ${index} is not a rectangle record.`);
    const x = finite(part.x, `component ${index} x coordinate`);
    const y = finite(part.y, `component ${index} y coordinate`);
    if (x < 0 || y < 0) throw new TypeError(`Component ${index} must be inside the lower-left bounding box.`);
    return {
      x,
      y,
      width: positive(part.width, `component ${index} width`),
      height: positive(part.height, `component ${index} height`)
    };
  });
}
function calculateGeometryMechanics(result) {
  if (!record(result) || !record(result.normalized_input) || !record(result.normalized_input.geometry)) {
    throw new TypeError("A canonical section result with normalized geometry is required.");
  }
  const geometry = result.normalized_input.geometry;
  const type = geometry.type;
  if (typeof type !== "string" || !record(geometry.dimensions)) throw new TypeError("Canonical geometry type and dimensions are required.");
  if (result.normalized_input.units !== "mm") throw new TypeError("Mechanics geometry requires canonical millimetre inputs.");
  const dimensions = geometry.dimensions;
  const gross = canonicalGross(result);
  const includePlastic = result.normalized_input.options?.include_plastic !== false;
  if (type === "circle" || type === "circular_hollow") {
    const diameter = positive(dimensions.diameter, "diameter");
    const scale2 = diameter;
    const outerRadius = 0.5;
    const innerRadius = type === "circle" ? 0 : 0.5 - positive(dimensions.thickness, "wall thickness") / scale2;
    if (innerRadius < 0 || type === "circular_hollow" && !(innerRadius > 0 && innerRadius < outerRadius)) {
      throw new TypeError("Circular hollow geometry requires a representable positive inner radius.");
    }
    const area2 = Math.PI * (outerRadius - innerRadius) * (outerRadius + innerRadius);
    const inertia = area2 * (outerRadius * outerRadius + innerRadius * innerRadius) / 4;
    if (![area2, inertia].every((value) => Number.isFinite(value) && value > 0)) {
      throw new MechanicsGeometryError("Circular integration properties are outside the finite numeric range.");
    }
    closeEnough(unscaled(gross.area, scale2, 2, "canonical area"), area2, "Circular analytic area");
    closeEnough(unscaled(gross.centroidX, scale2, 1, "canonical x centroid"), 0.5, "Circular x centroid");
    closeEnough(unscaled(gross.centroidY, scale2, 1, "canonical y centroid"), 0.5, "Circular y centroid");
    closeEnough(unscaled(gross.ix, scale2, 4, "canonical Ix"), inertia, "Circular analytic Ix");
    closeEnough(unscaled(gross.iy, scale2, 4, "canonical Iy"), inertia, "Circular analytic Iy");
    closeEnough(unscaled(gross.ixy, scale2, 4, "canonical Ixy"), 0, "Circular analytic Ixy");
    closeEnough(unscaled(gross.iMajor, scale2, 4, "canonical major inertia"), inertia, "Circular analytic major inertia");
    closeEnough(unscaled(gross.iMinor, scale2, 4, "canonical minor inertia"), inertia, "Circular analytic minor inertia");
    if (gross.basisUnique) throw new MechanicsGeometryError("Circular sections must have an indeterminate principal orientation.");
    const centerX = gross.centroidX, centerY = gross.centroidY;
    const plasticModulus = 4 / 3 * (outerRadius ** 3 - innerRadius ** 3);
    const axis = (axisName) => {
      const inertiaMm4 = axisName === "major" ? gross.iMajor : gross.iMinor;
      const extentMm = scaled(outerRadius, scale2, 1, `${axisName} extreme`);
      return {
        axis_angle_degrees: axisName === "major" ? 0 : 90,
        bending_coordinate: axisName === "major" ? "v" : "u",
        inertia_mm4: inertiaMm4,
        extreme_positive_mm: extentMm,
        extreme_negative_mm: -extentMm,
        elastic_modulus_positive_mm3: safeValue(inertiaMm4 / extentMm, `${axisName} positive elastic modulus`),
        elastic_modulus_negative_mm3: safeValue(inertiaMm4 / extentMm, `${axisName} negative elastic modulus`),
        radius_mm: safeValue(Math.sqrt(inertiaMm4 / gross.area), `${axisName} radius of gyration`),
        plastic_neutral_coordinate_mm: includePlastic ? 0 : null,
        plastic_modulus_mm3: includePlastic ? scaled(plasticModulus, scale2, 3, `${axisName} plastic modulus`) : null,
        plastic_status: includePlastic ? "computed" : "not_requested"
      };
    };
    const representation = type === "circle" ? { kind: "circle", geometry_type: type, units: "mm", coordinate_system: { origin: "bounding_box_lower_left", x: "right", y: "up" }, bounding_box_mm: { width: diameter, height: diameter }, centroid_mm: { x: centerX, y: centerY }, area_mm2: gross.area, integration_primitives: { kind: "circle", center_x_mm: centerX, center_y_mm: centerY, radius_mm: centerX } } : { kind: "annulus", geometry_type: type, units: "mm", coordinate_system: { origin: "bounding_box_lower_left", x: "right", y: "up" }, bounding_box_mm: { width: diameter, height: diameter }, centroid_mm: { x: centerX, y: centerY }, area_mm2: gross.area, integration_primitives: { kind: "annulus", center_x_mm: centerX, center_y_mm: centerY, outer_radius_mm: centerX, inner_radius_mm: scaled(innerRadius, scale2, 1, "inner radius") } };
    return {
      representation,
      polar_centroidal: {
        inertia_mm4: safeValue(gross.ix + gross.iy, "polar inertia"),
        radius_mm: safeValue(Math.sqrt((gross.ix + gross.iy) / gross.area), "polar radius of gyration")
      },
      coupled_bending: coupledBending(
        unscaled(gross.ix, scale2, 4, "canonical Ix"),
        unscaled(gross.iy, scale2, 4, "canonical Iy"),
        unscaled(gross.ixy, scale2, 4, "canonical Ixy"),
        scale2,
        null,
        outerRadius
      ),
      principal: { basis_angle_degrees: 0, basis_unique: false, major: axis("major"), minor: axis("minor") },
      third_moments: { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 },
      third_moments_principal: { m30_mm5: 0, m21_mm5: 0, m12_mm5: 0, m03_mm5: 0 }
    };
  }
  const rectangles = readRectangles(result, type, dimensions);
  const box = geometryBox(type, dimensions, rectangles);
  const scale = Math.max(box.width, box.height);
  positive(scale, "normalization length");
  const canonicalArea = unscaled(gross.area, scale, 2, "canonical area");
  const cx = unscaled(gross.centroidX, scale, 1, "canonical x centroid");
  const cy = unscaled(gross.centroidY, scale, 1, "canonical y centroid");
  const centroidX = compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, "component width");
    const height = normalizedDimension(rectangle.height, scale, "component height");
    const areaTerm = width * height;
    if (areaTerm === 0) throw new MechanicsGeometryError("A normalized component area underflows the finite numeric range.");
    const term = areaTerm * ((rectangle.x + rectangle.width / 2) / scale);
    if (term === 0 && rectangle.x + rectangle.width / 2 !== 0) throw new MechanicsGeometryError("A normalized first area moment underflows the finite numeric range.");
    return safeValue(term, "normalized first area moment x");
  }), "first area moment x");
  const centroidY = compensatedSum(rectangles.map((rectangle) => {
    const width = normalizedDimension(rectangle.width, scale, "component width");
    const height = normalizedDimension(rectangle.height, scale, "component height");
    const areaTerm = width * height;
    if (areaTerm === 0) throw new MechanicsGeometryError("A normalized component area underflows the finite numeric range.");
    const term = areaTerm * ((rectangle.y + rectangle.height / 2) / scale);
    if (term === 0 && rectangle.y + rectangle.height / 2 !== 0) throw new MechanicsGeometryError("A normalized first area moment underflows the finite numeric range.");
    return safeValue(term, "normalized first area moment y");
  }), "first area moment y");
  const area = compensatedSum(
    rectangles.map((rectangle) => {
      const width = normalizedDimension(rectangle.width, scale, "component width");
      const height = normalizedDimension(rectangle.height, scale, "component height");
      const value = width * height;
      if (value === 0) throw new MechanicsGeometryError("A normalized component area underflows the finite numeric range.");
      return safeValue(value, "normalized component area");
    }),
    "section area"
  );
  if (!Number.isFinite(area) || area <= 0) throw new MechanicsGeometryError("Normalized material area is not positive and finite.");
  closeEnough(area, canonicalArea, "Component area");
  closeEnough(centroidX / area, cx, "Component x centroid");
  closeEnough(centroidY / area, cy, "Component y centroid");
  const moments = /* @__PURE__ */ new Map();
  for (let totalPower = 0; totalPower <= 3; totalPower++) {
    for (let px = 0; px <= totalPower; px++) {
      const py = totalPower - px;
      moments.set(momentKey(px, py), rectMoment(rectangles, cx, cy, scale, px, py));
    }
  }
  const symmetry = reflectionSymmetries(type, dimensions);
  if (symmetry.x || symmetry.y) moments.set(momentKey(1, 1), 0);
  if (symmetry.x) {
    moments.set(momentKey(3, 0), 0);
    moments.set(momentKey(1, 2), 0);
  }
  if (symmetry.y) {
    moments.set(momentKey(2, 1), 0);
    moments.set(momentKey(0, 3), 0);
  }
  const ix = moments.get(momentKey(0, 2));
  const iy = moments.get(momentKey(2, 0));
  const ixy = moments.get(momentKey(1, 1));
  if (![ix, iy].every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(ixy)) {
    throw new MechanicsGeometryError("Normalized centroidal inertias are not finite and positive.");
  }
  const canonicalIx = unscaled(gross.ix, scale, 4, "canonical Ix");
  const canonicalIy = unscaled(gross.iy, scale, 4, "canonical Iy");
  const canonicalIxy = unscaled(gross.ixy, scale, 4, "canonical Ixy");
  closeEnough(ix, canonicalIx, "Component Ix");
  closeEnough(iy, canonicalIy, "Component Iy");
  closeEnough(ixy, canonicalIxy, "Component Ixy");
  const mean = ix / 2 + iy / 2;
  const radius = Math.hypot(ix / 2 - iy / 2, ixy);
  const majorInertia = mean + radius;
  const determinant = ix * iy - ixy * ixy;
  const minorInertia = determinant / majorInertia;
  if (![majorInertia, minorInertia].every((value) => Number.isFinite(value) && value > 0)) {
    throw new MechanicsGeometryError("Normalized principal inertias are outside the finite numeric range.");
  }
  const canonicalMajor = unscaled(gross.iMajor, scale, 4, "canonical major inertia");
  const canonicalMinor = unscaled(gross.iMinor, scale, 4, "canonical minor inertia");
  closeEnough(majorInertia, canonicalMajor, "Component major principal inertia");
  closeEnough(minorInertia, canonicalMinor, "Component minor principal inertia");
  const basisUnique = gross.basisUnique;
  const basisAngle = gross.basisAngle;
  const radians = basisAngle * Math.PI / 180;
  const cosine2 = Math.cos(radians), sine2 = Math.sin(radians);
  const majorPolygons = rectanglePolygons(rectangles, cx, cy, scale, cosine2, sine2, "major");
  const minorPolygons = rectanglePolygons(rectangles, cx, cy, scale, cosine2, sine2, "minor");
  const major = axisResult("major", majorPolygons, scale, gross.area, gross.iMajor, basisAngle, "Principal major axis", includePlastic, canonicalArea, pnaIsExactlyCentroid(type, dimensions, "major", basisAngle));
  const minorAngle = normalizedAngle(basisAngle + 90);
  const minor = axisResult("minor", minorPolygons, scale, gross.area, gross.iMinor, minorAngle, "Principal minor axis", includePlastic, canonicalArea, pnaIsExactlyCentroid(type, dimensions, "minor", basisAngle));
  const polarInertia = gross.ix + gross.iy;
  if (!Number.isFinite(polarInertia) || polarInertia <= 0) throw new MechanicsGeometryError("Canonical polar inertia is not positive and finite.");
  const third = {
    m30_mm5: scaled(moments.get(momentKey(3, 0)), scale, 5, "M30"),
    m21_mm5: scaled(moments.get(momentKey(2, 1)), scale, 5, "M21"),
    m12_mm5: scaled(moments.get(momentKey(1, 2)), scale, 5, "M12"),
    m03_mm5: scaled(moments.get(momentKey(0, 3)), scale, 5, "M03")
  };
  const principalThird = {
    m30_mm5: scaled(transformedMoment(moments, 3, 0, cosine2, sine2), scale, 5, "principal M30"),
    m21_mm5: scaled(transformedMoment(moments, 2, 1, cosine2, sine2), scale, 5, "principal M21"),
    m12_mm5: scaled(transformedMoment(moments, 1, 2, cosine2, sine2), scale, 5, "principal M12"),
    m03_mm5: scaled(transformedMoment(moments, 0, 3, cosine2, sine2), scale, 5, "principal M03")
  };
  const integrationPrimitives = rectangles.map((rectangle) => ({
    kind: "rectangle",
    x_min_mm: rectangle.x,
    y_min_mm: rectangle.y,
    width_mm: rectangle.width,
    height_mm: rectangle.height
  }));
  const boundaryPoints = rectangles.flatMap((rectangle) => {
    const x0 = rectangle.x / scale - cx, x1 = (rectangle.x + rectangle.width) / scale - cx;
    const y0 = rectangle.y / scale - cy, y1 = (rectangle.y + rectangle.height) / scale - cy;
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  });
  const kind = type === "rectangle" ? "rectangle" : "rectangular_components";
  return {
    representation: {
      kind,
      geometry_type: type,
      units: "mm",
      coordinate_system: { origin: "bounding_box_lower_left", x: "right", y: "up" },
      bounding_box_mm: box,
      centroid_mm: { x: gross.centroidX, y: gross.centroidY },
      area_mm2: gross.area,
      integration_primitives: integrationPrimitives
    },
    polar_centroidal: {
      inertia_mm4: polarInertia,
      radius_mm: safeValue(Math.sqrt(polarInertia / gross.area), "polar radius of gyration")
    },
    coupled_bending: coupledBending(canonicalIx, canonicalIy, canonicalIxy, scale, boundaryPoints, null),
    principal: { basis_angle_degrees: basisAngle, basis_unique: basisUnique, major, minor },
    third_moments: third,
    third_moments_principal: principalThird
  };
}

// ../../section-properties/core/mechanics-advanced.ts
var inverseUnits = { torque: "mm-3", force: "mm-2", bimoment: "mm-4" };
var notComputed = (reason) => ({ status: "not_computed", reason });
function rectangleOmega(x, y, a, b, terms) {
  let sum2 = 0;
  for (let i = 0; i < terms; i++) {
    const n = 2 * i + 1, k = n * Math.PI / (2 * b);
    const ratio = Math.sign(x) * Math.exp(-k * (a - Math.abs(x))) * -Math.expm1(-2 * k * Math.abs(x)) / (1 + Math.exp(-2 * k * a));
    sum2 += (i % 2 ? -1 : 1) * ratio * Math.sin(k * y) / n ** 3;
  }
  return -x * y + 32 * b * b / Math.PI ** 3 * sum2;
}
function rectangleWarpingBounds(a, b) {
  const terms = 1024;
  const truncationTail = 8 * b * b / (Math.PI ** 3 * (2 * terms - 1) ** 2);
  const roundoffEstimate = 64 * terms * Number.EPSILON * (a * b + 2 * b * b);
  const seriesTail = truncationTail + roundoffEstimate;
  const heap = [];
  const evaluate = (edge, coordinate) => edge === 0 ? Math.abs(rectangleOmega(coordinate, b, a, b, terms)) : Math.abs(rectangleOmega(a, coordinate, a, b, terms));
  let best = 0;
  const push = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (heap[parent].upper >= node.upper) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = node;
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && heap[child + 1].upper > heap[child].upper) child++;
        if (last.upper >= heap[child].upper) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const add2 = (lo, hi, edge) => {
    const sample = evaluate(edge, (lo + hi) / 2);
    best = Math.max(best, sample);
    const lipschitz = edge === 0 ? 3 * b : a + 2 * b;
    push({ lo, hi, edge, upper: sample + seriesTail + lipschitz * (hi - lo) / 2 });
  };
  best = Math.max(evaluate(0, 0), evaluate(0, a), evaluate(1, 0), evaluate(1, b));
  add2(0, a, 0);
  add2(0, b, 1);
  let iterations = 0;
  while (heap.length && iterations < 8192) {
    const lower2 = Math.max(0, best - seriesTail);
    if (heap[0].upper - lower2 <= Math.max(best * 1e-4, seriesTail * 4)) break;
    const node = pop(), mid = (node.lo + node.hi) / 2;
    add2(node.lo, mid, node.edge);
    add2(mid, node.hi, node.edge);
    iterations++;
  }
  const lower = Math.max(0, best - seriesTail), upper = Math.max(best + seriesTail, heap[0]?.upper ?? best + seriesTail);
  return { lower, upper, estimate: (lower + upper) / 2, error: (upper - lower) / 2, truncation_tail_bound: truncationTail, floating_point_error_estimate: roundoffEstimate, terms, iterations, relative_enclosure_width: lower > 0 ? (upper - lower) / lower : null };
}
function polynomialMax(q0, a, b, length) {
  const evaluate = (s) => q0 + a * s + b * s * s / 2;
  const points = [0, length];
  if (b !== 0 && -a / b > 0 && -a / b < length) points.push(-a / b);
  return Math.max(...points.map((s) => Math.abs(evaluate(s))));
}
function crossEnergy(x, y) {
  let energy = 0;
  for (let i = 0; i < x.length; i++) {
    const sx = x[i], sy = y[i], wall = sx.segment;
    if (wall.thickness <= 0) continue;
    const length = Math.hypot(wall.x1 - wall.x0, wall.y1 - wall.y0);
    const cx = [sx.q0, sx.a, sx.b / 2], cy = [sy.q0, sy.a, sy.b / 2];
    for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) energy += cx[p] * cy[q] * length ** (p + q + 1) / ((p + q + 1) * wall.thickness);
  }
  return energy;
}
function calculateAdvancedMechanics(result, geometryMechanics) {
  const advanced = result.advanced;
  if (!result.normalized_input.options.include_advanced) return { status: "not_requested", reason: "advanced_not_requested" };
  if (Object.values(advanced).some((p2) => p2.status !== "computed")) return notComputed("advanced_property_unavailable");
  const geometry = result.normalized_input.geometry, dims = geometry.dimensions;
  const gross = result.properties.geometric, elastic = result.properties.elastic, sc = advanced.shear_center.value;
  const scale = Math.max(result.diagnostics.bounding_box.x_max, result.diagnostics.bounding_box.y_max);
  const j = advanced.torsion_constant_j.value, cw = advanced.warping_constant_cw.value;
  const ip = elastic.ix + elastic.iy, ex = sc.offset_x, ey = sc.offset_y;
  const r0square = ip / gross.area + ex * ex + ey * ey;
  const angle = (geometryMechanics.principal.basis_angle_degrees ?? 0) * Math.PI / 180;
  const eu = ex * Math.cos(angle) + ey * Math.sin(angle), ev = -ex * Math.sin(angle) + ey * Math.cos(angle);
  const m = geometryMechanics.third_moments, p = geometryMechanics.third_moments_principal;
  const output = {
    status: "computed",
    reason: null,
    shear_center_geometry: { polar_inertia_mm4: ip + gross.area * (ex * ex + ey * ey), polar_radius_mm: Math.sqrt(r0square), coupling_factor: ip / gross.area / r0square, offset_x_mm: ex, offset_y_mm: ey },
    wagner: {
      beta_x_mm: (m.m21_mm5 + m.m03_mm5) / elastic.ix - 2 * ey,
      beta_y_mm: (m.m30_mm5 + m.m12_mm5) / elastic.iy - 2 * ex,
      beta_major_mm: (p.m21_mm5 + p.m03_mm5) / result.properties.principal.i_major - 2 * ev,
      beta_minor_mm: (p.m30_mm5 + p.m12_mm5) / result.properties.principal.i_minor - 2 * eu
    },
    fields: { units: inverseUnits, normal_stress: { coordinate_origin: "gross_centroid", moment_convention: "Mx=integral(Y*sigma)dA; My=integral(X*sigma)dA; tension-positive N", expression: "sigma=N/A + [(My*Ix-Mx*Ixy)*X+(Mx*Iy-My*Ixy)*Y]/(Ix*Iy-Ixy^2) + B*omega/Cw", bimoment_unit: "N mm2" } }
  };
  if (geometry.type === "rectangle") {
    const a = Math.max(dims.width, dims.height) / (2 * scale), b = Math.min(dims.width, dims.height) / (2 * scale);
    let sum2 = 0;
    for (let i = 0; i < 64; i++) {
      const n = 2 * i + 1, z = n * Math.PI * a / (2 * b);
      sum2 += 2 * Math.exp(-z) / (1 + Math.exp(-2 * z)) / n ** 2;
    }
    const maxGradient = (2 * b - 16 * b / Math.PI ** 2 * sum2) * scale;
    output.torsion = { status: "computed", method: "solid_rectangle_saint_venant_boundary_gradient", modulus_mm3: j / maxGradient, unit_max_shear_per_torque_mm3_inverse: maxGradient / j };
    output.shear = { method: "jourawski_rectangle", modulus_x_mm2: 2 * gross.area / 3, modulus_y_mm2: 2 * gross.area / 3, compliance: { xx_mm2_inverse: 1 / advanced.effective_shear_area.value.x, xy_mm2_inverse: 0, yy_mm2_inverse: 1 / advanced.effective_shear_area.value.y } };
    const bounds = rectangleWarpingBounds(a, b);
    output.warping = {
      status: "computed",
      method: "harmonic_fourier_boundary_enclosure",
      omega_positive_mm2: bounds.estimate * scale ** 2,
      omega_negative_mm2: -bounds.estimate * scale ** 2,
      modulus_positive_mm4: cw / (bounds.upper * scale ** 2),
      modulus_negative_mm4: cw / (bounds.upper * scale ** 2),
      absolute_error_bound_mm2: bounds.error * scale ** 2,
      extrema_enclosure_mm2: { absolute_lower: bounds.lower * scale ** 2, absolute_upper: bounds.upper * scale ** 2 },
      modulus_convention: "lower_bound_using_upper_omega_enclosure",
      convergence: bounds
    };
    output.fields.rectangle = {
      model: "saint_venant_harmonic_fourier",
      long_axis: dims.width >= dims.height ? "x" : "y",
      half_long_mm: a * scale,
      half_short_mm: b * scale,
      terms: bounds.terms,
      warping_expression: "psi=-xy+32b^2/pi^3 sum_odd((-1)^((n-1)/2)/n^3 * sinh(n*pi*x/(2b))/cosh(n*pi*a/(2b))*sin(n*pi*y/(2b)))",
      coordinate_convention: "centered x along longer side, y shorter; physical omega=psi when long_axis=x, omega=-psi when long_axis=y",
      stress_function_expression: "phi=b^2-y^2-32b^2/pi^3 sum_odd((-1)^((n-1)/2)/n^3*cosh(n*pi*x/(2b))/cosh(n*pi*a/(2b))*cos(n*pi*y/(2b)))",
      torsion_shear_expression: "phi_phys(X,Y)=phi(X,Y) when long_axis=x, else phi(Y,X); (tau_x,tau_y)=T/J*(d_phi_phys/dY,-d_phi_phys/dX)",
      shear_expression: "tau_x/Vx=3/(2A)*(1-4X^2/width^2); tau_y/Vy=3/(2A)*(1-4Y^2/height^2)"
    };
  } else if (geometry.type === "circle" || geometry.type === "circular_hollow") {
    const radius = dims.diameter / 2;
    output.torsion = { status: "computed", method: "axisymmetric_exact_saint_venant", modulus_mm3: j / radius, unit_max_shear_per_torque_mm3_inverse: radius / j };
    const shearModulus = geometry.type === "circle" ? 3 * gross.area / 4 : Math.PI * (radius - dims.thickness / 2) * dims.thickness;
    output.shear = {
      method: geometry.type === "circle" ? "jourawski_circle" : "median_ring_thin_wall_shear_flow",
      modulus_x_mm2: shearModulus,
      modulus_y_mm2: shearModulus,
      compliance: { xx_mm2_inverse: 1 / advanced.effective_shear_area.value.x, xy_mm2_inverse: 0, yy_mm2_inverse: 1 / advanced.effective_shear_area.value.y }
    };
    output.warping = { status: "not_applicable", method: "axisymmetric_zero_warping", omega_positive_mm2: 0, omega_negative_mm2: 0, modulus_positive_mm4: null, modulus_negative_mm4: null, reason: "zero_warping" };
    output.fields.circular = {
      model: geometry.type === "circle" ? "solid_circle_jourawski" : "median_ring",
      outer_radius_mm: radius,
      median_radius_mm: geometry.type === "circle" ? null : radius - dims.thickness / 2,
      thickness_mm: geometry.type === "circle" ? null : dims.thickness,
      torsion_shear_expression: "(tau_x,tau_y)=T/J*(-Y,X)",
      shear_expression: geometry.type === "circle" ? "tau_x/Vx=4/(3A)*(1-X^2/R^2); tau_y/Vy=4/(3A)*(1-Y^2/R^2)" : "qx/Vx=-sin(theta)/(pi*Rm); qy/Vy=cos(theta)/(pi*Rm); tau=q/t",
      warping_expression: "omega=0"
    };
  } else {
    const wall = sectionWallMechanics(geometry, scale);
    const materialWalls = wall.walls.filter((w) => w.thickness > 0);
    const maxThickness = Math.max(...materialWalls.map((w) => w.thickness)) * scale;
    const medianArea = geometry.type === "rectangular_hollow" ? (dims.width - dims.thickness) * (dims.height - dims.thickness) : null;
    const torsionModulus = medianArea === null ? j / maxThickness : 2 * medianArea * dims.thickness;
    output.torsion = { status: "computed", method: wall.closed ? "single_cell_bredt_thin_wall" : "open_wall_surface_shear_thin_wall", modulus_mm3: torsionModulus, unit_max_shear_per_torque_mm3_inverse: 1 / torsionModulus };
    const flowMax = (flow) => Math.max(...flow.filter((s) => s.segment.thickness > 0).map((s) => polynomialMax(s.q0, s.a, s.b, Math.hypot(s.segment.x1 - s.segment.x0, s.segment.y1 - s.segment.y0)) / s.segment.thickness));
    output.shear = {
      method: wall.closed ? "closed_cell_thin_wall_shear_energy" : "open_section_thin_wall_shear_energy",
      modulus_x_mm2: scale ** 2 / flowMax(wall.flowX),
      modulus_y_mm2: scale ** 2 / flowMax(wall.flowY),
      compliance: { xx_mm2_inverse: wall.responseX.energy / scale ** 2, xy_mm2_inverse: crossEnergy(wall.flowX, wall.flowY) / scale ** 2, yy_mm2_inverse: wall.responseY.energy / scale ** 2 }
    };
    const omegaEnds = wall.warping.filter((s) => s.wall.thickness > 0).flatMap((s) => [s.start, s.start + s.derivative * s.length]);
    const positive2 = Math.max(...omegaEnds) * scale ** 2, negative = Math.min(...omegaEnds) * scale ** 2;
    output.warping = {
      status: cw === 0 ? "not_applicable" : "computed",
      method: wall.closed ? "closed_wall_sectorial_linear" : "open_wall_sectorial_linear",
      omega_positive_mm2: positive2,
      omega_negative_mm2: negative,
      modulus_positive_mm4: cw === 0 ? null : cw / positive2,
      modulus_negative_mm4: cw === 0 ? null : cw / Math.abs(negative),
      reason: cw === 0 ? "zero_warping" : null
    };
    output.fields.wall_model = {
      coordinate_origin: "bounding_box_bottom_left",
      shear_coordinate: "s increases from wall start to end",
      warping_normalization: "zero material-weighted mean",
      virtual_links: "zero-thickness walls transfer reactions but carry no material stress/energy",
      centroid_mm: { x: wall.line.cx * scale, y: wall.line.cy * scale },
      shear_center_mm: { x: wall.pole.x * scale, y: wall.pole.y * scale },
      walls: wall.walls.map((w) => ({ label: w.label, start_mm: { x: w.x0 * scale, y: w.y0 * scale }, end_mm: { x: w.x1 * scale, y: w.y1 * scale }, thickness_mm: w.thickness * scale, material: w.thickness > 0 })),
      unit_shear_x: wall.flowX.map((s) => ({ label: s.segment.label, start_mm: { x: s.segment.x0 * scale, y: s.segment.y0 * scale }, end_mm: { x: s.segment.x1 * scale, y: s.segment.y1 * scale }, q0_mm_inverse: s.q0 / scale, q1_mm2_inverse: s.a / scale ** 2, q2_mm3_inverse: s.b / (2 * scale ** 3) })),
      unit_shear_y: wall.flowY.map((s) => ({ label: s.segment.label, start_mm: { x: s.segment.x0 * scale, y: s.segment.y0 * scale }, end_mm: { x: s.segment.x1 * scale, y: s.segment.y1 * scale }, q0_mm_inverse: s.q0 / scale, q1_mm2_inverse: s.a / scale ** 2, q2_mm3_inverse: s.b / (2 * scale ** 3) })),
      warping: wall.warping.map((s) => ({ label: s.wall.label, start_mm: { x: s.wall.x0 * scale, y: s.wall.y0 * scale }, end_mm: { x: s.wall.x1 * scale, y: s.wall.y1 * scale }, omega0_mm2: s.start * scale ** 2, omega1_mm: s.derivative * scale })),
      torsion_shear_expression: wall.closed ? "tau/T=1/(2*Am*t)" : "tau_s/T=-2*n/J; n is signed across wall thickness, q0=0 for Saint-Venant plate torsion",
      median_cell_area_mm2: medianArea
    };
  }
  return output;
}

// ../../section-properties/index.ts
var finiteTree = (value) => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finiteTree) : value && typeof value === "object" ? Object.values(value).every(finiteTree) : true;
async function calculateSectionProperties(input) {
  const { profile_id: profileId, ...calculation } = input;
  const profile = profileId === void 0 ? void 0 : section_registry_default.profiles.find((profile2) => profile2.id === profileId);
  if (profileId !== void 0 && (!profile || profile.geometry_type !== calculation.geometry?.type)) {
    throw new DemoCalculationError("INVALID_GEOMETRY", "The selected section profile is incompatible with the geometry.");
  }
  const result = await calculateDemoSection(calculation);
  if (profile?.id === "symmetric_i") {
    const dimensions = result.normalized_input.geometry.dimensions;
    if (dimensions.top_flange_width !== dimensions.bottom_flange_width || dimensions.top_flange_thickness !== dimensions.bottom_flange_thickness) {
      throw new DemoCalculationError("INVALID_GEOMETRY", "A symmetric I/H profile must have equal flange widths and thicknesses.");
    }
  }
  let mechanicsGeometry;
  let mechanicsAdvanced;
  try {
    mechanicsGeometry = { status: "computed", method: "normalized_material_integrals_and_principal_polygon_cuts", ...calculateGeometryMechanics(result) };
    if (!finiteTree(mechanicsGeometry)) throw new RangeError("Geometry mechanics exceed the numerical range.");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    mechanicsGeometry = { status: "not_computed", reason: "numerical_range", method: "normalized_material_integrals_and_principal_polygon_cuts" };
  }
  try {
    mechanicsAdvanced = mechanicsGeometry.status === "computed" ? calculateAdvancedMechanics(result, mechanicsGeometry) : { status: "not_computed", reason: "geometry_mechanics_unavailable" };
    if (!finiteTree(mechanicsAdvanced)) throw new RangeError("Advanced mechanics exceed the numerical range.");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    mechanicsAdvanced = { status: "not_computed", reason: "numerical_range" };
  }
  result.mechanics = { schema_version: "1.0", solver_version: "1.0.0", geometry: mechanicsGeometry, advanced: mechanicsAdvanced };
  const report = await buildFormulaReport(result, profileId);
  return { ...result, formula_report: report };
}

// src/steel-design/hi-section-properties.ts
function finitePositive(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Invalid H/I geometry: ${label} must be finite and positive`);
  }
  return value;
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function finiteTree2(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree2);
  if (value !== null && typeof value === "object") return Object.values(value).every(finiteTree2);
  return true;
}
async function calculateHISectionProperties(input, legacy = {}) {
  const h = finitePositive(input.h_mm, "h"), bf = finitePositive(input.bf_mm, "bf");
  const tw = finitePositive(input.tw_mm, "tw"), tf = finitePositive(input.tf_mm, "tf");
  if (h <= 2 * tf || tw > bf) throw new RangeError("Invalid doubly symmetric I/H geometry");
  const result = await calculateSectionProperties({
    profile_id: "symmetric_i",
    geometry: {
      type: "i_section",
      geometry_variant: "sharp_corner",
      dimensions: {
        depth: h,
        top_flange_width: bf,
        bottom_flange_width: bf,
        top_flange_thickness: tf,
        bottom_flange_thickness: tf,
        web_thickness: tw
      }
    },
    units: "mm",
    options: { include_plastic: true, include_advanced: true }
  });
  if (result.geometry_type !== "i_section" || result.geometry_hash.length !== 64) throw new Error("Unexpected section engine response");
  if (result.normalized_input.geometry.dimensions.top_flange_width !== bf || result.normalized_input.geometry.dimensions.bottom_flange_width !== bf) {
    throw new Error("Shared engine input mismatch");
  }
  const elastic = result.properties.elastic, plastic = result.properties.plastic;
  if (!plastic) throw new Error("Plastic section properties unavailable");
  const adv = result.advanced;
  const canonical = {
    area_mm2: result.properties.geometric.area,
    ix_mm4: elastic.ix,
    iy_mm4: elastic.iy,
    sx_mm3: Math.min(elastic.sx_positive, elastic.sx_negative),
    sy_mm3: Math.min(elastic.sy_positive, elastic.sy_negative),
    zx_mm3: plastic.zx,
    zy_mm3: plastic.zy,
    rx_mm: elastic.rx,
    ry_mm: elastic.ry,
    torsion_constant_j_mm4: numberOrNull(adv.torsion_constant_j.value),
    warping_constant_cw_mm6: numberOrNull(adv.warping_constant_cw.value),
    shear_center_x_mm: numberOrNull(adv.shear_center.value?.x),
    shear_center_y_mm: numberOrNull(adv.shear_center.value?.y),
    effective_shear_area_x_mm2: numberOrNull(adv.effective_shear_area.value?.x),
    effective_shear_area_y_mm2: numberOrNull(adv.effective_shear_area.value?.y)
  };
  for (const value of Object.values(canonical)) {
    if (value !== null && !Number.isFinite(value)) throw new Error("Non-finite shared section property");
  }
  const formulaReport = result.formula_report;
  const entries = formulaReport.properties.map((row) => ({
    key: row.key,
    symbol: row.symbol,
    unit: row.unit,
    value: row.value,
    status: row.status,
    method: row.method,
    formula: row.expression,
    substitution: row.substitution?.expression ?? "",
    reference_ids: row.reference_ids ?? [],
    reason: row.reason
  }));
  if (!finiteTree2(entries.map((row) => row.value))) {
    throw new Error("Shared formulas returned a non-finite property");
  }
  const comparisons = Object.entries({
    area_mm2: canonical.area_mm2,
    ix_mm4: canonical.ix_mm4,
    iy_mm4: canonical.iy_mm4,
    sx_mm3: canonical.sx_mm3,
    sy_mm3: canonical.sy_mm3,
    zx_mm3: canonical.zx_mm3,
    zy_mm3: canonical.zy_mm3,
    rx_mm: canonical.rx_mm,
    ry_mm: canonical.ry_mm,
    // Torsion J intentionally kept as a separate comparison.
    // Median-wall and workbook geometric conventions may differ.
    j_legacy_mm4: canonical.torsion_constant_j_mm4
  }).flatMap(([key, current]) => {
    const older = legacy[key];
    if (typeof older !== "number" || typeof current !== "number" || !Number.isFinite(older) || !Number.isFinite(current)) return [];
    const diff = Math.abs(current - older) / Math.max(1, Math.abs(older), Math.abs(current));
    return [{
      key,
      canonical: current,
      legacy: older,
      relative_difference: diff,
      matching: diff <= 1e-6,
      design_use: key === "j_legacy_mm4" ? "REVIEW_DIFFERENT_TORSION_CONVENTIONS" : "GEOMETRY_PARITY_ONLY"
    }];
  });
  return {
    source: "Section Properties shared numerical core",
    geometry_type: "i_section",
    units: "mm",
    geometry_hash: result.geometry_hash,
    solver_version: result.solver.version,
    formula_library_version: formulaReport.library_version,
    formula_manifest_hash: formulaReport.manifest_hash,
    canonical,
    entries,
    comparisons,
    assumptions: formulaReport.assumptions,
    verification: "GEOMETRY_ONLY_NOT_AISC_CAPACITY_CERTIFICATION"
  };
}
export {
  calculateHISectionProperties
};
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
