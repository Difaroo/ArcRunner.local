module.exports = {
    apps: [
        {
            name: 'arcrunner-dev',
            script: 'npm',
            args: 'run dev',
            cwd: './',
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            },
            watch: false, // Next.js handles internal reloading
        },
        {
            name: 'arcrunner-prod',
            script: 'npm',
            args: 'run start', // runs 'next start'
            cwd: './',
            env: {
                NODE_ENV: 'production',
                PORT: 3001
            },
            watch: false, // Stable production
        }
    ]
};
