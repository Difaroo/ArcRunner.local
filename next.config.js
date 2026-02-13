/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
    reactStrictMode: true,
    experimental: {
        serverActions: true,
        serverComponentsExternalPackages: ['fluent-ffmpeg'],
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
}

module.exports = nextConfig
// forcing restart Fri Feb 13 15:52:16 GMT 2026
