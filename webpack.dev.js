const path = require('path');

const { merge } = require('webpack-merge');

const common = require('./webpack.common');

module.exports = merge(common, {
    // In order for live reload to work we must use "web" as the target not "browserslist"
    target: process.env.WEBPACK_SERVE ? 'web' : 'browserslist',
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                enforce: 'pre',
                use: ['source-map-loader']
            },
            // '@tanstack/query-devtools' ships as strict ESM and requires fullySpecified: false.
            // Only needed in development since production builds exclude the devtools entirely.
            {
                test: /\.(js|jsx|mjs)$/,
                include: [
                    path.resolve(__dirname, 'node_modules/@tanstack/query-devtools')
                ],
                resolve: {
                    fullySpecified: false
                },
                use: [{
                    loader: 'babel-loader',
                    options: {
                        cacheCompression: false,
                        cacheDirectory: true
                    }
                }]
            }
        ]
    },
    devServer: {
        compress: true,
        client: {
            overlay: {
                errors: true,
                warnings: false
            }
        },
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        ]
    }
});
