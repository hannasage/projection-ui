// Bundlers define `process.env.NODE_ENV`. The library does not depend on Node types, so it declares only what it reads.
declare const process: { env: { NODE_ENV?: string } }

/** How the build says which mode it is in. Each reader may throw, or return undefined, when the build does not define it. */
export interface BuildMode {
  nodeEnv(): string | undefined
  metaDev(): boolean | undefined
}

function attempt<T>(read: () => T): T | undefined {
  try {
    return read()
  } catch {
    return undefined
  }
}

/**
 * True outside a production build. `NODE_ENV` decides when the build defines it. Otherwise `import.meta.env.DEV` decides.
 * With neither, the answer is true, so a development warning still shows: the safe default is to warn.
 */
export function developmentFrom(mode: BuildMode): boolean {
  const nodeEnv = attempt(mode.nodeEnv)
  if (typeof nodeEnv === 'string') return nodeEnv !== 'production'
  const metaDev = attempt(mode.metaDev)
  if (typeof metaDev === 'boolean') return metaDev
  return true
}

/**
 * The mode of the consumer's build. The consumer's bundler replaces `process.env.NODE_ENV`, and where it supports it,
 * `import.meta.env`. This package's own library build leaves both as they are. A packed-package test checks the built file.
 */
export function isDevelopment(): boolean {
  return developmentFrom({
    nodeEnv: () => process.env.NODE_ENV,
    metaDev: () => {
      const meta = import.meta as { env?: { DEV?: unknown } }
      const dev = meta.env?.DEV
      return typeof dev === 'boolean' ? dev : undefined
    },
  })
}
