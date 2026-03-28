export type SceneBootErrorCode =
  | 'unsupported'
  | 'asset_load_failed'
  | 'initialization_failed';

export class SceneBootError extends Error {
  public readonly code: SceneBootErrorCode;

  constructor(
    code: SceneBootErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'SceneBootError';
    this.code = code;

    if (options && 'cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function toSceneBootError(
  error: unknown,
  fallbackCode: SceneBootErrorCode,
  fallbackMessage: string,
): SceneBootError {
  if (error instanceof SceneBootError) {
    return error;
  }

  return new SceneBootError(
    fallbackCode,
    error instanceof Error && error.message ? error.message : fallbackMessage,
    { cause: error },
  );
}
