const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// React-ecosystem singletons must resolve to ONE physical copy across the
// whole bundle or React's dispatcher breaks ("Invalid hook call"). Packages
// hoisted to the workspace root (e.g. expo-camera → expo-modules-core) walk
// up from /node_modules/expo-modules-core and would otherwise find
// /node_modules/react, while RN's renderer at apps/mobile/node_modules
// finds apps/mobile/node_modules/react — two instances.
//
// extraNodeModules is fallback-only (consulted AFTER hierarchical lookup
// succeeds) so it doesn't help. resolveRequest is the override hook that
// runs BEFORE the default resolver, so it actually intercepts the name.
//
// We spoof originModulePath to apps/mobile/package.json so Metro's default
// resolver walks up from there and finds mobile's copy first.
// expo-modules-core also has to be a singleton: it registers native view
// managers (e.g. ViewManagerAdapter_ExpoCamera_<hash>) on its first load.
// Two loaded copies → registration in one + lookup in the other → "View
// config getter callback ... must be a function (received undefined)".
const SINGLETON_PACKAGES = new Set([
  "react",
  "react-dom",
  "react-native",
  "expo-modules-core",
]);
const mobileOrigin = path.resolve(projectRoot, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETON_PACKAGES.has(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: mobileOrigin },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
