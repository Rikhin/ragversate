import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle ESM modules
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts'],
      '.jsx': ['.jsx', '.tsx'],
    };

    // Handle helix-ts ESM module
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    if (isServer) {
      // Server-side configuration
      config.externals = config.externals || [];
      config.externals.push({
        'helix-ts': 'commonjs helix-ts',
      });
    }

    return config;
  },
  transpilePackages: ['helix-ts'],
};

export default nextConfig;
