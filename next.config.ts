/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false, // set to true if it's a permanent 308
      },
    ];
  },
};

module.exports = nextConfig;
