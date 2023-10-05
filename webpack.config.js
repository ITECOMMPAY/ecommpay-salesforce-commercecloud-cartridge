const path = require('path');
const ExtractTextPlugin =
	require('sgmf-scripts')['extract-text-webpack-plugin'];
const sgmfScripts = require('sgmf-scripts');
const fs = require('fs');

const webpackModeFilepath = './webpack-mode.json';
const webpackModeFileExists = fs.existsSync(webpackModeFilepath);
let webpackModeData = {};

if (webpackModeFileExists) {
	const data = fs.readFileSync(webpackModeFilepath, 'utf8');
	webpackModeData = JSON.parse(data);
}

const WEBPACK_MODE = webpackModeFileExists
	? webpackModeData.mode
	: 'production';

const webpackExportJson = [];

/**
 * Adds a JavaScript to a cartridge webpack configuration.
 *
 * @param {string} name - The name of the cartridge.
 * @return {void}
 */
function addJsCartridge(name) {
	webpackExportJson.push({
		mode: WEBPACK_MODE,
		name: 'js',
		entry: sgmfScripts.createJsPath(),
		output: {
			path: path.resolve(`./cartridges/${name}/cartridge/static/`),
			filename: '[name].js',
		},
	});
}

/**
 * Adds an SCSS to a cartridge webpack configuration.
 *
 * @param {string} name - The name of the cartridge.
 * @return {void}
 */
function addScssCartridge(name) {
	webpackExportJson.push({
		mode: WEBPACK_MODE,
		name: 'scss',
		entry: sgmfScripts.createScssPath(),
		output: {
			path: path.resolve(`./cartridges/${name}/cartridge/static/`),
			filename: '[name].css',
		},
		module: {
			rules: [
				{
					test: /\.scss$/,
					use: ExtractTextPlugin.extract({
						use: [
							{
								loader: 'css-loader',
								options: {
									url: false,
								},
							},
							{
								loader: 'postcss-loader',
								options: {
									plugins: [require('autoprefixer')()],
								},
							},
							{
								loader: 'sass-loader',
								options: {
									includePaths: [
										path.resolve('node_modules'),
										path.resolve('node_modules/flag-icon-css/sass'),
									],
								},
							},
						],
					}),
				},
			],
		},
		resolve: {
			alias: {
				base: path.resolve(
					__dirname,
					'./cartridges/app_storefront_base/cartridge/client/default/scss',
				),
			},
		},
		plugins: [
			new ExtractTextPlugin({
				filename: '[name].css',
			}),
		],
	});
}

addJsCartridge('int_ecommpay_core');
addScssCartridge('int_ecommpay_core');

module.exports = webpackExportJson;
