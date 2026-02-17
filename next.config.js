/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            "@std/testing/mock": false,
            "@std/testing/bdd": false,
            "@gadicc/fetch-mock-cache": false,
        };
        return config;
    },
};

module.exports = nextConfig;
