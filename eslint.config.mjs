import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// Promote all jsx-a11y rules to error severity.
// eslint-config-next registers the plugin; we only
// override rule levels here.
const a11yErrors = Object.fromEntries(
  Object.keys(jsxA11y.rules).map(
    rule => [`jsx-a11y/${rule}`, 'error']
  )
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      ...a11yErrors,
      // SVG fretboard cells use role="button" intentionally
      'jsx-a11y/prefer-tag-over-role': 'off',
      // Deprecated: modern browsers handle onChange fine
      'jsx-a11y/no-onchange': 'off',
      // Too strict (requires BOTH nesting AND id);
      // label-has-associated-control covers this better
      'jsx-a11y/label-has-for': 'off',
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".worktrees/**",
    "design_handoff/**",
  ]),
]);

export default eslintConfig;
