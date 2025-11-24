import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'https://api.galileo.ai/client/openapi.json',
  output: {
    path: 'src/types',
    format: 'prettier',
    indexFile: false,
    clean: false
  },
  plugins: [
    {
      name: '@hey-api/typescript',
      enums: 'javascript',
      exportCore: false,
      style: false
    }
  ],
  client: false,
  services: false
});
