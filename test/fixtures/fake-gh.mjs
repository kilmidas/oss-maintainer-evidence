#!/usr/bin/env node

const endpoint = process.argv.at(-1) ?? "";
const url = new URL(endpoint, "https://api.github.com");
const mode = process.env.FAKE_GH_MODE ?? "complete";

const reply = (status, body, exitCode = 0) => {
  const text = body === undefined ? "" : JSON.stringify(body);
  process.stdout.write(
    `HTTP/1.1 ${status} Synthetic\r\nContent-Type: application/json\r\n\r\n${text}`,
  );
  if (exitCode !== 0) {
    process.stderr.write(process.env.SYNTHETIC_TOKEN ?? "synthetic failure");
    process.exitCode = exitCode;
  }
};

if (mode === "required_failure") reply(500, { message: "failure" }, 1);
else if (
  mode === "partial" &&
  url.pathname === "/repos/acme/demo/community/profile"
)
  reply(500, { message: "optional failure" }, 1);
else if (url.pathname === "/repos/acme/demo")
  reply(200, {
    full_name: "acme/demo",
    private: false,
    visibility: "public",
    html_url: "https://github.com/acme/demo",
    default_branch: "main",
    fork: false,
    description: "Synthetic public repository",
    stargazers_count: 1,
    forks_count: 0,
    subscribers_count: 1,
  });
else if (url.pathname === "/repos/acme/demo/releases") reply(200, []);
else if (url.pathname === "/search/issues")
  reply(200, { total_count: 0, incomplete_results: false, items: [] });
else if (url.pathname === "/repos/acme/demo/community/profile")
  reply(200, {
    files: {
      readme: null,
      license: null,
      contributing: null,
      code_of_conduct: null,
      issue_template: null,
      pull_request_template: null,
    },
  });
else if (url.pathname.startsWith("/repos/acme/demo/contents/"))
  reply(404, { message: "Not Found" }, 1);
else if (url.pathname === "/repos/acme/demo/contributors") reply(204);
else if (url.pathname === "/repos/acme/demo/issues/comments") reply(200, []);
else reply(500, { message: "unexpected synthetic endpoint" }, 1);
