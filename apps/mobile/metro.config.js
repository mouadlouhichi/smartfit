const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch and resolve packages from the workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Workspace fallback: resolve bare imports from the hoisted root if Metro
// misses them. Must return `type: 'sourceFile'` or Metro throws.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    const isBare =
      typeof moduleName === 'string' &&
      !moduleName.startsWith('.') &&
      !moduleName.startsWith('/') &&
      /^[a-zA-Z@]/.test(moduleName);
    if (isBare) {
      try {
        const filePath = require.resolve(moduleName, {
          paths: [projectRoot, workspaceRoot],
        });
        return { type: 'sourceFile', filePath };
      } catch (_) {}
    }
    throw err;
  }
};

module.exports = withNativeWind(config, { input: './src/global.css' });
