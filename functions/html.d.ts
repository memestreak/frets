/** Wrangler bundles an imported `.html` file as its text. */
declare module '*.html' {
  const text: string;
  export default text;
}
