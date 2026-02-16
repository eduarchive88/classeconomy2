/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    transpilePackages: ['yahoo-finance2'],
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@std/testing/mock': false,
            '@std/testing/bdd': false,
            '@gadicc/fetch-mock-cache/runtimes/deno.ts': false,
            '@gadicc/fetch-mock-cache/stores/fs.ts': false,
        };
        return config;
    },
};

export default nextConfig;
