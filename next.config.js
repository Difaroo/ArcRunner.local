/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
}

module.exports = nextConfig
