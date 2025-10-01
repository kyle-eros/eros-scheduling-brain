const path = require('path');
const GasPlugin = require('gas-webpack-plugin');

module.exports = {
  mode: 'none',
  entry: './src/main.ts',
  output: {
    filename: 'Code.js',
    path: path.resolve(__dirname, 'dist'),
    clean: false,
    library: {
      type: 'var',
      name: 'MyLibrary'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  optimization: {
    minimize: false
  },
  plugins: [
    new GasPlugin()
  ]
};
