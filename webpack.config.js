const path = require('path');

const exclude = '/node_modules';

module.exports = {
    mode: process.env.NODE_ENV,
    resolve: {
        extensions: ['.js', '.jsx', '.tsx', '.ts'],
    },
    entry: {
        index: ['./index.js'],
    },
    output: {
        path: path.resolve(__dirname, './build/'),
        libraryTarget: 'umd',
        filename: '[name].js',
        publicPath: '/build/',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                loader: 'url-loader',
                options: {
                    limit: 100000,
                },
            },
            {
                test: /\.(js|jsx)$/,
                exclude,
                loader: 'babel-loader',
            },
            {
                test: /\.scss$/,
                loaders: [
                    {
                        loader: 'style-loader?sourceMap',
                    }, {
                        loader: 'css-loader',
                        options: {
                            localIdentName: '[path][name]__[local]--[hash:base64:5]',
                        },
                    }, {
                        loader: 'sass-loader',
                    },
                ],
            },
        ],
    },
};
