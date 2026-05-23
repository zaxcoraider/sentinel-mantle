/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile wagmi/viem/rainbowkit so Next.js can handle their ESM correctly
  transpilePackages: ['@rainbow-me/rainbowkit'],
  webpack: (config) => {
    // Silence optional-dep warnings from metamask-sdk + pino-pretty
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
