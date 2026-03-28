import { createPluginManifest, createWorkerConfig, definePlugin } from "../../sdk/src/index.js";

export const helloWorldPlugin = definePlugin({
  manifest: createPluginManifest({
    id: "hello-world",
    name: "Hello World",
    description: "A minimal Paperclip-style plugin example.",
    version: "0.1.0",
    entrypoint: "./worker.js",
    worker: createWorkerConfig("node"),
    commands: [
      {
        name: "hello",
        description: "Return a greeting payload",
        arguments: [
          {
            name: "name",
            description: "Person to greet",
            required: false,
            defaultValue: "world",
          },
        ],
      },
    ],
    scaffold: [
      {
        name: "default",
        description: "Starter files for a plugin package",
        files: [
          {
            path: "README.md",
            content: "# Hello World\n\nGenerated from the example plugin scaffold.\n",
          },
        ],
      },
    ],
  }),
  async run(input) {
    const name =
      input && typeof input === "object" && "name" in input && typeof (input as { name?: unknown }).name === "string"
        ? (input as { name: string }).name
        : "world";

    return { message: `hello, ${name}` };
  },
  scaffold: () => [
    {
      path: "README.md",
      content: "# Hello World\n\nThis plugin was generated from the example scaffold.\n",
    },
  ],
});

export const examplePlugins = [helloWorldPlugin] as const;
