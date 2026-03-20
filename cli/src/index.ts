const command = process.argv[2] ?? "help";

function printHelp() {
  process.stdout.write(
    [
      "agency-wzrdwork CLI",
      "",
      "Available commands:",
      "  doctor         Check orchestration environment prerequisites",
      "  env            Show relevant environment variable presence",
      "  configure      Reserved for Paperclip parity port",
      "  onboard        Reserved for Paperclip parity port",
      "  run            Reserved for Paperclip parity port",
      "  heartbeat-run  Reserved for Paperclip parity port",
      "  worktree       Reserved for Paperclip parity port",
      "  db-backup      Reserved for Paperclip parity port",
      "",
    ].join("\n"),
  );
}

function printEnv() {
  const keys = [
    "VITE_SERVER_URL",
    "DATABASE_URL",
    "CONTROL_PLANE_ENCRYPTION_KEY",
    "SERVER_TRUST_WALLET_HEADER",
  ];

  process.stdout.write(
    `${keys
      .map((key) => `${key}=${process.env[key] ? "set" : "missing"}`)
      .join("\n")}\n`,
  );
}

function runDoctor() {
  const required = ["DATABASE_URL", "CONTROL_PLANE_ENCRYPTION_KEY"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length === 0) {
    process.stdout.write("doctor: ok\n");
    return;
  }

  process.stdout.write(`doctor: missing ${missing.join(", ")}\n`);
  process.exitCode = 1;
}

switch (command) {
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;
  case "env":
    printEnv();
    break;
  case "doctor":
    runDoctor();
    break;
  default:
    printHelp();
    process.exitCode = 1;
    break;
}
