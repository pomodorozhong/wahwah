declare module 'virtual:local-models' {
  /** Files found under public/models, relative to it (see vite.config.ts). */
  const models: { vrm: string[] };
  export default models;
}
