import test from "node:test";
import assert from "node:assert/strict";
// tsconfig uses jsx: "preserve", so tsx emits classic React.createElement calls
// in this test file and React must be in scope explicitly.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "../src/components/markdown";

/**
 * The markdown renderer displays raw model output, so these are security tests
 * as much as formatting ones. Anything that could turn generated text into
 * executable markup in a signed-in user's session belongs here.
 */
const render = (source: string) => renderToStaticMarkup(<Markdown content={source} />);

test("raw HTML in model output is escaped, not executed", () => {
  const html = render('<script>alert("xss")</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("img onerror payloads are inert", () => {
  const html = render('<img src=x onerror="alert(1)">');
  // The whole tag is escaped to text, so no element and no live handler exist.
  // The literal "onerror=" still appears, but only inside escaped content.
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=/);
});

test("javascript: links degrade to plain text", () => {
  const html = render("[click me](javascript:alert(1))");
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<a /);
});

test("data: URI links degrade to plain text", () => {
  const html = render("[x](data:text/html;base64,PHNjcmlwdD4=)");
  assert.doesNotMatch(html, /href="data:/);
});

test("ordinary https links still render and are safely targeted", () => {
  const html = render("[docs](https://example.com/guide)");
  assert.match(html, /href="https:\/\/example\.com\/guide"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
});

test("common markdown structures render as real elements", () => {
  // Headings are demoted by one level so the page keeps a single <h1> and the
  // document outline stays correct: markdown "#" renders as <h2>.
  assert.match(render("# Title"), /<h2[^>]*>Title<\/h2>/);
  assert.match(render("## Sub"), /<h3[^>]*>Sub<\/h3>/);
  assert.match(render("**bold**"), /<strong[^>]*>bold<\/strong>/);
  assert.match(render("- one\n- two"), /<li[^>]*>one<\/li>/);
  assert.match(render("| a | b |\n| --- | --- |\n| 1 | 2 |"), /<table/);
  assert.match(render("```\ncode\n```"), /<pre/);
});

test("pathological input terminates instead of hanging", () => {
  for (const input of ["***", "|||", "```unclosed", "[", "![](", "- ".repeat(500)]) {
    assert.equal(typeof render(input), "string", `handled: ${input.slice(0, 12)}`);
  }
});
