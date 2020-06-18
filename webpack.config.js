var fs = require("fs");
var path = require("path");

var output = {
  path: path.resolve(__dirname, "plugin"),
  filename: "plugin.js",
  libraryTarget: "umd",
};

module.exports = {
  entry: "./ts/plugin.ts",
  target: "node",
  devtool: "inline-source-map",
  output,
  resolve: {
    extensions: [".ts", ".js"], //resolve all the modules other than index.ts
  },
  module: {
    rules: [
      {
        use: "ts-loader",
        test: /\.ts?$/,
      },
    ],
  },
  plugins: [
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap("AfterEmitPlugin", (compilation) => {
          var filePath = (fileName) => {
            return path.join(path.join(__dirname, fileName));
          };
          var getJson = (fileName) => {
            return JSON.parse(fs.readFileSync(filePath(fileName)).toString());
          };
          var package = getJson("package.json");
          var manifest = getJson("manifest.json");
          manifest.version = package.version;

          var manifestJson = JSON.stringify(manifest, null, 4);
          fs.writeFileSync(
            path.join(output.path, "manifest.json"),
            manifestJson
          );
        });
      },
    },
  ],
};
