// The engine isn't part of the package's public surface.
// @ts-expect-error: `reflowComment` isn't exported.
import { reflowComment } from 'eslint-plugin-jsdoc-flow';

export { reflowComment };
