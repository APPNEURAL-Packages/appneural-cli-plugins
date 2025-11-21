export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}

export class ManifestValidationError extends PluginError {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

export class PluginNotFoundError extends PluginError {
  constructor(name: string) {
    super(`Plugin "${name}" could not be found.`);
    this.name = "PluginNotFoundError";
  }
}
