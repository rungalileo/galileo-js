# Observe-js

NodeJS client for Galileo Observe.

## Testing
In the root direcory, rum:
- `npm i`
- `npm link`

In the examples directory, run:
- `npm i`
- `npm link @rungalileo/observe`
- `node openai.js`

## Making changes
When updating the code, only modify the *.ts files and then run:
- `npm run format`
- `npm run lint-fix` (this doesn't currently pass)
- `npm run build`
