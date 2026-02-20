import "./globals.css"; // 디자인을 입혀주는 핵심 마법의 주문입니다!
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      {/* 폰트를 깔끔하게 보이게 하는 설정을 추가하면 더 예뻐집니다. */}
      <body className="antialiased"> 
        {children}
        <Toaster />
      </body>
    </html>
  );
}