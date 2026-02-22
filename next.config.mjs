/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 서버 액션 파일 전송 용량 확장 (50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  
  // 2. 🚀 [최종 보스 해결] Webpack 캔버스 모듈 무시 설정
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;