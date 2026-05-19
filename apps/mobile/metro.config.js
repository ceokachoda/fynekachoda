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

// react-native-webview ships TWO entry trees:
//   "react-native": "src/index.ts"  → raw codegenNativeComponent('RNCWebView')
//   "main":         "index.js"      → re-exports lib/ (codegen-transformed,
//                                     static __INTERNAL_VIEW_CONFIG inlined)
// Metro picks the `react-native` field by default. The codegen babel transform
// does NOT fire on src/RNCWebViewNativeComponent.ts in our preset chain
// (Expo Go new arch + babel-preset-expo, file under node_modules), so at
// runtime NativeComponentRegistry never receives a view config getter for
// `RNCWebView` and React throws:
//   "View config getter callback for component `RNCWebView` must be a
//    function (received `undefined`)"
// — which also takes react-native-youtube-iframe down with it. Force this one
// package to the pre-built lib/ entry.
const webviewLibEntry = path.resolve(
  workspaceRoot,
  "node_modules/react-native-webview/index.js",
);

// Match the bare name AND any subpath (e.g. "react-native/Libraries/..." must
// dedupe to the SAME copy as "react-native", otherwise stateful submodules
// like NativeComponentRegistry / ReactNativeViewConfigRegistry end up with
// register() writing to one Map and get() reading from another.
function isSingletonRequest(moduleName) {
  for (const pkg of SINGLETON_PACKAGES) {
    if (moduleName === pkg || moduleName.startsWith(pkg + "/")) return true;
  }
  return false;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-webview") {
    return { type: "sourceFile", filePath: webviewLibEntry };
  }
  if (isSingletonRequest(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: mobileOrigin },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
