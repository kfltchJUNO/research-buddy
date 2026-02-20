"use client";

/**
 * 카카오톡, 인스타그램 등 인앱 브라우저 여부를 확인합니다.
 */
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /kakao|instagram|line|naver|fbav/.test(ua);
}