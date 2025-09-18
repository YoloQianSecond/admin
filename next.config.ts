/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false, // use true if you want a 308 permanent redirect
      },
    ];
  },
};

module.exports = nextConfig;
