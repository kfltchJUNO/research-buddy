import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js가 요구하는 'middleware' 함수 또는 'default' 수출이 반드시 있어야 합니다.
export function middleware(request: NextRequest) {
  // 현재는 특별한 제한 없이 모든 요청을 통과시킵니다.
  return NextResponse.next();
}

// 미들웨어가 작동할 경로를 설정합니다 (선택 사항)
export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     * - api (API 라우트)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};