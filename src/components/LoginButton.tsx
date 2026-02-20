"use client";

import { useEffect, useState } from "react";
import { getInAppBrowserType } from "@/lib/detector";
import { signInWithGoogle } from "@/lib/auth-service";

export default function LoginButton() {
  const [inAppType, setInAppType] = useState<string | null>(null);

  useEffect(() => {
    setInAppType(getInAppBrowserType());
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("주소가 복사되었습니다! 크롬이나 사파리 앱을 열어 붙여넣어 주세요.");
  };

  if (inAppType) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
        <p className="text-sm text-yellow-800 mb-4">
          {inAppType} 브라우저에서는 구글 로그인이 제한됩니다.<br/>
          안전한 이용을 위해 <strong>외부 브라우저</strong>를 사용해주세요.
        </p>
        <button 
          onClick={handleCopyUrl}
          className="w-full py-3 bg-yellow-500 text-white rounded-lg font-bold"
        >
          주소 복사하고 크롬/사파리로 가기
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signInWithGoogle}
      className="flex items-center justify-center gap-3 w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <img src="/google-logo.png" alt="Google" className="w-5 h-5" />
      <span className="font-medium">구글로 시작하기</span>
    </button>
  );
}