import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCookie, parseCookieFile, readCookiesFromFile } from "./cookies.js";

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

test("parseCookieFile accepts both cookie arrays and Playwright storage state", () => {
  assert.deepEqual(
    parseCookieFile(
      JSON.stringify([
        {
          name: "sessionid",
          value: "abc",
          domain: ".example.com",
          path: "/",
          sameSite: "none",
          secure: true,
        },
      ]),
      "cookies.json"
    ),
    [
      {
        name: "sessionid",
        value: "abc",
        domain: ".example.com",
        path: "/",
        sameSite: "None",
        secure: true,
      },
    ]
  );

  assert.deepEqual(
    parseCookieFile(
      JSON.stringify({
        cookies: [
          {
            name: "csrftoken",
            value: "def",
            domain: ".example.com",
            path: "/",
            expirationDate: 1798830478.408272,
          },
        ],
      }),
      "storage-state.json"
    ),
    [
      {
        name: "csrftoken",
        value: "def",
        domain: ".example.com",
        path: "/",
        expires: 1798830478,
      },
    ]
  );
});

test("parseCookieFile rejects invalid cookie file payloads", () => {
  assert.throws(
    () => parseCookieFile("{", "broken.json"),
    /broken\.json must contain valid JSON/i
  );
  assert.throws(
    () => parseCookieFile(JSON.stringify({ origins: [] }), "broken.json"),
    /broken\.json must contain a JSON array of cookies or a JSON object with a cookies array/i
  );
  assert.throws(
    () => parseCookieFile(JSON.stringify([{ value: "abc" }]), "broken.json"),
    /broken\.json contains an invalid cookie at index 0/i
  );
});

test("readCookiesFromFile reads and normalizes cookie files", () => {
  const cookies = readCookiesFromFile("cookies.json", (filePath, encoding) => {
    assert.equal(filePath, "cookies.json");
    assert.equal(encoding, "utf8");
    return JSON.stringify([
      {
        name: "sessionid",
        value: "abc",
        domain: ".example.com",
        path: "/",
      },
    ]);
  });

  assert.deepEqual(cookies, [
    {
      name: "sessionid",
      value: "abc",
      domain: ".example.com",
      path: "/",
    },
  ]);
});
