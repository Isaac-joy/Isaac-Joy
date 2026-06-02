// Standard Expo Metro config. Extends Expo's defaults (required for SDK 54 /
// New Architecture). Keep this rather than a bare custom config.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
