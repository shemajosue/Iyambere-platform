module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo already includes the expo-router plugin on SDK 50+.
  return { presets: ['babel-preset-expo'] };
};
