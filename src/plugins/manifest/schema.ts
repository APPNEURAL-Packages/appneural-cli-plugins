export const pluginManifestSchema = {
  $id: "https://schemas.appneural.com/plugin-manifest.json",
  type: "object",
  required: ["name", "version"],
  properties: {
    name: { type: "string" },
    version: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    commands: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          alias: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              required: ["flags"],
              properties: {
                flags: { type: "string" },
                description: { type: "string" },
                defaultValue: {},
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: true,
      },
    },
    tools: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        additionalProperties: true,
      },
    },
    apps: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } }, additionalProperties: true } },
    templates: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } }, additionalProperties: true } },
    engines: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } }, additionalProperties: true } },
    agents: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } }, additionalProperties: true } },
    hooks: {
      type: "object",
      properties: {
        onLoad: { instanceof: "Function" },
        onRegister: { instanceof: "Function" },
        onRun: { instanceof: "Function" },
        onCommandRun: { instanceof: "Function" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: true,
};
