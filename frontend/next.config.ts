import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['10.20.2.215', '10.20.2.215:3000', '10.20.2.215.nip.io', '10.20.2.215.nip.io:3000']
};

export default nextConfig;
