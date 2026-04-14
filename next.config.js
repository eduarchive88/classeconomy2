/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        instrumentationHook: true,
        serverComponentsExternalPackages: ['node-cron'],
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            // node-cron은 Node.js 내장 모듈(path 등) 사용 → webpack 번들 제외
            const existing = Array.isArray(config.externals) ? config.externals : (config.externals ? [config.externals] : []);
            config.externals = [...existing, 'node-cron'];
        }
        config.resolve.alias = {
            ...config.resolve.alias,
            "@std/testing/mock": false,
            "@std/testing/bdd": false,
            "@gadicc/fetch-mock-cache": false,
        };
        return config;
    },
    output: 'standalone',
};

module.exports = nextConfig;
