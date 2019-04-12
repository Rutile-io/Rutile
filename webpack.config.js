const path = require('path');

const exclude = '/node_modules';

module.exports = {
    mode: process.env.NODE_ENV,
    // target: 'node',
    resolve: {
        extensions: ['.js', '.jsx', '.tsx', '.ts'],
    },
    entry: {
        rutile: ['./index.js'],
        vm: ['./src/js/core/rvm/vm.ts'],
    },
    output: {
        path: path.resolve(__dirname, './build/'),
        libraryTarget: 'this',
        filename: '[name].js',
        publicPath: '/build/',
    },
    module: {
        rules: [
            {
                type: 'javascript/auto',
                test: /\.mjs$/,
                use: [],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: [
                    path.resolve(__dirname, './examples'),
                    path.resolve(__dirname, './node_modules'),
                ],
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
        ],
    },
};
