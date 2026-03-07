const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { resolver: { sourceExts, assetExts } } = config;

config.resolver.sourceExts = [...new Set(['ts', 'tsx', ...sourceExts, 'cjs', 'mjs'])];
config.resolver.assetExts = assetExts.filter(ext => ext !== 'svg');

// Force include node_modules TS files if they are being ignored
config.resolver.blockList = [/node_modules\/.*\/__tests__\/.*/];

module.exports = config;
