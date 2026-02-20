"use client";

import { useState, useEffect } from "react";
import { signInWithGoogle } from "@/lib/auth-service";
import { isInAppBrowser } from "@/lib/detect-inapp";
import { Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export default function GoogleLoginButton() {
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("주소가 복사되었습니다. 크롬/사파리에서 열어주세요!", { icon: '📋' });
  };

  if (isInApp) {
    return (
      <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl text-center">
        <p className="text-sm text-yellow-800 font-bold">
          <span className="text-xl block mb-2">⚠️</span>
          현재 브라우저에서는 구글 로그인이 제한됩니다.
        </p>
        <p className="text-xs text-yellow-700 mb-4">
          원활한 사용을 위해 주소를 복사하여<br/>Chrome이나 Safari 앱에서 열어주세요.
        </p>
        <button 
          onClick={handleCopyLink}
          className="w-full flex justify-center items-center gap-2 py-3 bg-yellow-400 text-yellow-900 rounded-xl font-bold active:scale-95 transition-transform"
        >
          <Copy size={18} /> 주소 복사하기
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="w-full flex justify-center items-center gap-3 py-4 bg-white border-2 border-gray-200 rounded-2xl text-gray-700 font-bold hover:border-black hover:bg-gray-50 active:scale-95 transition-all"
    >
      <img src="/google-icon.svg" alt="Google" className="w-6 h-6" />
      구글 계정으로 시작하기
    </button>
  );
}