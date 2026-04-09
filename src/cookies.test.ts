import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCookie } from "./cookies.js";

test("normalizeCookie preserves Playwright-format cookies", () => {
  const source = {
    name: "sessionid",
    value: "abc",
    domain: ".example.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "None" as const,
    expires: 1798830478,
  };

  assert.deepEqual(normalizeCookie(source), source);
});

test("normalizeCookie normalizes browser-export JSON cookies", () => {
  const cookies = [
    normalizeCookie({
      domain: ".instagram.com",
      expirationDate: 1798830478.408272,
      hostOnly: false,
      httpOnly: true,
      name: "mid",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "0",
      value: "cookie-value",
    }),
    normalizeCookie({
      domain: ".instagram.com",
      httpOnly: true,
      name: "csrftoken",
      path: "/",
      sameSite: "unspecified",
      secure: true,
      session: true,
      value: "csrf-value",
    }),
  ];

  assert.deepEqual(cookies, [
    {
      domain: ".instagram.com",
      expires: 1798830478,
      httpOnly: true,
      name: "mid",
      path: "/",
      sameSite: "None",
      secure: true,
      value: "cookie-value",
    },
    {
      domain: ".instagram.com",
      httpOnly: true,
      name: "csrftoken",
      path: "/",
      secure: true,
      value: "csrf-value",
    },
  ]);
});
