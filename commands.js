// PR comment commands, e.g. "/generate-commit scope=changed generators=examples,options"

export const COMMANDS = ["/generate", "/generate-commit", "/commit"];

// Generators of the toolchain (toolchain/scripts/toolchain.sh in docs-hugo)
export const GENERATORS = ["examples", "options", "optimizer", "metrics", "error-codes", "exit-codes", "oasisctl"];

const SCOPES = ["all", "changed"];

// Characters allowed in override regexes. They end up in a shell variable
// (single-quoted) and in a docker run argument, so no quotes and no whitespace.
const OVERRIDE_CHARS = /^[A-Za-z0-9_.*+?^$()[\]{}|,\\-]+$/;

// Parses a comment. Returns null if it isn't a command (the first word isn't one
// of COMMANDS), otherwise { command, params, error }. params are the CircleCI
// pipeline parameters for the arguments, error a message for invalid arguments.
export function parseCommand(body) {
  const words = body.trim().split(/\s+/);
  const command = words[0];
  if (!COMMANDS.includes(command)) return null;

  const result = { command, params: {}, error: null };
  const args = words.slice(1);
  if (args.length > 0 && command === "/commit") {
    result.error = "`/commit` doesn't accept arguments.";
    return result;
  }

  const seen = new Set();
  for (const arg of args) {
    const match = arg.match(/^([a-z]+)=(.*)$/);
    if (!match) {
      result.error = "Invalid argument `" + arg + "`, expected `key=value`.";
      return result;
    }
    const [, key, value] = match;
    if (seen.has(key)) {
      result.error = "The argument `" + key + "` is specified more than once.";
      return result;
    }
    seen.add(key);

    if (key === "scope") {
      if (!SCOPES.includes(value)) {
        result.error = "Invalid `scope`, use `all` or `changed`.";
        return result;
      }
      result.params["examples-scope"] = value;
    } else if (key === "override") {
      if (!OVERRIDE_CHARS.test(value)) {
        result.error = "Invalid `override`, use comma-separated regular expressions without quotes or spaces.";
        return result;
      }
      for (const regex of value.split(",")) {
        try {
          new RegExp(regex);
        } catch (e) {
          result.error = "Invalid regular expression `" + regex + "` in `override`.";
          return result;
        }
      }
      result.params["override"] = value;
    } else if (key === "generators") {
      const names = value.split(",");
      const unknown = names.filter((name) => !GENERATORS.includes(name));
      if (value === "" || unknown.length > 0) {
        result.error = "Invalid `generators`, available: " + GENERATORS.map((g) => "`" + g + "`").join(", ") + ".";
        return result;
      }
      result.params["generators"] = [...new Set(names)].join(" ");
    } else {
      result.error = "Unknown argument `" + key + "`, available: `scope`, `override`, `generators`.";
      return result;
    }
  }
  return result;
}
