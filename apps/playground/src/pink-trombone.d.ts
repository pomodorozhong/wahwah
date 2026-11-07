// pink-trombone-mod ships .d.ts files but no package entry point; declare the
// deep import this project uses.
declare module 'pink-trombone-mod/Synthesizer.js' {
  export { Synthesizer } from 'pink-trombone-mod/Synthesizer';
}
