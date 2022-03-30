
const { resolve } = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    mode: 'production',

    entry: './src/index.ts',

    output: {
        filename: 'bundle.js',
        path: resolve(__dirname, 'dist'),
    },

    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        fallback: { 
            "url": false ,
            "stream": false
        }
    },

    devtool: 'source-map',

    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: ['ts-loader'],
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                use: [
                'file-loader?hash=sha512&digest=hex&name=images/[hash].[ext]',
                'image-webpack-loader?bypassOnDebug&optipng.optimizationLevel=7&gifsicle.interlaced=false',
                ],
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader','postcss-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: `${__dirname}/public/index.html`,
            filename: 'index.html',
            inject: 'body',
            favicon: `${__dirname}/public/favicon.ico`
        })
    ],
};