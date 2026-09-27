// LeetCode-style coding questions: the trainer declares a function signature, learners implement
// just that function, and a hidden driver (added here, server-side) parses the test input, calls
// the function and prints the result as JSON.
//
// Test input format: one JSON value per line, one line per parameter, e.g. "[2,7,11,15]\n9".
// Expected output: the JSON of the return value, e.g. "[0,1]". Outputs are compared as JSON
// (see outputsMatch), so 2 == 2.0 and whitespace never matters.

export const PARAM_TYPES = [
  'int',
  'long',
  'double',
  'boolean',
  'string',
  'int[]',
  'long[]',
  'double[]',
  'boolean[]',
  'string[]',
  'int[][]',
  'string[][]'
] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

export interface FunctionSignature {
  functionName: string;
  params: { name: string; type: ParamType }[];
  returnType: ParamType;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const RESERVED = new Set([
  'Solution',
  'Main',
  'main',
  'solve',
  'class',
  'function',
  'var',
  'let',
  'int',
  'def'
]);

// Returns an error message, or null when the signature is usable in every language.
export function signatureError(sig: unknown): string | null {
  const s = sig as FunctionSignature;
  if (!s || typeof s !== 'object') return 'signature must be an object';
  if (!IDENT.test(String(s.functionName)) || RESERVED.has(s.functionName)) {
    return 'functionName must be a plain identifier (letters, digits, _)';
  }
  if (!Array.isArray(s.params) || s.params.length < 1 || s.params.length > 8) {
    return 'signature needs 1 to 8 parameters';
  }
  const names = new Set<string>();
  for (const p of s.params) {
    if (!IDENT.test(String(p?.name)) || RESERVED.has(p.name) || p.name.startsWith('__')) {
      return `parameter name '${p?.name}' is not a plain identifier`;
    }
    if (names.has(p.name)) return `parameter '${p.name}' is declared twice`;
    names.add(p.name);
    if (!(PARAM_TYPES as readonly string[]).includes(p.type)) {
      return `parameter '${p.name}' has unknown type '${p.type}'`;
    }
  }
  if (!(PARAM_TYPES as readonly string[]).includes(s.returnType)) {
    return `unknown return type '${s.returnType}'`;
  }
  return null;
}

/* ------------------------------------------------------------------ type names per language */

const base = (t: ParamType) =>
  t.replace(/\[\]/g, '') as 'int' | 'long' | 'double' | 'boolean' | 'string';
const depth = (t: ParamType) => (t.match(/\[\]/g) || []).length;

const JS_T = {
  int: 'number',
  long: 'number',
  double: 'number',
  boolean: 'boolean',
  string: 'string'
};
const PY_T = { int: 'int', long: 'int', double: 'float', boolean: 'bool', string: 'str' };
const CPP_T = {
  int: 'int',
  long: 'long long',
  double: 'double',
  boolean: 'bool',
  string: 'string'
};
const JAVA_T = { int: 'int', long: 'long', double: 'double', boolean: 'boolean', string: 'String' };

const jsType = (t: ParamType) => JS_T[base(t)] + '[]'.repeat(depth(t));
const pyType = (t: ParamType) => {
  let s = PY_T[base(t)];
  for (let i = 0; i < depth(t); i++) s = `List[${s}]`;
  return s;
};
const cppType = (t: ParamType) => {
  let s = CPP_T[base(t)];
  for (let i = 0; i < depth(t); i++) s = `vector<${s}>`;
  return s;
};
const javaType = (t: ParamType) => JAVA_T[base(t)] + '[]'.repeat(depth(t));

/* ------------------------------------------------------------------ starter code (what learners see) */

export function starterCode(sig: FunctionSignature, language: string): string {
  const { functionName: fn, params, returnType } = sig;
  switch (language) {
    case 'javascript':
      return [
        '/**',
        ...params.map((p) => ` * @param {${jsType(p.type)}} ${p.name}`),
        ` * @return {${jsType(returnType)}}`,
        ' */',
        `var ${fn} = function(${params.map((p) => p.name).join(', ')}) {`,
        '    ',
        '};',
        ''
      ].join('\n');
    case 'python':
      return [
        ...params.map((p) => `# @param ${p.name}: ${pyType(p.type)}`),
        `# @return: ${pyType(returnType)}`,
        'class Solution:',
        `    def ${fn}(self, ${params.map((p) => `${p.name}: ${pyType(p.type)}`).join(', ')}) -> ${pyType(returnType)}:`,
        '        ',
        ''
      ].join('\n');
    case 'cpp':
      return [
        '/**',
        ...params.map((p) => ` * @param ${p.name}: ${cppType(p.type)}`),
        ` * @return: ${cppType(returnType)}`,
        ' */',
        'class Solution {',
        'public:',
        `    ${cppType(returnType)} ${fn}(${params
          .map(
            (p) =>
              `${cppType(p.type)}${depth(p.type) || base(p.type) === 'string' ? '&' : ''} ${p.name}`
          )
          .join(', ')}) {`,
        '        ',
        '    }',
        '};',
        ''
      ].join('\n');
    case 'java':
      return [
        '/**',
        ...params.map((p) => ` * @param ${p.name}: ${javaType(p.type)}`),
        ` * @return: ${javaType(returnType)}`,
        ' */',
        'class Solution {',
        `    public ${javaType(returnType)} ${fn}(${params.map((p) => `${javaType(p.type)} ${p.name}`).join(', ')}) {`,
        '        ',
        '    }',
        '}',
        ''
      ].join('\n');
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ drivers (hidden, server-side) */

// JavaScript runs in the in-process sandbox, which calls solve(rawInput) and expects a string back.
function wrapJavaScript(sig: FunctionSignature, code: string) {
  const args = sig.params.map((_, i) => `JSON.parse(__lines[${i}])`).join(', ');
  return `${code}
;function solve(__input) {
  var __lines = String(__input).split('\\n').filter(function (l) { return l.trim() !== ''; });
  if (typeof ${sig.functionName} !== 'function') throw new Error('Define ${sig.functionName}(${sig.params.map((p) => p.name).join(', ')}).');
  var __r = ${sig.functionName}(${args});
  return JSON.stringify(__r === undefined ? null : __r);
}`;
}

function wrapPython(sig: FunctionSignature, code: string) {
  return `import sys, json, math, heapq, bisect, itertools, functools, collections, string, re
from typing import *
from collections import *
from functools import *
from itertools import *

${code}

def __kn_main():
    lines = [l for l in sys.stdin.read().split('\\n') if l.strip()]
    args = [json.loads(l) for l in lines[:${sig.params.length}]]
    result = Solution().${sig.functionName}(*args)
    print(json.dumps(result, separators=(',', ':')))

__kn_main()
`;
}

const CPP_IO = `
namespace kn {
struct R {
  const std::string& s; size_t i = 0;
  explicit R(const std::string& str) : s(str) {}
  void ws() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
  void rd(int& v) { ws(); char* e; v = (int)strtol(s.c_str() + i, &e, 10); i = e - s.c_str(); }
  void rd(long long& v) { ws(); char* e; v = strtoll(s.c_str() + i, &e, 10); i = e - s.c_str(); }
  void rd(double& v) { ws(); char* e; v = strtod(s.c_str() + i, &e); i = e - s.c_str(); }
  void rd(bool& v) { ws(); v = s.compare(i, 4, "true") == 0; i += v ? 4 : 5; }
  void rd(std::string& v) {
    ws(); i++; v.clear();
    while (i < s.size() && s[i] != '"') {
      char c = s[i++];
      if (c != '\\\\') { v += c; continue; }
      char e = s[i++];
      if (e == 'n') v += '\\n'; else if (e == 't') v += '\\t'; else if (e == 'r') v += '\\r';
      else if (e == 'u') { v += (char)strtol(s.substr(i, 4).c_str(), nullptr, 16); i += 4; }
      else v += e;
    }
    i++;
  }
  template <class T> void rd(std::vector<T>& v) {
    ws(); i++; v.clear(); ws();
    if (s[i] == ']') { i++; return; }
    while (true) { T x; rd(x); v.push_back(x); ws(); if (s[i++] == ']') break; }
  }
};
inline void w(std::ostream& o, int v) { o << v; }
inline void w(std::ostream& o, long long v) { o << v; }
inline void w(std::ostream& o, double v) { char b[64]; snprintf(b, sizeof b, "%.10g", v); o << b; }
inline void w(std::ostream& o, bool v) { o << (v ? "true" : "false"); }
inline void w(std::ostream& o, const std::string& v) {
  o << '"';
  for (char c : v) {
    if (c == '"' || c == '\\\\') o << '\\\\' << c;
    else if (c == '\\n') o << "\\\\n"; else if (c == '\\t') o << "\\\\t"; else o << c;
  }
  o << '"';
}
template <class T> void w(std::ostream& o, const std::vector<T>& v) {
  o << '[';
  for (size_t k = 0; k < v.size(); k++) { if (k) o << ','; T x = v[k]; w(o, x); }
  o << ']';
}
}
`;

function wrapCpp(sig: FunctionSignature, code: string) {
  const reads = sig.params
    .map((p, i) => `  ${cppType(p.type)} a${i}; { kn::R r(L.at(${i})); r.rd(a${i}); }`)
    .join('\n');
  const call = sig.params.map((_, i) => `a${i}`).join(', ');
  return `#include <bits/stdc++.h>
using namespace std;

${code}
${CPP_IO}
int main() {
  std::ios::sync_with_stdio(false);
  std::vector<std::string> L; std::string line;
  while (std::getline(std::cin, line)) {
    if (!line.empty() && line.back() == '\\r') line.pop_back();
    if (line.find_first_not_of(" \\t") != std::string::npos) L.push_back(line);
  }
${reads}
  Solution sol;
  auto result = sol.${sig.functionName}(${call});
  kn::w(std::cout, result);
  std::cout << std::endl;
  return 0;
}
`;
}

const JAVA_READ: Record<ParamType, string> = {
  int: '(int) num()',
  long: 'num()',
  double: 'dbl()',
  boolean: 'bool()',
  string: 'str()',
  'int[]': 'ia()',
  'long[]': 'la()',
  'double[]': 'da()',
  'boolean[]': 'ba()',
  'string[]': 'sa()',
  'int[][]': 'iaa()',
  'string[][]': 'saa()'
};

const JAVA_IO = `
  static String s; static int i;
  static void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
  static String tok() { ws(); int st = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++; return s.substring(st, i); }
  static long num() { return Long.parseLong(tok()); }
  static double dbl() { return Double.parseDouble(tok()); }
  static boolean bool() { ws(); boolean v = s.startsWith("true", i); i += v ? 4 : 5; return v; }
  static String str() {
    ws(); i++; StringBuilder b = new StringBuilder();
    while (s.charAt(i) != '"') {
      char c = s.charAt(i++);
      if (c != '\\\\') { b.append(c); continue; }
      char e = s.charAt(i++);
      if (e == 'n') b.append('\\n'); else if (e == 't') b.append('\\t'); else if (e == 'r') b.append('\\r');
      else if (e == 'u') { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
      else b.append(e);
    }
    i++; return b.toString();
  }
  interface Rd<T> { T r(); }
  static <T> List<T> list(Rd<T> f) {
    ws(); i++; List<T> out = new ArrayList<>(); ws();
    if (s.charAt(i) == ']') { i++; return out; }
    while (true) { out.add(f.r()); ws(); if (s.charAt(i++) == ']') break; }
    return out;
  }
  static int[] ia() { List<Long> l = list(Main::num); int[] a = new int[l.size()]; for (int k = 0; k < a.length; k++) a[k] = (int) (long) l.get(k); return a; }
  static long[] la() { List<Long> l = list(Main::num); long[] a = new long[l.size()]; for (int k = 0; k < a.length; k++) a[k] = l.get(k); return a; }
  static double[] da() { List<Double> l = list(Main::dbl); double[] a = new double[l.size()]; for (int k = 0; k < a.length; k++) a[k] = l.get(k); return a; }
  static boolean[] ba() { List<Boolean> l = list(Main::bool); boolean[] a = new boolean[l.size()]; for (int k = 0; k < a.length; k++) a[k] = l.get(k); return a; }
  static String[] sa() { return list(Main::str).toArray(new String[0]); }
  static int[][] iaa() { return list(Main::ia).toArray(new int[0][]); }
  static String[][] saa() { return list(Main::sa).toArray(new String[0][]); }

  static void w(StringBuilder o, Object v) {
    if (v == null) { o.append("null"); return; }
    if (v instanceof String) {
      o.append('"');
      for (char c : ((String) v).toCharArray()) {
        if (c == '"' || c == '\\\\') o.append('\\\\').append(c);
        else if (c == '\\n') o.append("\\\\n"); else if (c == '\\t') o.append("\\\\t"); else o.append(c);
      }
      o.append('"'); return;
    }
    if (v instanceof Double || v instanceof Float) {
      double d = ((Number) v).doubleValue();
      o.append(d == Math.rint(d) && Math.abs(d) < 1e15 ? String.valueOf((long) d) : String.valueOf(d)); return;
    }
    if (v instanceof Number || v instanceof Boolean) { o.append(v); return; }
    if (v instanceof Character) { w(o, String.valueOf(v)); return; }
    if (v instanceof int[]) { int[] a = (int[]) v; o.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) o.append(','); o.append(a[k]); } o.append(']'); return; }
    if (v instanceof long[]) { long[] a = (long[]) v; o.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) o.append(','); o.append(a[k]); } o.append(']'); return; }
    if (v instanceof double[]) { double[] a = (double[]) v; o.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) o.append(','); w(o, a[k]); } o.append(']'); return; }
    if (v instanceof boolean[]) { boolean[] a = (boolean[]) v; o.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) o.append(','); o.append(a[k]); } o.append(']'); return; }
    if (v instanceof char[]) { w(o, new String((char[]) v)); return; }
    if (v instanceof Object[]) { Object[] a = (Object[]) v; o.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) o.append(','); w(o, a[k]); } o.append(']'); return; }
    if (v instanceof Iterable) { o.append('['); boolean first = true; for (Object x : (Iterable<?>) v) { if (!first) o.append(','); first = false; w(o, x); } o.append(']'); return; }
    o.append(v);
  }
`;

function wrapJava(sig: FunctionSignature, code: string) {
  // the judge compiles Main.java, so the learner's class must not be public
  const userCode = code.replace(/public\s+(final\s+)?class\s+Solution\b/, 'class Solution');
  const reads = sig.params
    .map((p, k) => `    s = L.get(${k}); i = 0; ${javaType(p.type)} a${k} = ${JAVA_READ[p.type]};`)
    .join('\n');
  const call = sig.params.map((_, k) => `a${k}`).join(', ');
  return `import java.util.*;
import java.io.*;
import java.util.stream.*;

${userCode}

public class Main {
${JAVA_IO}
  public static void main(String[] args) throws IOException {
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
    List<String> L = new ArrayList<>(); String line;
    while ((line = in.readLine()) != null) if (!line.trim().isEmpty()) L.add(line);
${reads}
    StringBuilder o = new StringBuilder();
    w(o, new Solution().${sig.functionName}(${call}));
    System.out.println(o);
  }
}
`;
}

// The full program the judge runs: learner code plus the hidden driver for the language.
export function wrapSolution(sig: FunctionSignature, language: string, code: string): string {
  switch (language) {
    case 'javascript':
      return wrapJavaScript(sig, code);
    case 'python':
      return wrapPython(sig, code);
    case 'cpp':
      return wrapCpp(sig, code);
    case 'java':
      return wrapJava(sig, code);
    default:
      return code;
  }
}

/* ------------------------------------------------------------------ output comparison */

const normalise = (s: string) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    return (
      ka.length === Object.keys(b as object).length &&
      ka.every((k) =>
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      )
    );
  }
  return a === b;
}

const parse = (s: string): { ok: true; v: unknown } | { ok: false } => {
  try {
    return { ok: true, v: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
};

// Expected vs actual program output: equal as JSON values when both parse (numbers within 1e-5),
// otherwise equal as text ignoring trailing whitespace and CRLF.
export function outputsMatch(expected: string, actual: string): boolean {
  const e = normalise(expected);
  const a = normalise(actual);
  if (e === a) return true;
  const pe = parse(e);
  const pa = parse(a);
  return pe.ok && pa.ok ? deepEqual(pe.v, pa.v) : false;
}
